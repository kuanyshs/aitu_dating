import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import type { MyActionsQuery, Session } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { loadSeed } from './seed';

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function repositoryOn(session?: Session, store = createMemoryStore()) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

const kinds = async (repo: ReturnType<typeof repositoryOn>, category: MyActionsQuery['category']) =>
  (await repo.listMyActions({ category, limit: 50 })).items;

// A post m10 has not liked or reposted in the seed, by someone in good standing.
const seed = loadSeed();
const target = seed.posts.find(
  (p) =>
    p.type !== 'plan' &&
    p.authorId !== 'm10' &&
    !seed.members.find((m) => m.id === p.authorId)?.restricted &&
    !seed.reactions.some((r) => r.userId === 'm10' && r.postId === p.id) &&
    !seed.reposts.some((r) => r.userId === 'm10' && r.postId === p.id),
)!;
const fresh = target.id;
const author = target.authorId;
describe('«Мои действия»', () => {
  it('lists what the member did, each in its category, newest first', async () => {
    const repo = repositoryOn(as('m10'));
    await repo.setReaction({ postId: fresh, reaction: 'like', active: true });
    await repo.setRepost({ postId: fresh, active: true });
    await repo.setFollow({ memberId: author, active: true });
    const comment = await repo.createComment({
      postId: fresh,
      text: 'Согласна, внимательный ответ решает многое.',
      idempotencyKey: 'my-action-comment',
    });
    await repo.createComment({
      postId: fresh,
      parentId: comment.id,
      text: 'И ещё одно уточнение.',
      idempotencyKey: 'my-action-reply',
    });

    const all = await kinds(repo, 'all');
    for (const kind of ['reaction', 'repost', 'follow', 'comment', 'reply']) {
      expect(all.some((a) => a.kind === kind)).toBe(true);
    }
    const dates = all.map((a) => a.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);

    expect((await kinds(repo, 'reactions')).find((a) => a.postId === fresh)).toMatchObject({
      person: { view: 'member', id: author },
    });
    expect((await kinds(repo, 'comments')).map((a) => a.excerpt)).toContain(
      'Согласна, внимательный ответ решает многое.',
    );
    expect((await kinds(repo, 'replies')).map((a) => a.excerpt)).toContain('И ещё одно уточнение.');
    expect((await kinds(repo, 'follows')).map((a) => a.person)).toContainEqual(
      expect.objectContaining({ id: author }),
    );
  });

  it('forgets an undone like or Подписка, and hides a blocked person', async () => {
    const repo = repositoryOn(as('m10'));
    await repo.setReaction({ postId: fresh, reaction: 'like', active: true });
    await repo.setReaction({ postId: fresh, reaction: 'like', active: false });
    expect((await kinds(repo, 'reactions')).some((a) => a.postId === fresh)).toBe(false);

    await repo.setFollow({ memberId: author, active: true });
    await repo.setFollow({ memberId: author, active: false });
    expect(
      (await kinds(repo, 'follows')).some(
        (a) => a.person?.view === 'member' && a.person.id === author,
      ),
    ).toBe(false);

    await repo.setReaction({ postId: fresh, reaction: 'like', active: true });
    await repo.setBlock({ target: { type: 'user', id: author }, active: true });
    expect((await kinds(repo, 'all')).some((a) => a.postId === fresh)).toBe(false);
  });

  it('is for a card owner only', async () => {
    await expect(repositoryOn().listMyActions({ category: 'all' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
