import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  type CommentThread,
  type QuestionnaireAnswers,
  type Session,
} from '@/contracts';
import { createMemoryStore } from '@/storage';

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

/** m01 wrote p01; plan posts belong to plans and cannot be deleted on their own. */
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
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-delete' });
  return repo;
}

async function threadsOf(repo: MockRepository, postId: string) {
  const all: CommentThread[] = [];
  let cursor: string | undefined;
  do {
    const page = await repo.listComments({ postId, sort: 'new', cursor });
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

async function rootWithReply(repo: MockRepository, key: string) {
  const root = await repo.createComment({
    postId: 'p03',
    text: 'Корень',
    idempotencyKey: `${key}-r`,
  });
  const reply = await repo.createComment({
    postId: 'p03',
    parentId: root.id,
    text: 'Ответ',
    idempotencyKey: `${key}-a`,
  });
  return { root, reply };
}

describe('deleting an own comment', () => {
  it('keeps a root with replies as «Комментарий удалён»', async () => {
    const repo = await join(repositoryOn());
    const { root, reply } = await rootWithReply(repo, 'del-root');
    const deleted = await repo.deleteComment({ commentId: root.id });
    expect(deleted).toMatchObject({ id: root.id, deleted: true, text: '', mine: true });

    const thread = (await threadsOf(repo, 'p03')).find((t) => t.comment.id === root.id);
    expect(thread?.comment).toMatchObject({ deleted: true, text: '' });
    expect(thread?.replies.map((r) => r.id)).toEqual([reply.id]);
    expect((await repo.getPost({ postId: 'p03' })).commentsCount).toBe(1);
  });

  it('drops a root without replies and a reply from the thread and the count', async () => {
    const repo = await join(repositoryOn());
    const lone = await repo.createComment({
      postId: 'p03',
      text: 'Одиночный',
      idempotencyKey: 'lone-root-1',
    });
    const { root, reply } = await rootWithReply(repo, 'del-reply');
    expect((await repo.getPost({ postId: 'p03' })).commentsCount).toBe(3);

    await repo.deleteComment({ commentId: lone.id });
    await repo.deleteComment({ commentId: reply.id });
    const threads = await threadsOf(repo, 'p03');
    expect(threads.map((t) => t.comment.id)).toEqual([root.id]);
    expect(threads[0]?.replies).toEqual([]);
    expect((await repo.getPost({ postId: 'p03' })).commentsCount).toBe(1);
  });

  it('is allowed to an expired member and survives a restart', async () => {
    const store = createMemoryStore();
    const repo = await join(repositoryOn(store));
    const comment = await repo.createComment({
      postId: 'p03',
      text: 'Удалю позже',
      idempotencyKey: 'expired-delete-1',
    });
    await repo.expireMembership();
    await repo.deleteComment({ commentId: comment.id });
    const restarted = repositoryOn(store);
    expect(await threadsOf(restarted, 'p03')).toEqual([]);
  });

  it('is refused for someone else’s comment, twice deleted or for guests', async () => {
    const repo = await join(repositoryOn());
    await expect(repo.deleteComment({ commentId: 'c-p01-1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const mine = await repo.createComment({
      postId: 'p03',
      text: 'Раз',
      idempotencyKey: 'twice-delete-1',
    });
    await repo.deleteComment({ commentId: mine.id });
    await expect(repo.deleteComment({ commentId: mine.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(repositoryOn().deleteComment({ commentId: 'c-p01-1' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('deleting an own post', () => {
  it('hides it from the post screen and every feed tab, also after a restart', async () => {
    const store = createMemoryStore();
    const author = repositoryOn(store, seedAuthor);
    expect((await author.getPost({ postId: 'p01' })).mine).toBe(true);
    await author.deletePost({ postId: 'p01' });

    const restarted = repositoryOn(store, seedAuthor);
    await expect(restarted.getPost({ postId: 'p01' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    for (const tab of ['for_you', 'popular', 'plans'] as const) {
      const page = await restarted.getHomeFeed({ tab, limit: 50 });
      expect(page.items.map((p) => p.id)).not.toContain('p01');
    }
  });

  it('is refused for someone else’s post and for a plan’s post', async () => {
    const author = repositoryOn(createMemoryStore(), seedAuthor);
    await expect(author.deletePost({ postId: 'p02' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const other = await join(repositoryOn());
    await expect(other.deletePost({ postId: 'p01' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(repositoryOn().deletePost({ postId: 'p01' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const planAuthor = repositoryOn(createMemoryStore(), { ...seedAuthor, userId: 'm06' });
    await expect(planAuthor.deletePost({ postId: 'p-plan1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('marks what is mine for members only', async () => {
    const guest = repositoryOn();
    expect((await guest.getPost({ postId: 'p01' })).mine).toBeUndefined();
    const member = await join(repositoryOn());
    expect((await member.getPost({ postId: 'p01' })).mine).toBe(false);
  });
});
