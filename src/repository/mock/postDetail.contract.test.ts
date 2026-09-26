import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  CommentPage,
  type CommentThread,
  type QuestionnaireAnswers,
} from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';
import { loadSeed } from './seed';

const seed = loadSeed();
const safeKeys = ['age', 'avatar', 'city', 'gender', 'view'];

const answers: QuestionnaireAnswers = {
  city: 'almaty',
  intent: 'dating',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

function repositoryOn(store = createMemoryStore()) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store });
}

async function member(repo = repositoryOn()) {
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-1' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    interests: ['coffee'],
    communicationStyle: 'short_messages',
  });
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-post-detail' });
  return repo;
}

async function allThreads(repo: MockRepository, postId: string, sort: 'popular' | 'new') {
  const threads: CommentThread[] = [];
  let cursor: string | undefined;
  do {
    const page = CommentPage.parse(await repo.listComments({ postId, sort, cursor }));
    threads.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return threads;
}

const likesOf = (id: string) => seed.commentReactions.filter((r) => r.commentId === id).length;

describe('comment threads', () => {
  it('show guests and expired members every author in the safe view only', async () => {
    const expired = await member();
    await expired.expireMembership();
    for (const repo of [repositoryOn(), expired]) {
      for (const thread of await allThreads(repo, 'p01', 'new')) {
        for (const c of [thread.comment, ...thread.replies]) {
          expect(Object.keys(c.author).sort()).toEqual(safeKeys);
          expect(c.reactedByMe).toBeUndefined();
          // Guests own nothing; an expired member still learns what is theirs.
          expect(c.mine).toBe(repo === expired ? false : undefined);
        }
      }
    }
  });

  it('order «Популярные» by likes, newer first on a tie, unlike «Новые»', async () => {
    const repo = repositoryOn();
    const popular = await allThreads(repo, 'p01', 'popular');
    const fresh = await allThreads(repo, 'p01', 'new');
    expect(popular.map((t) => t.comment.id)).not.toEqual(fresh.map((t) => t.comment.id));
    expect(popular[0]?.comment.id).toBe('c-p01-5');

    for (const [a, b] of popular.slice(0, -1).map((t, i) => [t, popular[i + 1]!] as const)) {
      const [la, lb] = [a.comment.reactions, b.comment.reactions];
      expect(la).toBeGreaterThanOrEqual(lb);
      if (la === lb) expect(a.comment.createdAt >= b.comment.createdAt).toBe(true);
    }
    const times = fresh.map((t) => t.comment.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(popular[0]?.comment.reactions).toBe(likesOf('c-p01-5'));
  });

  it('keep replies under their root, oldest first', async () => {
    for (const thread of await allThreads(repositoryOn(), 'p01', 'popular')) {
      for (const reply of thread.replies) expect(reply.parentId).toBe(thread.comment.id);
      const times = thread.replies.map((r) => r.createdAt);
      expect(times).toEqual([...times].sort());
    }
  });

  it('come ten root threads per page', async () => {
    const repo = repositoryOn();
    const first = await repo.listComments({ postId: 'p01', sort: 'new' });
    expect(first.items).toHaveLength(10);
    expect(first.hasMore).toBe(true);
    const second = await repo.listComments({
      postId: 'p01',
      sort: 'new',
      cursor: first.nextCursor,
    });
    expect(second.items).toHaveLength(2);
    expect(second.hasMore).toBe(false);
  });
});

describe('deleted comments', () => {
  it('keep a deleted root with replies as «Комментарий удалён»', async () => {
    const threads = await allThreads(repositoryOn(), 'p01', 'new');
    const deleted = threads.find((t) => t.comment.id === 'c-p01-2');
    expect(deleted?.comment).toMatchObject({ deleted: true, text: '' });
    expect(deleted?.replies.length).toBeGreaterThan(0);
  });

  it('drop a deleted root without replies and a deleted reply', async () => {
    const repo = repositoryOn();
    const p06 = await allThreads(repo, 'p06', 'new');
    expect(p06.map((t) => t.comment.id)).not.toContain('c-p06-3');
    const p02 = await allThreads(repo, 'p02', 'new');
    const replies = p02.flatMap((t) => t.replies.map((r) => r.id));
    expect(replies).not.toContain('c-p02-1-r2');
  });

  it('are not counted in «Ответы · N»', async () => {
    const post = await repositoryOn().getPost({ postId: 'p01' });
    const alive = seed.comments.filter((c) => c.postId === 'p01' && !c.deleted).length;
    expect(post.commentsCount).toBe(alive);
    const threads = await allThreads(repositoryOn(), 'p01', 'new');
    const shownAlive = threads
      .flatMap((t) => [t.comment, ...t.replies])
      .filter((c) => !c.deleted).length;
    expect(shownAlive).toBe(alive);
  });
});

describe('member view', () => {
  it('tells an active member what they liked and wrote', async () => {
    const repo = await member();
    const [thread] = await allThreads(repo, 'p01', 'popular');
    expect(thread?.comment.reactedByMe).toBe(false);
    expect(thread?.comment.mine).toBe(false);
    expect(thread?.comment.author.view).toBe('member');
  });
});

describe('unavailable post', () => {
  it('is not found when its author is restricted or it does not exist', async () => {
    const repo = repositoryOn();
    for (const postId of ['p14', 'nope']) {
      await expect(repo.getPost({ postId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(repo.listComments({ postId, sort: 'new' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    }
  });
});

describe('state migration to v8', () => {
  it('keeps v7 state without a reset', async () => {
    const v7 = {
      version: 7,
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
      },
    };
    const repo = repositoryOn(createMemoryStore({ [storageKeys.state]: JSON.stringify(v7) }));
    expect((await repo.listComments({ postId: 'p01', sort: 'new' })).items).toHaveLength(10);
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
