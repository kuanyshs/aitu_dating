import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  FeedPage,
  MyProfile,
  ReactionState,
  type MembershipSelection,
  type QuestionnaireAnswers,
} from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';

const clock = fixedClock();

const answers: QuestionnaireAnswers = {
  city: 'astana',
  intent: 'dating',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

function repositoryOn(store = createMemoryStore(), now = clock) {
  return createMockRepository({ clock: now, latency: 0, store });
}

async function joinPaid(repo: MockRepository, months: 1 | 3 = 1) {
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-1' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'paid', periodMonths: months });
  await repo.confirmPayment({ idempotencyKey: 'join-checkout-1' });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    interests: ['coffee'],
    communicationStyle: 'short_messages',
  });
  return repo.completeOnboarding({ answers, idempotencyKey: 'onboard-1' });
}

const paid3: MembershipSelection = { tier: 'paid', periodMonths: 3 };
const free: MembershipSelection = { tier: 'free_verified', periodMonths: 12 };

async function firstPostId(repo: MockRepository) {
  const page = await repo.getHomeFeed({ tab: 'for_you' });
  return page.items[0]!.id;
}

describe('expiry', () => {
  it('keeps the card but shows other people only in the safe view', async () => {
    const repo = repositoryOn();
    const me = await joinPaid(repo);
    await repo.expireMembership();

    expect(await repo.getSession()).toMatchObject({
      accessState: 'ACTIVE_MEMBER_EXPIRED',
      userId: me.id,
    });
    const profile = await repo.getMyProfile();
    expect(profile.card).toEqual(me.card);
    expect(profile.membership.status).toBe('expired');

    const page = FeedPage.parse(await repo.getHomeFeed({ tab: 'for_you' }));
    expect(page.items.length).toBeGreaterThan(0);
    for (const post of page.items) {
      expect(post.author).toEqual({
        view: 'safe',
        gender: post.author.gender,
        age: post.author.age,
        city: post.author.city,
        avatar: { kind: 'neutral' },
      });
      expect(post.reactedByMe).toBeUndefined();
    }
    await expect(repo.getHomeFeed({ tab: 'following' })).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
  });

  it('happens on its own when the period ends', async () => {
    const store = createMemoryStore();
    await joinPaid(repositoryOn(store));
    const later = repositoryOn(store, fixedClock('2026-11-01T00:00:00Z'));
    expect((await later.getSession()).accessState).toBe('ACTIVE_MEMBER_EXPIRED');
  });

  it('stays expired after a restart even when the demo clock starts earlier', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store, fixedClock('2026-09-26T15:00:00Z'));
    await joinPaid(repo);
    await repo.expireMembership();
    const restarted = repositoryOn(store);
    expect((await restarted.getSession()).accessState).toBe('ACTIVE_MEMBER_EXPIRED');
    expect((await restarted.getMyProfile()).membership.status).toBe('expired');
  });

  it('is undone by «Восстановить membership» with the original end date', async () => {
    const repo = repositoryOn();
    const me = await joinPaid(repo);
    await repo.expireMembership();
    await repo.restoreMembership();
    expect((await repo.getSession()).accessState).toBe('ACTIVE_MEMBER');
    expect((await repo.getMyProfile()).membership).toEqual(me.membership);
  });
});

