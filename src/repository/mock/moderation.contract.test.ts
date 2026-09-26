import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { CLUB_RULES_VERSION, ModerationResult, type QuestionnaireAnswers } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';

const clock = fixedClock();

const answers: QuestionnaireAnswers = {
  city: 'almaty',
  intent: 'communication',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

function repositoryOn(store = createMemoryStore()) {
  return createMockRepository({ clock, latency: 0, store });
}

async function join(repo: MockRepository) {
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-2' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    interests: ['sport'],
    communicationStyle: 'short_messages',
  });
  return repo.completeOnboarding({ answers, idempotencyKey: 'onboard-mod-1' });
}

/** A seed author with posts in «Для тебя», seen from a member session. */
async function someAuthor(repo: MockRepository) {
  const page = await repo.getHomeFeed({ tab: 'for_you', limit: 50 });
  const author = page.items[0]!.author;
  if (author.view !== 'member') throw new Error('expected the full view');
  return author.id;
}

async function authorIds(repo: MockRepository) {
  const page = await repo.getHomeFeed({ tab: 'for_you', limit: 50 });
  return page.items.map((p) => (p.author.view === 'member' ? p.author.id : undefined));
}

describe('Ограничение of the current identity', () => {
  it('blocks a member and returns them to active mode when lifted', async () => {
    const repo = repositoryOn();
    const me = await join(repo);
    const postId = (await repo.getHomeFeed({ tab: 'for_you' })).items[0]!.id;

    await repo.setCurrentRestricted(true);
    expect(await repo.getSession()).toMatchObject({ accessState: 'BLOCKED', userId: me.id });
    await expect(repo.getHomeFeed({ tab: 'for_you' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      repo.setReaction({ postId, reaction: 'like', active: true }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await repo.setCurrentRestricted(false);
    expect(await repo.getSession()).toMatchObject({ accessState: 'ACTIVE_MEMBER', userId: me.id });
  });

  it('returns an expired member to expired mode', async () => {
    const repo = repositoryOn();
    await join(repo);
    await repo.expireMembership();
    await repo.setCurrentRestricted(true);
    await repo.setCurrentRestricted(false);
    expect((await repo.getSession()).accessState).toBe('ACTIVE_MEMBER_EXPIRED');
  });

  it('blocks a guest identity and survives a restart', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store);
    await repo.startAccess();
    await repo.selectPassport({ candidateId: 'passport-1' });
    await repo.setCurrentRestricted(true);
    expect((await repositoryOn(store).getSession()).accessState).toBe('BLOCKED');

    await repositoryOn(store).setCurrentRestricted(false);
    expect(await repositoryOn(store).getSession()).toMatchObject({
      accessState: 'GUEST_PREVIEW',
      candidateId: 'passport-1',
    });
  });

  it('needs a Passport identity', async () => {
    await expect(repositoryOn().setCurrentRestricted(true)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('hides the restricted member’s content from everyone', async () => {
    const store = createMemoryStore();
    const moderator = repositoryOn(store);
    await join(moderator);
    await moderator.setModeratorRole(true);
    const target = await someAuthor(moderator);
    const guestBefore = (await createGuestFeedCount(store)).length;

    await moderator.moderateMember({ memberId: target, decision: 'restrict' });
    expect(await authorIds(moderator)).not.toContain(target);
    const guestAfter = await createGuestFeedCount(store);
    expect(guestAfter.length).toBeLessThan(guestBefore);

    await moderator.moderateMember({ memberId: target, decision: 'lift' });
    expect(await authorIds(moderator)).toContain(target);
  });
});

/** The guest feed on the same backend state, without touching the member session. */
async function createGuestFeedCount(store: ReturnType<typeof createMemoryStore>) {
  const snapshot = await store.getItem(storageKeys.state);
  const guest = repositoryOn(createMemoryStore({ [storageKeys.state]: snapshot ?? '' }));
  const page = await guest.getHomeFeed({ tab: 'for_you', limit: 50 });
  return page.items;
}

describe('moderator role', () => {
  it('is required for moderation decisions', async () => {
    const repo = repositoryOn();
    await join(repo);
    const target = await someAuthor(repo);
    await expect(
      repo.moderateMember({ memberId: target, decision: 'restrict' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await repo.setModeratorRole(true);
    expect((await repo.getSession()).roles).toEqual(['member', 'moderator']);
    expect(
      ModerationResult.parse(await repo.moderateMember({ memberId: target, decision: 'restrict' })),
    ).toEqual({ memberId: target, restricted: true });

    await repo.setModeratorRole(false);
    await expect(repo.moderateMember({ memberId: target, decision: 'lift' })).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );
  });

  it('rejects an unknown member', async () => {
    const repo = repositoryOn();
    await join(repo);
    await repo.setModeratorRole(true);
    await expect(
      repo.moderateMember({ memberId: 'nobody', decision: 'restrict' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('state migration', () => {
  it('upgrades v5 state without a reset', async () => {
    const v5 = {
      version: 5,
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
      },
    };
    const repo = repositoryOn(createMemoryStore({ [storageKeys.state]: JSON.stringify(v5) }));
    expect((await repo.getSession()).accessState).toBe('GUEST_PREVIEW');
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
