import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { CLUB_RULES_VERSION, type QuestionnaireAnswers } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { MOCK_STATE_VERSION } from './demo';
import { sampleAnswers } from './testAnswers';

const answers: QuestionnaireAnswers = { ...sampleAnswers, city: ['TR', '103230100', '750000000'] };

async function toQuestionnaire(store = createMemoryStore()) {
  const repo = createMockRepository({ clock: fixedClock(), latency: 0, store });
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-3' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'paid', periodMonths: 1 });
  await repo.confirmPayment({ idempotencyKey: 'join-checkout' });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    communicationStyle: 'short_messages',
  });
  return repo;
}

type Answers = Partial<Record<keyof QuestionnaireAnswers, string[]>>;

/** The field error a page of answers gets, or «ok». */
async function saving(repo: Awaited<ReturnType<typeof toQuestionnaire>>, page: Answers) {
  return repo.saveAnswers({ answers: page }).then(
    () => 'ok',
    (e: { fieldErrors?: Record<string, string> }) => Object.values(e.fieldErrors ?? {})[0],
  );
}

describe('the Анкета «Вопросы о тебе»', () => {
  it('publishes every answer; the profile city is the first place in Kazakhstan', async () => {
    const repo = await toQuestionnaire();
    const me = await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-many' });
    expect(me.card.questionnaire).toEqual(answers);
    expect(me.card.questionnaireComplete).toBe(true);
    expect(me.city).toBe('103230100');
  });

  it('lives abroad without a city in the profile', async () => {
    const repo = await toQuestionnaire();
    const me = await repo.completeOnboarding({
      answers: { ...answers, city: ['TR'] },
      idempotencyKey: 'onboard-abroad',
    });
    expect(me.city).toBeUndefined();
  });

  it('keeps every question to its options and limits', async () => {
    const repo = await toQuestionnaire();
    expect(await saving(repo, { nationality: ['005', '001'] })).toBe('required');
    expect(await saving(repo, { nationality: ['999'] })).toBe('unknown');
    expect(await saving(repo, { city: [] })).toBe('required');
    expect(await saving(repo, { city: ['KZ'] })).toBe('unknown');
    expect(await saving(repo, { city: ['750000000', '710000000', '351010000', 'TR'] })).toBe(
      'too_many',
    );
    expect(await saving(repo, { familyPlans: ['within_2_years', 'no_plans'] })).toBe('too_many');
    expect(await saving(repo, { education: [] })).toBe('required');
    expect(await saving(repo, { childrenCount: ['21'] })).toBe('unknown');
    expect(await saving(repo, { interests: [] })).toBe('required');
    expect(await saving(repo, { habits: [] })).toBe('ok');
  });

  it('checks the answers that depend on each other', async () => {
    const repo = await toQuestionnaire();
    // «Нет» children means «Нет детей», and children mean a number.
    expect(await saving(repo, { children: ['no'], childrenCount: ['2'] })).toBe('mismatch');
    expect(await saving(repo, { children: ['live_apart'], childrenCount: ['none'] })).toBe(
      'mismatch',
    );
    expect(await saving(repo, { children: ['live_apart'], childrenCount: ['2'] })).toBe('ok');
    // «Никогда» and «иногда» of one habit exclude each other.
    expect(await saving(repo, { habits: ['smoking_never', 'smoking_sometimes'] })).toBe('conflict');
    expect(await saving(repo, { habits: ['smoking_never', 'alcohol_sometimes'] })).toBe('ok');
    // «Свой вариант» needs its text, and only then.
    expect(await saving(repo, { interests: ['other'], interestOther: [] })).toBe('required');
    expect(await saving(repo, { interests: ['travel'], interestOther: ['Шахматы'] })).toBe(
      'mismatch',
    );
    expect(await saving(repo, { interests: ['other'], interestOther: ['а'.repeat(41)] })).toBe(
      'too_long',
    );
    expect(await saving(repo, { interests: ['other'], interestOther: ['Шахматы'] })).toBe('ok');
  });

  it('allows at most ten interests', async () => {
    const repo = await toQuestionnaire();
    const eleven = [
      'sport',
      'travel',
      'reading',
      'cooking',
      'crafts',
      'science',
      'games',
      'cars',
      'health',
      'pets',
      'dance',
    ];
    expect(await saving(repo, { interests: eleven })).toBe('too_many');
    expect(await saving(repo, { interests: eleven.slice(0, 10) })).toBe('ok');
  });
});

