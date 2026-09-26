import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  type AituRepository,
  type ProfileStepInput,
  type QuestionnaireAnswers,
} from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';

const clock = fixedClock();

const profile: ProfileStepInput = {
  bio: 'Люблю книги и долгие прогулки по вечернему городу.',
  interests: ['books', 'walks'],
  communicationStyle: 'calm_dialogue',
};

const answers: QuestionnaireAnswers = {
  city: 'karaganda',
  intent: 'friendship',
  communication: 'topic_comment_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

function repositoryOn(store = createMemoryStore()) {
  return createMockRepository({ clock, latency: 0, store });
}

async function toProfileStep(repo: AituRepository, candidateId = 'passport-3') {
  await repo.startAccess();
  await repo.selectPassport({ candidateId });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
}

async function toQuestionnaire(repo: AituRepository) {
  await toProfileStep(repo);
  await repo.saveProfileStep(profile);
}

describe('profile step', () => {
  it.each<[string, Partial<ProfileStepInput>, string]>([
    ['empty bio', { bio: '   ' }, 'profile.bio'],
    ['bio over 160 characters', { bio: 'а'.repeat(161) }, 'profile.bio'],
    ['no interests', { interests: [] }, 'profile.interests'],
    [
      'six interests',
      { interests: ['books', 'walks', 'coffee', 'music', 'sport', 'photo'] },
      'profile.interests',
    ],
    ['an unknown interest', { interests: ['knitting' as never] }, 'profile.interests'],
    ['no communication style', { communicationStyle: undefined }, 'profile.communicationStyle'],
  ])('rejects %s with a field error', async (_label, patch, field) => {
    const repo = repositoryOn();
    await toProfileStep(repo);
    const error = await repo
      .saveProfileStep({ ...profile, ...patch } as ProfileStepInput)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(Object.keys((error as { fieldErrors: object }).fieldErrors)).toContain(field);
  });

  it('accepts a valid profile and moves to the questionnaire', async () => {
    const repo = repositoryOn();
    await toProfileStep(repo);
    expect(await repo.saveProfileStep(profile)).toMatchObject({ step: 'questionnaire', profile });
  });

  it('is not available before membership is confirmed', async () => {
    const repo = repositoryOn();
    await repo.startAccess();
    await expect(repo.saveProfileStep(profile)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('questionnaire draft', () => {
  it('keeps answers across a restart', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store);
    await toQuestionnaire(repo);
    await repo.saveAnswer({ question: 'city', answer: 'karaganda' });
    await repo.saveAnswer({ question: 'pace', answer: 'gradual' });

    const restarted = repositoryOn(store);
    expect(await restarted.getAccessFlow()).toMatchObject({
      step: 'questionnaire',
      profile,
      answers: { city: 'karaganda', pace: 'gradual' },
    });
  });

  it('rejects an answer that is not an option of the question', async () => {
    const repo = repositoryOn();
    await toQuestionnaire(repo);
    await expect(
      repo.saveAnswer({ question: 'pace', answer: 'coffee_talk' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { 'answers.pace': 'unknown' },
    });
  });
});

describe('completeOnboarding', () => {
  it('rejects missing answers, names them, and publishes nothing', async () => {
    const repo = repositoryOn();
    await toQuestionnaire(repo);
    const { dateFormat: _omitted, pace: _alsoOmitted, ...partial } = answers;
    const error = await repo
      .completeOnboarding({ answers: partial, idempotencyKey: 'onboard-0001' })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { 'answers.dateFormat': 'required', 'answers.pace': 'required' },
    });
    expect((await repo.getSession()).accessState).toBe('GUEST_PREVIEW');
    await expect(repo.getMyProfile()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect((await repo.getAccessFlow())?.step).toBe('questionnaire');
  });

  it('publishes the card together with the last answer and makes an active member', async () => {
    const repo = repositoryOn();
    await toQuestionnaire(repo);
    const { dateFormat, ...firstSix } = answers;
    for (const [question, answer] of Object.entries(firstSix)) {
      await repo.saveAnswer({ question: question as keyof QuestionnaireAnswers, answer });
    }

    const me = await repo.completeOnboarding({
      answers: { dateFormat },
      idempotencyKey: 'onboard-0002',
    });

    expect(me).toMatchObject({
      name: 'Мадина',
      age: 29,
      city: 'karaganda',
      verified: true,
      avatar: { kind: 'synthetic' },
      card: { ...profile, intent: 'friendship', questionnaire: answers },
      membership: { tier: 'free_verified', periodMonths: 12, status: 'active' },
    });
    expect(await repo.getSession()).toEqual({
      accessState: 'ACTIVE_MEMBER',
      roles: ['member'],
      userId: me.id,
      candidateId: 'passport-3',
    });
    expect(await repo.getMyProfile()).toEqual(me);
    expect(await repo.getAccessFlow()).toBeNull();
  });

  it('switches the feed to the full member view', async () => {
    const repo = repositoryOn();
    await toQuestionnaire(repo);
    await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-0003' });
    const page = await repo.getHomeFeed({ tab: 'for_you' });
    expect(page.items.every((p) => p.author.view === 'member')).toBe(true);
    await expect(repo.getHomeFeed({ tab: 'following' })).resolves.toBeTruthy();
  });

  it('publishes once for a retried request with the same key', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store);
    await toQuestionnaire(repo);
    const first = await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-0004' });
    const again = await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-0004' });
    expect(again).toEqual(first);
    const stored = JSON.parse(store.snapshot()[storageKeys.state] ?? '{}');
    expect(stored.data.members).toHaveLength(1);
  });

  it('keeps the member after a restart', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store);
    await toQuestionnaire(repo);
    const me = await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-0005' });

    const restarted = repositoryOn(store);
    expect((await restarted.getSession()).accessState).toBe('ACTIVE_MEMBER');
    expect(await restarted.getMyProfile()).toEqual(me);
  });

  it('needs the profile step first', async () => {
    const repo = repositoryOn();
    await toProfileStep(repo);
    await expect(
      repo.completeOnboarding({ answers, idempotencyKey: 'onboard-0006' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('computes a paid membership end from the payment date', async () => {
    const repo = repositoryOn();
    await repo.startAccess();
    await repo.selectPassport({ candidateId: 'passport-1' });
    await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
    await repo.selectMembership({ tier: 'paid', periodMonths: 3 });
    await repo.confirmPayment({ idempotencyKey: 'pay-onboard-01' });
    await repo.saveProfileStep(profile);
    const me = await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-0007' });
    expect(me.membership).toMatchObject({ tier: 'paid', periodMonths: 3, status: 'active' });
    expect(me.membership.endsAt.startsWith('2026-12-26')).toBe(true);
    expect(me.city).toBe('almaty');
  });
});

describe('state migration', () => {
  it('upgrades v2 state (no members yet) without a reset', async () => {
    const v2 = {
      version: 2,
      data: {
        demoFlags: { networkErrorOnce: false, offline: false, failedMessageOnce: false },
        accessFlow: { step: 'rules', candidateId: 'passport-2' },
        payments: {},
      },
    };
    const store = createMemoryStore({ [storageKeys.state]: JSON.stringify(v2) });
    const repo = repositoryOn(store);
    expect(await repo.getAccessFlow()).toMatchObject({
      step: 'rules',
      candidate: { name: 'Тимур' },
    });
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
