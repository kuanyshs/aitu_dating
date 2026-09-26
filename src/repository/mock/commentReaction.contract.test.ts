import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  CommentReactionState,
  type CommentThread,
  type QuestionnaireAnswers,
} from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';
import { loadSeed } from './seed';

const seed = loadSeed();
const seedLikes = (id: string) => seed.commentReactions.filter((r) => r.commentId === id).length;

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
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-comment-like' });
  return repo;
}

async function popularIds(repo: MockRepository) {
  const threads: CommentThread[] = [];
  let cursor: string | undefined;
  do {
    const page = await repo.listComments({ postId: 'p01', sort: 'popular', cursor });
    threads.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return threads.map((t) => t.comment.id);
}

describe('comment likes', () => {
  it('toggle, and repeating the same value changes nothing', async () => {
    const repo = await join(repositoryOn());
    const liked = CommentReactionState.parse(
      await repo.setCommentReaction({ commentId: 'c-p01-5', active: true }),
    );
    expect(liked).toEqual({
      commentId: 'c-p01-5',
      reactions: seedLikes('c-p01-5') + 1,
      reactedByMe: true,
    });
    expect(await repo.setCommentReaction({ commentId: 'c-p01-5', active: true })).toEqual(liked);
    expect(await repo.setCommentReaction({ commentId: 'c-p01-5', active: false })).toEqual({
      commentId: 'c-p01-5',
      reactions: seedLikes('c-p01-5'),
      reactedByMe: false,
    });
  });

  it('work on replies too and show in the thread', async () => {
    const repo = await join(repositoryOn());
    await repo.setCommentReaction({ commentId: 'c-p01-1-r2', active: true });
    const page = await repo.listComments({ postId: 'p01', sort: 'new', limit: 50 });
    const reply = page.items.flatMap((t) => t.replies).find((r) => r.id === 'c-p01-1-r2');
    expect(reply).toMatchObject({ reactions: seedLikes('c-p01-1-r2') + 1, reactedByMe: true });
  });

  it('move a comment up in «Популярные»', async () => {
    const repo = await join(repositoryOn());
    const before = await popularIds(repo);
    expect(before.indexOf('c-p01-4')).toBeGreaterThan(before.indexOf('c-p01-12'));
    await repo.setCommentReaction({ commentId: 'c-p01-4', active: true });
    const after = await popularIds(repo);
    expect(after.indexOf('c-p01-4')).toBeLessThan(after.indexOf('c-p01-12'));
  });

  it('survive a restart', async () => {
    const store = createMemoryStore();
    await (
      await join(repositoryOn(store))
    ).setCommentReaction({
      commentId: 'c-p01-3',
      active: true,
    });
    const page = await repositoryOn(store).listComments({ postId: 'p01', sort: 'new', limit: 50 });
    expect(page.items.find((t) => t.comment.id === 'c-p01-3')?.comment.reactedByMe).toBe(true);
  });

  it('are refused to guests, expired members and restricted sessions', async () => {
    const like = { commentId: 'c-p01-5', active: true } as const;
    await expect(repositoryOn().setCommentReaction(like)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const expired = await join(repositoryOn());
    await expired.expireMembership();
    await expect(expired.setCommentReaction(like)).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
    const restricted = await join(repositoryOn());
    await restricted.setCurrentRestricted(true);
    await expect(restricted.setCommentReaction(like)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('are not found for deleted, hidden or unknown comments', async () => {
    const repo = await join(repositoryOn());
    const hidden = seed.comments.find((c) => c.authorId === 'm11');
    for (const commentId of ['c-p01-2', 'nope', ...(hidden ? [hidden.id] : [])]) {
      await expect(repo.setCommentReaction({ commentId, active: true })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    }
  });
});
