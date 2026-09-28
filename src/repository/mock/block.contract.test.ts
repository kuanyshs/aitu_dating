import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  BlockedPage,
  CLUB_RULES_VERSION,
  type CommentPage,
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

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

/**
 * Seed facts used below: m01 wrote p01 (quoted by m08 in p11), the root c-p02-3 on p02
 * (answered by m08) and the replies c-p02-1-r2 and c-p02-2-r1. m09 wrote p05, the root
 * c-p01-3 on p01 (answered by m03) and the reply c-p01-1-r2.
 */
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
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-block' });
  return repo;
}

async function feedPostIds(repo: MockRepository) {
  const ids = new Set<string>();
  for (const tab of ['for_you', 'plans'] as const) {
    const page = await repo.getHomeFeed({ tab, limit: 50 });
    for (const post of page.items) ids.add(post.id);
  }
  return ids;
}

const commentIds = (page: CommentPage) =>
  page.items.flatMap((t) => [t.comment.id, ...t.replies.map((r) => r.id)]);

const blockM01 = { target: { type: 'user', id: 'm01' }, active: true } as const;

describe('Блокировка hides both ways', () => {
  it('the blocker no longer sees the blocked person’s posts, profile or quotes', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store, as('m09'));
    const before = await repo.getPost({ postId: 'p02' });
    expect(await repo.setBlock(blockM01)).toEqual({ target: blockM01.target, blocked: true });

    expect(await feedPostIds(repo)).not.toContain('p01');
    await expect(repo.getPost({ postId: 'p01' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(repo.getProfile({ memberId: 'm01' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(repo.listProfilePosts({ memberId: 'm01' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const quote = await repo.getPost({ postId: 'p11' });
    expect(quote.quoted).toBeUndefined();
    expect(quote.quotedUnavailable).toBe(true);
    // Counters stay as they were.
    expect((await repo.getPost({ postId: 'p02' })).commentsCount).toBe(before.commentsCount);
  });

  it('comments: replies vanish, a root holding others’ replies reads «скрыт»', async () => {
    const repo = repositoryOn(createMemoryStore(), as('m09'));
    await repo.setBlock(blockM01);
    const page = await repo.listComments({ postId: 'p02', sort: 'new', limit: 50 });
    const ids = commentIds(page);
    expect(ids).not.toContain('c-p02-1-r2');
    expect(ids).not.toContain('c-p02-2-r1');
    const thread = page.items.find((t) => t.comment.id === 'c-p02-3')!;
    expect(thread.comment).toMatchObject({ hidden: true, text: '', deleted: false });
    expect(thread.comment.author.view).toBe('safe');
    expect(thread.comment.mine).toBeUndefined();
    expect(thread.replies.map((r) => r.id)).toEqual(['c-p02-3-r1']);
    // Nothing is answered or liked behind the block.
    await expect(
      repo.createComment({
        postId: 'p02',
        parentId: 'c-p02-3',
        text: 'Ответ',
        idempotencyKey: 'reply-hidden',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      repo.setCommentReaction({ commentId: 'c-p02-3', active: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('the blocked person sees the same from their side', async () => {
    const store = createMemoryStore();
    await repositoryOn(store, as('m09')).setBlock(blockM01);
    const other = repositoryOn(store, as('m01'));
    expect(await feedPostIds(other)).not.toContain('p05');
    await expect(other.getPost({ postId: 'p05' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(other.getProfile({ memberId: 'm09' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const page = await other.listComments({ postId: 'p01', sort: 'new', limit: 50 });
    expect(commentIds(page)).not.toContain('c-p01-1-r2');
    expect(page.items.find((t) => t.comment.id === 'c-p01-3')?.comment.hidden).toBe(true);
    // Their block list is their own: they blocked nobody.
    expect((await other.listBlocked({})).items).toEqual([]);
  });

  it('a lifted block brings everything back', async () => {
    const repo = repositoryOn(createMemoryStore(), as('m09'));
    await repo.setBlock(blockM01);
    const [entry] = (await repo.listBlocked({})).items;
    expect(entry!.person).toMatchObject({ view: 'member', id: 'm01' });
    expect(
      await repo.setBlock({ target: { type: 'block', id: entry!.blockId }, active: false }),
    ).toMatchObject({ blocked: false });
    expect((await repo.listBlocked({})).items).toEqual([]);
    expect(await feedPostIds(repo)).toContain('p01');
    expect((await repo.getPost({ postId: 'p11' })).quoted?.id).toBe('p01');
    const page = await repo.listComments({ postId: 'p02', sort: 'new', limit: 50 });
    expect(page.items.find((t) => t.comment.id === 'c-p02-3')?.comment.hidden).toBeUndefined();
    // Lifting again is a no-op.
    expect(
      await repo.setBlock({ target: { type: 'block', id: entry!.blockId }, active: false }),
    ).toMatchObject({ blocked: false });
  });
});

describe('setBlock', () => {
  it('blocks the author of a post or a comment, and a repeat is a no-op', async () => {
    const repo = repositoryOn(createMemoryStore(), as('m09'));
    const byPost = { target: { type: 'post', id: 'p02' }, active: true } as const;
    await repo.setBlock(byPost);
    // The retry finds the post already hidden by the block it has made.
    expect(await repo.setBlock(byPost)).toMatchObject({ blocked: true });
    await repo.setBlock({ target: { type: 'comment', id: 'c-p01-4' }, active: true });
    const people = (await repo.listBlocked({})).items.map((b) =>
      b.person.view === 'member' ? b.person.id : undefined,
    );
    expect(people).toHaveLength(2);
    expect(people).toEqual(expect.arrayContaining(['m07', 'm03']));
  });

  it('nobody blocks themselves; unknown targets are not found', async () => {
    const repo = repositoryOn(createMemoryStore(), as('m01'));
    await expect(repo.setBlock(blockM01)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      repo.setBlock({ target: { type: 'post', id: 'p01' }, active: true }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    for (const type of ['user', 'post', 'comment'] as const) {
      await expect(
        repo.setBlock({ target: { type, id: 'nope' }, active: true }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    await expect(
      repo.setBlock({ target: { type: 'block', id: 'nope' }, active: true }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('guests cannot block; a restricted session is forbidden', async () => {
    const guest = repositoryOn();
    await expect(guest.setBlock(blockM01)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(guest.listBlocked({})).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    const restricted = await join(repositoryOn());
    await restricted.setCurrentRestricted(true);
    await expect(restricted.setBlock(blockM01)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('an expired member blocks an author they see in the safe view', async () => {
    const repo = await join(repositoryOn());
    await repo.expireMembership();
    const post = await repo.getPost({ postId: 'p02' });
    expect(post.author.view).toBe('safe');
    await repo.setBlock({ target: { type: 'post', id: 'p02' }, active: true });
    const page = BlockedPage.parse(await repo.listBlocked({}));
    expect(page.items[0]!.person.view).toBe('safe');
    await expect(repo.getPost({ postId: 'p02' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('blocks survive a restart', async () => {
    const store = createMemoryStore();
    await repositoryOn(store, as('m09')).setBlock(blockM01);
    const restarted = repositoryOn(store, as('m09'));
    await expect(restarted.getPost({ postId: 'p01' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect((await restarted.listBlocked({})).items).toHaveLength(1);
  });
});

describe('state migration to v12', () => {
  it('keeps v11 state without a reset', async () => {
    const v11 = {
      version: 11,
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
      },
    };
    const repo = repositoryOn(
      createMemoryStore({ [storageKeys.state]: JSON.stringify(v11) }),
      as('m09'),
    );
    expect(await repo.setBlock(blockM01)).toMatchObject({ blocked: true });
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
