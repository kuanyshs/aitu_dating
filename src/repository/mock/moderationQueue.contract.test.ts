import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { ModerationReportPage, type Session } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { loadSeed } from './seed';

const seed = loadSeed();
const authorOfPost = (id: string) => seed.posts.find((p) => p.id === id)!.authorId;
const authorOfPlan = (id: string) => seed.plans.find((p) => p.id === id)!.authorId;

const member = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});
/** m05 moderates; none of the seed reports is about their content. */
const moderator: Session = { ...member('m05'), roles: ['member', 'moderator'] };

function on(store: ReturnType<typeof createMemoryStore>, session: Session) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

const ids = (page: ModerationReportPage) => page.items.map((i) => i.report.id);

describe('Очередь модерации', () => {
  it('lists every report newest first, by status on request, with its subject', async () => {
    const mod = on(createMemoryStore(), moderator);
    const all = ModerationReportPage.parse(await mod.listReports({}));
    expect(ids(all)).toEqual(['report5', 'report4', 'report2', 'report1', 'report3']);
    expect(ids(await mod.listReports({ status: 'created' }))).toEqual(['report5', 'report4']);
    expect(ids(await mod.listReports({ status: 'reviewing' }))).toEqual(['report3']);

    const report5 = all.items[0]!;
    expect(report5.subject).toMatchObject({
      person: { view: 'member', id: authorOfPost('p10') },
      text: seed.posts.find((p) => p.id === 'p10')!.text,
      restricted: false,
    });
    // Moderation sees through restrictions: p14's author is restricted.
    const report1 = all.items.find((i) => i.report.id === 'report1')!;
    expect(report1.subject).toMatchObject({ person: { id: 'm11' }, restricted: true });
    expect(report1.report.outcome).toBe('member_restricted');
  });

  it('opening a new report takes it into review, once', async () => {
    const mod = on(createMemoryStore(), moderator);
    expect((await mod.openReport({ reportId: 'report4' })).report.status).toBe('reviewing');
    expect(ids(await mod.listReports({ status: 'created' }))).toEqual(['report5']);
    expect((await mod.openReport({ reportId: 'report4' })).report.status).toBe('reviewing');
    expect((await mod.openReport({ reportId: 'report1' })).report.status).toBe('resolved');
  });

  it('is for moderators only', async () => {
    const store = createMemoryStore();
    for (const session of [member('m09'), { accessState: 'GUEST_PREVIEW', roles: [] } as Session]) {
      const repo = on(store, session);
      await expect(repo.listReports({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(repo.openReport({ reportId: 'report4' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        repo.resolveReport({ reportId: 'report4', resolution: 'dismissed' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('never shows a moderator reports about their own content', async () => {
    const store = createMemoryStore();
    const mod = on(store, moderator);
    const own = await mod.createPost({
      type: 'post',
      text: 'Пост модератора',
      topics: [],
      idempotencyKey: 'mod-post-1',
    });
    const { report } = await on(store, member('m09')).createReport({
      target: { type: 'post', id: own.id },
      reason: 'spam',
      idempotencyKey: 'report-mod-post',
    });
    expect(ids(await mod.listReports({}))).not.toContain(report.id);
    await expect(mod.openReport({ reportId: report.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      mod.resolveReport({ reportId: report.id, resolution: 'dismissed' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('resolveReport', () => {
  it('«Отклонить» resolves without consequences; the reporter sees the outcome', async () => {
    const store = createMemoryStore();
    const decided = await on(store, moderator).resolveReport({
      reportId: 'report5',
      resolution: 'dismissed',
    });
    expect(decided.report).toMatchObject({ status: 'resolved', outcome: 'dismissed' });
    const reporter = on(store, member('m09'));
    expect((await reporter.listMyReports({})).items[0]).toMatchObject({
      id: 'report5',
      status: 'resolved',
      outcome: 'dismissed',
    });
    expect((await reporter.getPost({ postId: 'p10' })).id).toBe('p10');
  });

  it('«Удалить контент» removes the post and closes every open report on it', async () => {
    const store = createMemoryStore();
    const first = await on(store, member('m09')).createReport({
      target: { type: 'post', id: 'p02' },
      reason: 'spam',
      idempotencyKey: 'report-p02-a',
    });
    const second = await on(store, member('m10')).createReport({
      target: { type: 'post', id: 'p02' },
      reason: 'harassment',
      idempotencyKey: 'report-p02-b',
    });
    const mod = on(store, moderator);
    await mod.resolveReport({ reportId: first.report.id, resolution: 'content_removed' });

    const resolved = (await mod.listReports({ status: 'resolved' })).items.filter(
      (i) => i.report.target.id === 'p02',
    );
    expect(resolved.map((i) => i.report.id).sort()).toEqual(
      [first.report.id, second.report.id].sort(),
    );
    expect(resolved.every((i) => i.report.outcome === 'content_removed')).toBe(true);
    const reader = on(store, member('m10'));
    await expect(reader.getPost({ postId: 'p02' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await reader.listMyReports({})).items[0]!.outcome).toBe('content_removed');
  });

  it('«Удалить контент» on a comment leaves «Комментарий удалён» with its replies', async () => {
    const store = createMemoryStore();
    await on(store, moderator).resolveReport({
      reportId: 'report3',
      resolution: 'content_removed',
    });
    const page = await on(store, member('m09')).listComments({
      postId: 'p06',
      sort: 'new',
      limit: 50,
    });
    const thread = page.items.find((t) => t.comment.id === 'c-p06-1')!;
    expect(thread.comment).toMatchObject({ deleted: true, text: '' });
    expect(thread.replies.length).toBeGreaterThan(0);
  });

  it('«Ограничить участника» restricts the author; a second time is a CONFLICT', async () => {
    const store = createMemoryStore();
    const planAuthor = authorOfPlan('plan5');
    const otherPost = seed.posts.find((p) => p.authorId === planAuthor && !p.planId)!;
    const other = await on(store, member('m09')).createReport({
      target: { type: 'post', id: otherPost.id },
      reason: 'spam',
      idempotencyKey: 'report-other-post',
    });
    const mod = on(store, moderator);
    const decided = await mod.resolveReport({
      reportId: 'report4',
      resolution: 'member_restricted',
    });
    expect(decided.subject).toMatchObject({ person: { id: planAuthor }, restricted: true });
    await expect(
      on(store, member('m09')).getProfile({ memberId: planAuthor }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // Another open report on the same person: restricting again makes no sense.
    await expect(
      mod.resolveReport({ reportId: other.report.id, resolution: 'member_restricted' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    // It can still be decided otherwise.
    expect(
      (await mod.resolveReport({ reportId: other.report.id, resolution: 'dismissed' })).report
        .status,
    ).toBe('resolved');
  });

  it('refuses a decided report and «content» of a person', async () => {
    const mod = on(createMemoryStore(), moderator);
    await expect(
      mod.resolveReport({ reportId: 'report1', resolution: 'dismissed' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const store = createMemoryStore();
    const { report } = await on(store, member('m09')).createReport({
      target: { type: 'user', id: 'm02' },
      reason: 'harassment',
      idempotencyKey: 'report-user-m02',
    });
    await expect(
      on(store, moderator).resolveReport({ reportId: report.id, resolution: 'content_removed' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      mod.resolveReport({ reportId: 'nope', resolution: 'dismissed' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('after a decision the same target can be reported again', async () => {
    const store = createMemoryStore();
    const reporter = on(store, member('m09'));
    const first = await reporter.createReport({
      target: { type: 'post', id: 'p03' },
      reason: 'spam',
      idempotencyKey: 'report-p03-a',
    });
    await on(store, moderator).resolveReport({
      reportId: first.report.id,
      resolution: 'dismissed',
    });
    // Each mock instance reads the store once, as an app start would.
    const again = await on(store, member('m09')).createReport({
      target: { type: 'post', id: 'p03' },
      reason: 'safety',
      idempotencyKey: 'report-p03-b',
    });
    expect(again.alreadyReported).toBe(false);
    expect(again.report.id).not.toBe(first.report.id);
  });

  it('decisions survive a restart', async () => {
    const store = createMemoryStore();
    await on(store, moderator).openReport({ reportId: 'report4' });
    await on(store, moderator).resolveReport({ reportId: 'report5', resolution: 'dismissed' });
    const restarted = on(store, moderator);
    expect(ids(await restarted.listReports({ status: 'reviewing' }))).toEqual([
      'report4',
      'report3',
    ]);
    expect(ids(await restarted.listReports({ status: 'created' }))).toEqual([]);
  });
});

describe('state migration to v13', () => {
  it('keeps v12 state without a reset', async () => {
    const v12 = {
      version: 12,
      data: {
        demoFlags: { networkErrorOnce: false, offline: false, failedMessageOnce: false },
        accessFlow: null,
        payments: {},
        members: [],
        onboardings: {},
        parkedFlows: {},
        reactions: [],
        renewals: {},
        expiredMemberships: {},
        restrictedSubjects: [],
        settings: {},
        comments: [],
        deletedCommentIds: [],
        deletedPostIds: [],
        commentReactions: [],
        reposts: [],
        commentKeys: {},
        posts: [],
        postKeys: {},
        reports: [],
        reportKeys: {},
        blocks: [],
      },
    };
    const repo = on(createMemoryStore({ [storageKeys.state]: JSON.stringify(v12) }), moderator);
    expect((await repo.listReports({})).items).toHaveLength(5);
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
