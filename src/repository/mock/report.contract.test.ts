import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  ReportPage,
  ReportView,
  type CreateReportInput,
  type QuestionnaireAnswers,
  type Session,
} from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';

const answers: QuestionnaireAnswers = {
  city: 'almaty',
  intent: 'dating',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

/** m01 wrote p01 and sent the seed report1 (resolved, member restricted). */
const seedAuthor: Session = { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm01' };

function repositoryOn(store = createMemoryStore(), session?: Session) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

async function join(repo: MockRepository) {
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-1' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    interests: ['coffee'],
    communicationStyle: 'short_messages',
  });
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-report' });
  return repo;
}

const spamOnP01: CreateReportInput = {
  target: { type: 'post', id: 'p01' },
  reason: 'spam',
  details: '  Зовёт в чужой канал.  ',
  idempotencyKey: 'report-key-1',
};

describe('sending a Жалоба', () => {
  it('stores it as created and shows it in «Мои жалобы»', async () => {
    const repo = await join(repositoryOn());
    const report = ReportView.parse(await repo.createReport(spamOnP01));
    expect(report).toMatchObject({
      target: { type: 'post', id: 'p01' },
      reason: 'spam',
      details: 'Зовёт в чужой канал.',
      status: 'created',
    });
    expect(report.outcome).toBeUndefined();
    const mine = ReportPage.parse(await repo.listMyReports({}));
    expect(mine.items).toEqual([report]);
  });

  it('reports each kind of target it can see: a person, a comment and a plan', async () => {
    const repo = await join(repositoryOn());
    for (const [target, key] of [
      [{ type: 'user', id: 'm02' }, 'report-user'],
      [{ type: 'comment', id: 'c-p01-4' }, 'report-comment'],
      [{ type: 'plan', id: 'plan1' }, 'report-plan'],
    ] as const) {
      const report = await repo.createReport({ target, reason: 'harassment', idempotencyKey: key });
      expect(report.target).toEqual(target);
    }
    expect((await repo.listMyReports({})).items).toHaveLength(3);
  });

  it('a retry with the same key reports once', async () => {
    const repo = await join(repositoryOn());
    await repo.setDemoFlags({ networkErrorOnce: true });
    await expect(repo.createReport(spamOnP01)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const first = await repo.createReport(spamOnP01);
    const again = await repo.createReport(spamOnP01);
    expect(again).toEqual(first);
    expect((await repo.listMyReports({})).items).toHaveLength(1);
  });

  it('a second report on a target under review returns the first one', async () => {
    const repo = await join(repositoryOn());
    const first = await repo.createReport(spamOnP01);
    const second = await repo.createReport({
      target: { type: 'post', id: 'p01' },
      reason: 'safety',
      idempotencyKey: 'report-key-2',
    });
    expect(second).toEqual(first);
    expect((await repo.listMyReports({})).items).toHaveLength(1);
  });

  it('a new report comes before the seed ones', async () => {
    const repo = repositoryOn(createMemoryStore(), seedAuthor);
    const before = (await repo.listMyReports({})).items;
    expect(before.map((r) => r.id)).toEqual(['report1']);
    const report = await repo.createReport({
      target: { type: 'user', id: 'm02' },
      reason: 'spam',
      idempotencyKey: 'report-key-3',
    });
    expect(report.status).toBe('created');
    expect((await repo.listMyReports({})).items.map((r) => r.id)).toEqual([report.id, 'report1']);
  });

  it('own content cannot be reported', async () => {
    const repo = repositoryOn(createMemoryStore(), seedAuthor);
    await expect(repo.createReport(spamOnP01)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      repo.createReport({
        target: { type: 'user', id: 'm01' },
        reason: 'spam',
        idempotencyKey: 'report-self',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('missing, hidden or not yet existing targets are not found', async () => {
    const repo = await join(repositoryOn());
    for (const [target, key] of [
      [{ type: 'post', id: 'nope' }, 'nf-1'],
      // p14 belongs to a restricted member and is hidden from everyone.
      [{ type: 'post', id: 'p14' }, 'nf-2'],
      [{ type: 'user', id: 'm11' }, 'nf-3'],
      [{ type: 'comment', id: 'nope' }, 'nf-4'],
      [{ type: 'plan', id: 'nope' }, 'nf-5'],
      [{ type: 'message', id: 'message-1' }, 'nf-6'],
    ] as const) {
      await expect(
        repo.createReport({ target, reason: 'spam', idempotencyKey: `report-${key}` }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('«Другое» needs details; details stay within 500 characters', async () => {
    const repo = await join(repositoryOn());
    await expect(
      repo.createReport({
        target: { type: 'post', id: 'p02' },
        reason: 'other',
        details: '   ',
        idempotencyKey: 'report-other',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { details: 'required' } });
    await expect(
      repo.createReport({
        target: { type: 'post', id: 'p02' },
        reason: 'spam',
        details: 'а'.repeat(501),
        idempotencyKey: 'report-long',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { details: 'too_long' } });
    const ok = await repo.createReport({
      target: { type: 'post', id: 'p02' },
      reason: 'other',
      details: 'Странная ссылка.',
      idempotencyKey: 'report-other-ok',
    });
    expect(ok.reason).toBe('other');
  });
});

describe('who may report', () => {
  it('a guest reports anonymously and has no «Мои жалобы»', async () => {
    const store = createMemoryStore();
    const guest = repositoryOn(store);
    const report = await guest.createReport(spamOnP01);
    expect(report.status).toBe('created');
    await expect(guest.listMyReports({})).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    // Nobody else sees it as theirs, and a guest's second report is a new one.
    const again = await guest.createReport({ ...spamOnP01, idempotencyKey: 'report-key-9' });
    expect(again.id).not.toBe(report.id);
    const member = await join(repositoryOn(store));
    expect((await member.listMyReports({})).items).toEqual([]);
  });

  it('an expired member reports and sees their reports', async () => {
    const repo = await join(repositoryOn());
    await repo.expireMembership();
    const report = await repo.createReport(spamOnP01);
    expect((await repo.listMyReports({})).items).toEqual([report]);
  });

  it('a restricted session cannot report', async () => {
    const repo = await join(repositoryOn());
    await repo.setCurrentRestricted(true);
    await expect(repo.createReport(spamOnP01)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(repo.listMyReports({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('«Мои жалобы»', () => {
  it('shows the outcome of resolved seed reports', async () => {
    const repo = repositoryOn(createMemoryStore(), seedAuthor);
    const [report] = (await repo.listMyReports({})).items;
    expect(report).toMatchObject({ status: 'resolved', outcome: 'member_restricted' });
  });

  it('pages ten at a time, newest first', async () => {
    const repo = await join(repositoryOn());
    const targets = ['p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p12', 'p13'];
    for (const id of targets) {
      await repo.createReport({
        target: { type: 'post', id },
        reason: 'spam',
        idempotencyKey: `report-page-${id}`,
      });
    }
    const first = await repo.listMyReports({});
    expect(first.items).toHaveLength(10);
    expect(first.items[0]!.target.id).toBe('p13');
    const second = await repo.listMyReports({ cursor: first.nextCursor });
    expect(second.items.map((r) => r.target.id)).toEqual(['p02']);
    expect(second.hasMore).toBe(false);
  });

  it('survive a restart', async () => {
    const store = createMemoryStore();
    const repo = await join(repositoryOn(store));
    const report = await repo.createReport(spamOnP01);
    const restarted = repositoryOn(store);
    expect((await restarted.listMyReports({})).items).toEqual([report]);
  });
});

describe('state migration to v11', () => {
  it('keeps v10 state without a reset', async () => {
    const v10 = {
      version: 10,
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
      },
    };
    const repo = repositoryOn(createMemoryStore({ [storageKeys.state]: JSON.stringify(v10) }));
    expect((await repo.createReport(spamOnP01)).status).toBe('created');
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
