import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  MemberPage,
  type QuestionnaireAnswers,
  type Session,
} from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';
import { loadSeed } from './seed';

const seed = loadSeed();
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

function on(store = createMemoryStore(), session?: Session) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

/** Joins as passport-1 (`me-passport-1`), who follows nobody yet. */
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
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-follow' });
  return repo;
}

const ids = (page: MemberPage) => page.items.map((p) => (p.view === 'member' ? p.id : undefined));

/** A seed Подписка whose both sides are visible members. */
const seedPair = seed.follows.find((f) => f.followerId !== 'm11' && f.followingId !== 'm11')!;

describe('Подписка', () => {
  it('following shows up in the lists, the profile and the «Подписки» feed', async () => {
    const repo = await join(on());
    const me = await repo.getMyProfile();
    const before = await repo.getProfile({ memberId: 'm01' });

    expect(await repo.setFollow({ memberId: 'm01', active: true })).toEqual({
      memberId: 'm01',
      following: true,
      followers: before.stats.followers + 1,
    });
    const after = await repo.getProfile({ memberId: 'm01' });
    expect(after.stats.followers).toBe(before.stats.followers + 1);
    expect(after.relation).toMatchObject({ following: true, followsMe: false });

    expect(ids(await repo.listFollowing({ memberId: me.id }))).toEqual(['m01']);
    expect(ids(await repo.listFollowers({ memberId: 'm01' }))[0]).toBe(me.id);
    const feed = await repo.getHomeFeed({ tab: 'following', limit: 50 });
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items.every((p) => p.author.view === 'member' && p.author.id === 'm01')).toBe(true);
  });

  it('a repeat is a no-op, and unfollowing takes it all back', async () => {
    const repo = await join(on());
    const me = await repo.getMyProfile();
    await repo.setFollow({ memberId: 'm01', active: true });
    await repo.setFollow({ memberId: 'm01', active: true });
    expect(ids(await repo.listFollowing({ memberId: me.id }))).toEqual(['m01']);

    const off = await repo.setFollow({ memberId: 'm01', active: false });
    expect(off.following).toBe(false);
    expect((await repo.listFollowing({ memberId: me.id })).items).toEqual([]);
    expect((await repo.getHomeFeed({ tab: 'following' })).items).toEqual([]);
    expect((await repo.setFollow({ memberId: 'm01', active: false })).following).toBe(false);
  });

  it('a seed Подписка can be undone and made again, without a duplicate', async () => {
    const { followerId, followingId } = seedPair;
    const repo = on(createMemoryStore(), as(followerId));
    expect(ids(await repo.listFollowing({ memberId: followerId, limit: 50 }))).toContain(
      followingId,
    );
    await repo.setFollow({ memberId: followingId, active: false });
    expect(ids(await repo.listFollowing({ memberId: followerId, limit: 50 }))).not.toContain(
      followingId,
    );
    await repo.setFollow({ memberId: followingId, active: true });
    const again = ids(await repo.listFollowing({ memberId: followerId, limit: 50 }));
    expect(again.filter((id) => id === followingId)).toHaveLength(1);
  });

  it('nobody follows themselves; hidden or unknown people are not found', async () => {
    const repo = on(createMemoryStore(), as('m01'));
    await expect(repo.setFollow({ memberId: 'm01', active: true })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    for (const memberId of ['nope', 'm11']) {
      await expect(repo.setFollow({ memberId, active: true })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      await expect(repo.listFollowers({ memberId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('is for active members only', async () => {
    const guest = on();
    await expect(guest.setFollow({ memberId: 'm01', active: true })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(guest.listFollowers({ memberId: 'm01' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });

    const expired = await join(on());
    await expired.expireMembership();
    await expect(expired.setFollow({ memberId: 'm01', active: true })).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
    await expect(expired.listFollowing({ memberId: 'm01' })).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });

    const restricted = await join(on());
    await restricted.setCurrentRestricted(true);
    await expect(restricted.setFollow({ memberId: 'm01', active: true })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lists leave out restricted people and come in pages', async () => {
    const repo = on(createMemoryStore(), as('m02'));
    for (const memberId of ['m11']) {
      const page = await repo.listFollowers({ memberId: 'm01', limit: 50 });
      expect(ids(page)).not.toContain(memberId);
    }
    const all = seed.members.filter((m) => m.id !== 'm02' && m.id !== 'm11');
    for (const m of all) await repo.setFollow({ memberId: m.id, active: true });
    const seen: (string | undefined)[] = [];
    let cursor: string | undefined;
    do {
      const page = await repo.listFollowing({ memberId: 'm02', limit: 4, cursor });
      expect(page.items.length).toBeLessThanOrEqual(4);
      seen.push(...ids(page));
      cursor = page.nextCursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(all.length);
    expect(seen).toHaveLength(all.length);
  });
});

describe('Блокировка and Подписки', () => {
  it('removes them both ways and does not bring them back', async () => {
    const store = createMemoryStore();
    await on(store, as('m01')).setFollow({ memberId: 'm09', active: true });
    await on(store, as('m09')).setFollow({ memberId: 'm01', active: true });

    const m09 = on(store, as('m09'));
    await m09.setBlock({ target: { type: 'user', id: 'm01' }, active: true });
    const [entry] = (await on(store, as('m09')).listBlocked({})).items;
    await on(store, as('m09')).setBlock({
      target: { type: 'block', id: entry!.blockId },
      active: false,
    });

    const after = on(store, as('m09'));
    expect((await after.getProfile({ memberId: 'm01' })).relation).toMatchObject({
      following: false,
      followsMe: false,
    });
    expect(ids(await after.listFollowing({ memberId: 'm09', limit: 50 }))).not.toContain('m01');
    expect(ids(await after.listFollowers({ memberId: 'm09', limit: 50 }))).not.toContain('m01');
  });
});

describe('persistence', () => {
  it('Подписки survive a restart', async () => {
    const store = createMemoryStore();
    await on(store, as('m02')).setFollow({ memberId: 'm01', active: true });
    expect((await on(store, as('m02')).getProfile({ memberId: 'm01' })).relation?.following).toBe(
      true,
    );
  });

  it('keeps v13 state without a reset', async () => {
    const v13 = {
      version: 13,
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
        reportUpdates: {},
      },
    };
    const repo = on(createMemoryStore({ [storageKeys.state]: JSON.stringify(v13) }), as('m02'));
    expect((await repo.setFollow({ memberId: 'm01', active: true })).following).toBe(true);
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