describe('social actions', () => {
  it('are refused with MEMBERSHIP_EXPIRED for an expired member', async () => {
    const repo = repositoryOn();
    await joinPaid(repo);
    const postId = await firstPostId(repo);
    await repo.expireMembership();
    await expect(
      repo.setReaction({ postId, reaction: 'like', active: true }),
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_EXPIRED' });
  });

  it('are refused with UNAUTHENTICATED for a guest', async () => {
    const repo = repositoryOn();
    const postId = await firstPostId(repo);
    await expect(
      repo.setReaction({ postId, reaction: 'like', active: true }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('work for an active member and are safe to retry', async () => {
    const repo = repositoryOn();
    await joinPaid(repo);
    const before = (await repo.getHomeFeed({ tab: 'for_you' })).items[0]!;
    expect(before.reactedByMe).toBe(false);

    const liked = ReactionState.parse(
      await repo.setReaction({ postId: before.id, reaction: 'like', active: true }),
    );
    expect(liked).toEqual({
      postId: before.id,
      reactions: before.reactions + 1,
      reactedByMe: true,
    });
    expect(await repo.setReaction({ postId: before.id, reaction: 'like', active: true })).toEqual(
      liked,
    );
    const after = (await repo.getHomeFeed({ tab: 'for_you' })).items.find(
      (p) => p.id === before.id,
    );
    expect(after).toMatchObject({ reactions: before.reactions + 1, reactedByMe: true });

    expect(
      await repo.setReaction({ postId: before.id, reaction: 'like', active: false }),
    ).toMatchObject({ reactions: before.reactions, reactedByMe: false });
  });
});

describe('renewal', () => {
  it('renews a paid period from now without the Анкета', async () => {
    const repo = repositoryOn();
    const me = await joinPaid(repo);
    await repo.expireMembership();

    const renewed = MyProfile.parse(
      await repo.renewMembership({ selection: paid3, idempotencyKey: 'renew-paid-1' }),
    );
    expect(renewed.card).toEqual(me.card);
    expect(renewed.membership).toEqual({
      tier: 'paid',
      periodMonths: 3,
      status: 'active',
      endsAt: '2026-12-26T12:00:00.000Z',
    });
    expect(await repo.getSession()).toMatchObject({ accessState: 'ACTIVE_MEMBER' });
    expect(await repo.getAccessFlow()).toBeNull();
    const page = await repo.getHomeFeed({ tab: 'for_you' });
    expect(page.items.every((p) => p.author.view === 'member')).toBe(true);
  });

  it('renews free verified for twelve months', async () => {
    const repo = repositoryOn();
    await joinPaid(repo);
    await repo.expireMembership();
    const renewed = await repo.renewMembership({ selection: free, idempotencyKey: 'renew-free-1' });
    expect(renewed.membership).toMatchObject({
      tier: 'free_verified',
      periodMonths: 12,
      status: 'active',
      endsAt: '2027-09-26T12:00:00.000Z',
    });
  });

  it('takes exactly one valid period', async () => {
    const repo = repositoryOn();
    await joinPaid(repo);
    await repo.expireMembership();
    await expect(
      repo.renewMembership({
        selection: { tier: 'free_verified', periodMonths: 3 },
        idempotencyKey: 'renew-bad-1',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('retries after a network error and renews once per key', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store);
    await joinPaid(repo);
    await repo.expireMembership();

    await repo.setDemoFlags({ networkErrorOnce: true });
    const input = { selection: paid3, idempotencyKey: 'renew-retry-1' };
    await expect(repo.renewMembership(input)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const first = await repo.renewMembership(input);

    // Even a month later, the same request does not add another period.
    const later = repositoryOn(store, fixedClock('2026-10-26T12:00:00Z'));
    expect(await later.renewMembership(input)).toEqual({
      ...first,
      membership: { ...first.membership },
    });
  });

  it('is refused while the membership is active and for guests', async () => {
    const repo = repositoryOn();
    await expect(
      repo.renewMembership({ selection: paid3, idempotencyKey: 'renew-guest-1' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await joinPaid(repo);
    await expect(
      repo.renewMembership({ selection: paid3, idempotencyKey: 'renew-active-1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('state migration', () => {
  it('upgrades v4 state without a reset', async () => {
    const v4 = {
      version: 4,
      data: {
        demoFlags: { networkErrorOnce: false, offline: false, failedMessageOnce: false },
        accessFlow: null,
        payments: {},
        members: [],
        onboardings: {},
        parkedFlows: {},
      },
    };
    const repo = repositoryOn(createMemoryStore({ [storageKeys.state]: JSON.stringify(v4) }));
    expect(await repo.getSession()).toMatchObject({ accessState: 'GUEST_PREVIEW' });
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
