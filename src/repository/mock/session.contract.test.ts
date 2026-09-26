import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { CLUB_RULES_VERSION, type QuestionnaireAnswers } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';

const clock = fixedClock();

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
  return createMockRepository({ clock, latency: 0, store });
}

async function join(repo: MockRepository, candidateId: string) {
  await repo.startAccess();
  await repo.selectPassport({ candidateId });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    interests: ['coffee'],
    communicationStyle: 'short_messages',
  });
  return repo.completeOnboarding({ answers, idempotencyKey: `onboard-${candidateId}` });
}

describe('logout', () => {
  it('returns to guest mode and keeps the card, membership and identity', async () => {
    const repo = repositoryOn();
    const me = await join(repo, 'passport-1');

    const session = await repo.logout();
    expect(session).toEqual({
      accessState: 'GUEST_PREVIEW',
      roles: [],
      candidateId: 'passport-1',
      canLogin: true,
    });
    const page = await repo.getHomeFeed({ tab: 'for_you' });
    expect(page.items.every((p) => p.author.view === 'safe')).toBe(true);
    expect(
      (await repo.listCandidateStatus()).find((c) => c.candidateId === 'passport-1'),
    ).toMatchObject({
      hasCard: true,
    });

    await repo.login();
    expect(await repo.getMyProfile()).toEqual(me);
  });
});

describe('login', () => {
  it('restores active member mode without the questionnaire', async () => {
    const repo = repositoryOn();
    const me = await join(repo, 'passport-2');
    await repo.logout();

    const session = await repo.login();
    expect(session).toMatchObject({ accessState: 'ACTIVE_MEMBER', userId: me.id });
    expect(session.canLogin).toBeUndefined();
    expect(await repo.getAccessFlow()).toBeNull();
  });

  it('restores expired mode when the membership has ended', async () => {
    const store = createMemoryStore();
    await join(repositoryOn(store), 'passport-1');
    await repositoryOn(store).logout();

    const later = createMockRepository({
      clock: fixedClock('2027-10-01T00:00:00Z'),
      latency: 0,
      store,
    });
    expect(await later.login()).toMatchObject({ accessState: 'ACTIVE_MEMBER_EXPIRED' });
  });

  it('is refused for an identity without a card', async () => {
    const repo = repositoryOn();
    await expect(repo.login()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repo.getSession()).canLogin).toBeUndefined();
  });

  it('survives a restart in either mode', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store);
    await join(repo, 'passport-3');
    await repo.logout();
    expect(await repositoryOn(store).getSession()).toMatchObject({
      accessState: 'GUEST_PREVIEW',
      canLogin: true,
    });
  });
});

describe('Passport identities', () => {
  it('keeps each identity separate when switching', async () => {
    const repo = repositoryOn();
    const aidana = await join(repo, 'passport-1');

    await repo.switchCandidate('passport-2');
    expect(await repo.getSession()).toEqual({
      accessState: 'GUEST_PREVIEW',
      roles: [],
      candidateId: 'passport-2',
    });
    await expect(repo.login()).rejects.toMatchObject({ code: 'CONFLICT' });

    const timur = await join(repo, 'passport-2');
    expect(timur.name).toBe('Тимур');

    await repo.switchCandidate('passport-1');
    await repo.login();
    expect(await repo.getMyProfile()).toEqual(aidana);
  });

  it('parks an unfinished flow and restores it for the same identity', async () => {
    const repo = repositoryOn();
    await repo.startAccess();
    await repo.selectPassport({ candidateId: 'passport-3' });
    await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });

    await repo.switchCandidate('passport-1');
    expect(await repo.getAccessFlow()).toBeNull();

    await repo.switchCandidate('passport-3');
    expect(await repo.getAccessFlow()).toMatchObject({
      step: 'membership',
      candidate: { name: 'Мадина' },
    });
  });

  it('does not let a member identity go through the access flow again', async () => {
    const repo = repositoryOn();
    await join(repo, 'passport-1');
    await repo.logout();
    await repo.startAccess();
    await expect(repo.selectPassport({ candidateId: 'passport-1' })).rejects.toMatchObject({
      code: 'CONFLICT',
      fieldErrors: { candidateId: 'already_member' },
    });
  });

  it('forgets every identity on demo reset', async () => {
    const repo = repositoryOn();
    await join(repo, 'passport-1');
    await join(repo, 'passport-2').catch(() => undefined);
    await repo.resetDemo();
    expect((await repo.listCandidateStatus()).every((c) => !c.hasCard)).toBe(true);
    expect(await repo.getSession()).toEqual({ accessState: 'GUEST_PREVIEW', roles: [] });
  });
});
