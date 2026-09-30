import { describe, expect, it } from 'vitest';

import { fixedClock, SEED_NOW } from '@/clock';
import { ActivityPage, type ActivityItem, type Session } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { loadSeed } from './seed';

// m01 wrote p01 and is followed by m09 and m12; plan1 is m06's.

const seed = loadSeed();
const m01 = seed.members.find((m) => m.id === 'm01')!;

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

type Store = ReturnType<typeof createMemoryStore>;
function on(store: Store, userId?: string, now = SEED_NOW) {
  return createMockRepository({
    clock: fixedClock(now),
    latency: 0,
    store,
    session: userId ? as(userId) : undefined,
  });
}

const all = async (store: Store, userId: string) =>
  ActivityPage.parse(await on(store, userId).listActivity({ category: 'all', limit: 50 })).items;

const kinds = (items: ActivityItem[]) => new Set(items.map((i) => i.kind));

describe('Активность', () => {
  it('gathers follows, comments, replies, reactions and reposts, newest first', async () => {
    const items = await all(createMemoryStore(), 'm01');
    expect(kinds(items)).toEqual(
      expect.objectContaining(new Set(['follow', 'comment', 'reaction'])),
    );
    const follows = items.filter((i) => i.kind === 'follow').map((i) => i.actor);
    expect(follows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'm09' }),
        expect.objectContaining({ id: 'm12' }),
      ]),
    );
    const comment = items.find((i) => i.kind === 'comment')!;
    expect(comment.postId).toBeTruthy();
    expect(comment.commentId).toBeTruthy();
    expect(seed.posts.find((p) => p.id === comment.postId)?.authorId).toBe('m01');
    const times = items.map((i) => i.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    // Nothing of one's own doing.
    expect(items.every((i) => i.actor?.view !== 'member' || i.actor.id !== 'm01')).toBe(true);
  });

  it('filters by category', async () => {
    const store = createMemoryStore();
    const follows = await on(store, 'm01').listActivity({ category: 'follows', limit: 50 });
    expect(kinds(follows.items)).toEqual(new Set(['follow']));
    const reactions = await on(store, 'm01').listActivity({ category: 'reactions', limit: 50 });
    expect([...kinds(reactions.items)].every((k) => k === 'reaction' || k === 'repost')).toBe(true);
    const mentions = await on(store, 'm01').listActivity({ category: 'mentions' });
    expect(mentions.items).toEqual([]);
  });

  it('marks everything so far as seen; later events are new', async () => {
    const store = createMemoryStore();
    expect((await all(store, 'm01')).every((i) => !i.read)).toBe(true);
    const { seenAt } = await on(store, 'm01').markActivitySeen();
    expect(seenAt).toBe(SEED_NOW.replace('Z', '.000Z'));
    expect((await all(store, 'm01')).every((i) => i.read)).toBe(true);

    const later = new Date(new Date(SEED_NOW).getTime() + 60_000).toISOString();
    await on(store, 'm04', later).setFollow({ memberId: 'm01', active: true });
    const items = await all(store, 'm01');
    expect(items[0]).toMatchObject({ kind: 'follow', read: false, actor: { id: 'm04' } });
    expect(items.slice(1).every((i) => i.read)).toBe(true);
  });

  it('tells the author of a plan about Отклики and the sender about decisions', async () => {
    const store = createMemoryStore();
    const one = await on(store, 'm02').respondToPlan({
      planId: 'plan1',
      idempotencyKey: 'activity-key-1',
    });
    const two = await on(store, 'm03').respondToPlan({
      planId: 'plan1',
      idempotencyKey: 'activity-key-2',
    });
    const plans = await on(store, 'm06').listActivity({ category: 'plans' });
    expect(plans.items.map((i) => [i.kind, i.actor?.view === 'member' && i.actor.id])).toEqual(
      expect.arrayContaining([
        ['plan_response', 'm02'],
        ['plan_response', 'm03'],
      ]),
    );

    await on(store, 'm06').acceptPlanResponse({ responseId: one.id });
    expect((await on(store, 'm02').listActivity({ category: 'plans' })).items[0]).toMatchObject({
      kind: 'response_accepted',
      planId: 'plan1',
      actor: { id: 'm06' },
    });
    // The other waiting one was declined with the acceptance.
    expect((await on(store, 'm03').listActivity({ category: 'plans' })).items[0]).toMatchObject({
      kind: 'response_declined',
    });
    expect(two.status).toBe('pending');
  });

  it('warns a week before the membership ends', async () => {
    const endsAt = new Date(m01.membership.endsAt).getTime();
    const threeDaysBefore = new Date(endsAt - 3 * 24 * 60 * 60 * 1000).toISOString();
    const system = await on(createMemoryStore(), 'm01', threeDaysBefore).listActivity({
      category: 'system',
    });
    expect(system.items).toEqual([
      expect.objectContaining({ kind: 'membership_expiring', read: false }),
    ]);
    expect(
      (await on(createMemoryStore(), 'm01').listActivity({ category: 'system' })).items,
    ).toEqual([]);
  });

  it('leaves out people hidden from the viewer', async () => {
    const store = createMemoryStore();
    const commenter = (await all(store, 'm01')).find((i) => i.kind === 'comment')!.actor!;
    const id = commenter.view === 'member' ? commenter.id : '';
    await on(store, 'm01').setBlock({ target: { type: 'user', id }, active: true });
    const items = await all(store, 'm01');
    expect(items.some((i) => i.actor?.view === 'member' && i.actor.id === id)).toBe(false);
  });

  it('is for members; an expired one sees people in the safe view', async () => {
    await expect(on(createMemoryStore()).listActivity({ category: 'all' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const store = createMemoryStore();
    await on(store, 'm01').expireMembership();
    const items = await all(store, 'm01');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => !i.actor || i.actor.view === 'safe')).toBe(true);
  });
});