describe('saved state from before the new Анкета (v25)', () => {
  it('keeps the places and asks the rest again; filters keep what is still known', async () => {
    const store = createMemoryStore();
    const fresh = createMockRepository({ clock: fixedClock(), latency: 0, store });
    await fresh.setDemoFlags({});
    const saved = JSON.parse((await store.getItem(storageKeys.state))!);
    const old = {
      ...saved,
      version: 25,
      data: {
        ...saved.data,
        members: [
          {
            id: 'me-passport-1',
            aituSubjectId: 'demo-subject-passport-1',
            name: 'Айдана',
            gender: 'woman',
            age: 27,
            city: '750000000',
            photoKey: 'avatar-passport-1',
            verified: true,
            card: {
              bio: 'О себе.',
              interests: ['coffee'],
              communicationStyle: 'calm_dialogue',
              questionnaire: {
                city: ['750000000'],
                intent: ['dating'],
                communication: ['messages_first'],
                pace: ['gradual'],
                firstMeeting: ['coffee_talk'],
                boundaries: ['public_place'],
                dateFormat: ['walk'],
              },
              publishedAt: '2026-09-20T12:00:00.000Z',
            },
            membership: {
              tier: 'paid',
              periodMonths: 3,
              startsAt: '2026-09-20T12:00:00.000Z',
              endsAt: '2026-12-19T12:00:00.000Z',
            },
            restricted: false,
          },
        ],
        feedFilters: {
          m01: {
            city: ['750000000'],
            interests: ['coffee'],
            topics: ['city'],
            intent: ['dating'],
            format: ['walk'],
            goal: [],
            budget: [],
            payment: [],
            soon: [],
            days: [],
          },
        },
        accessFlow: {
          step: 'questionnaire',
          candidateId: 'passport-3',
          profile: { bio: 'О себе.', interests: ['books'], communicationStyle: 'calm_dialogue' },
          answers: { city: ['351010000'], pace: ['gradual'] },
        },
      },
    };
    await store.setItem(storageKeys.state, JSON.stringify(old));

    const member = createMockRepository({
      clock: fixedClock(),
      latency: 0,
      store,
      session: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'me-passport-1' },
    });
    expect(await member.takeResetNotice()).toBeUndefined();
    const me = await member.getMyProfile();
    expect(me.card.questionnaire).toEqual({ city: ['750000000'] });
    expect(me.card.questionnaireComplete).toBe(false);
    expect(me.city).toBe('750000000');

    const m01 = createMockRepository({
      clock: fixedClock(),
      latency: 0,
      store,
      session: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm01' },
    });
    expect(await m01.getFeedFilters()).toMatchObject({
      city: ['750000000'],
      interests: [],
      topics: ['city'],
      intent: [],
      format: ['walk'],
    });

    const guest = createMockRepository({ clock: fixedClock(), latency: 0, store });
    expect(await guest.getAccessFlow()).toMatchObject({
      step: 'questionnaire',
      profile: { bio: 'О себе.', communicationStyle: 'calm_dialogue' },
      answers: { city: ['351010000'] },
    });
    expect(MOCK_STATE_VERSION).toBeGreaterThanOrEqual(26);
  });

  it('lets an incomplete Анкета be saved part by part until it is complete', async () => {
    const store = createMemoryStore();
    const repo = await toQuestionnaire(store);
    const me = await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-edit' });
    const { income: _income, ...partial } = me.card.questionnaire;
    const saved = await repo.updateMyCard({
      bio: me.card.bio,
      communicationStyle: me.card.communicationStyle,
      answers: partial,
    });
    expect(saved.card.questionnaireComplete).toBe(false);
    await expect(
      repo.updateMyCard({
        bio: me.card.bio,
        communicationStyle: me.card.communicationStyle,
        answers: { ...partial, habits: ['alcohol_never', 'alcohol_sometimes'] },
      }),
    ).rejects.toMatchObject({ fieldErrors: { 'answers.habits': 'conflict' } });
  });
});
