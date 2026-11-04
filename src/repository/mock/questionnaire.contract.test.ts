import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { CLUB_RULES_VERSION, type QuestionnaireAnswers } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { MOCK_STATE_VERSION } from './demo';

const answers: QuestionnaireAnswers = {
  city: ['103230100', '750000000'],
  intent: ['dating', 'friendship', 'communication'],
  communication: ['messages_first', 'topic_comment_first'],
  pace: ['gradual'],
  firstMeeting: ['coffee_talk', 'active_walk'],
  boundaries: ['public_place', 'agree_in_advance', 'respect_boundaries'],
  dateFormat: ['short_meeting', 'walk', 'joint_activity'],
};

async function toQuestionnaire(store = createMemoryStore()) {
  const repo = createMockRepository({ clock: fixedClock(), latency: 0, store });
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-3' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'paid', periodMonths: 1 });
  await repo.confirmPayment({ idempotencyKey: 'join-checkout' });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    interests: ['coffee'],
    communicationStyle: 'short_messages',
  });
  return repo;
}

describe('the Анкета with several options', () => {
  it('takes up to the limit of each question and publishes them', async () => {
    const repo = await toQuestionnaire();
    const me = await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-many' });
    expect(me.card.questionnaire).toEqual(answers);
    // The profile's city is the first Населённый пункт.
    expect(me.city).toBe('103230100');
  });

  it('refuses more than allowed, an empty choice and an unknown settlement', async () => {
    const repo = await toQuestionnaire();
    const field = async (question: keyof QuestionnaireAnswers, answer: string[]) =>
      repo.saveAnswer({ question, answer }).then(
        () => 'ok',
        (e: { fieldErrors?: Record<string, string> }) => e.fieldErrors?.[`answers.${question}`],
      );
    expect(
      await field('intent', ['dating', 'friendship', 'communication', 'new_experiences']),
    ).toBe('too_many');
    expect(await field('pace', ['gradual', 'meet_soon'])).toBe('too_many');
    expect(await field('dateFormat', [])).toBe('required');
    expect(await field('city', ['750000000', '710000000', '351010000'])).toBe('too_many');
    expect(await field('city', ['123'])).toBe('unknown');
    expect(await field('city', [])).toBe('ok');
  });

  it('may leave the Населённый пункт out: no city anywhere', async () => {
    const repo = await toQuestionnaire();
    const me = await repo.completeOnboarding({
      answers: { ...answers, city: [] },
      idempotencyKey: 'onboard-no-city',
    });
    expect(me.city).toBeUndefined();
  });
});

describe('saved state from before the settlements directory (v21)', () => {
  it('turns city keys into KATO codes and single answers into lists', async () => {
    const store = createMemoryStore();
    const fresh = createMockRepository({ clock: fixedClock(), latency: 0, store });
    await fresh.setDemoFlags({});
    const saved = JSON.parse((await store.getItem(storageKeys.state))!);
    const old = {
      ...saved,
      version: 21,
      data: {
        ...saved.data,
        feedFilters: {
          m01: {
            city: ['almaty', 'other'],
            intent: ['dating'],
            communication: [],
            pace: [],
            firstMeeting: [],
            boundaries: [],
            dateFormat: [],
          },
        },
        accessFlow: {
          step: 'questionnaire',
          candidateId: 'passport-3',
          answers: { city: 'other', intent: 'dating' },
        },
      },
    };
    await store.setItem(storageKeys.state, JSON.stringify(old));
    const repo = createMockRepository({
      clock: fixedClock(),
      latency: 0,
      store,
      session: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm01' },
    });
    expect((await repo.getFeedFilters()).city).toEqual(['750000000']);
    expect(MOCK_STATE_VERSION).toBe(22);
  });
});
