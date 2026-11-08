import { describe, expect, it } from 'vitest';

import * as keys from './keys';
import * as labels from './labels';
import * as places from './places';

const pairs: [string, readonly (string | number)[], Record<string, string>][] = [
  ['genders', keys.genders, labels.genderLabels],
  ['interests', keys.interests, labels.interestLabels],
  ['topics', keys.topics, labels.topicLabels],
  ['communicationStyles', keys.communicationStyles, labels.communicationStyleLabels],
  ['datingIntents', keys.datingIntents, labels.datingIntentLabels],
  ['meetingFormats', keys.meetingFormats, labels.meetingFormatLabels],
  ['meetingGoals', keys.meetingGoals, labels.meetingGoalLabels],
  ['paymentPolicies', keys.paymentPolicies, labels.paymentPolicyLabels],
  ['membershipTiers', keys.membershipTiers, labels.membershipTierLabels],
  ['activityCategories', keys.activityCategories, labels.activityCategoryLabels],
];

describe.each(pairs)('%s catalog', (_name, catalogKeys, catalogLabels) => {
  it('has unique keys', () => {
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
  });

  it('has a label for every key and no extra labels', () => {
    expect(Object.keys(catalogLabels).sort()).toEqual(catalogKeys.map(String).sort());
    for (const value of Object.values(catalogLabels)) expect(value.trim()).not.toBe('');
  });
});

describe('questionnaire', () => {
  it('asks the 18 questions of the owner’s document besides Passport’s Пол and возраст', () => {
    expect(keys.questionKeys.filter((k) => k !== 'interestOther')).toHaveLength(18);
    for (const key of keys.questionKeys) {
      expect(labels.questionLabels[key]).toBeTruthy();
      expect(labels.partnerQuestionLabels[key]).toBeTruthy();
    }
  });

  it('puts every question on exactly one page', () => {
    const paged = keys.questionnairePages.flatMap((p) => [...p.questions]);
    expect([...paged].sort()).toEqual([...keys.questionKeys].sort());
  });

  it('labels every option', () => {
    for (const key of keys.choiceQuestionKeys) {
      for (const option of keys.questionnaire[key]) {
        const label = labels.answerLabel(key, option);
        expect(label, `${key}.${option}`).toBeTruthy();
        if (key !== 'childrenCount') expect(label).not.toBe(option);
      }
    }
  });

  it('pairs the habits', () => {
    expect(keys.habits.map(keys.habitOf)).toEqual([
      'smoking',
      'smoking',
      'alcohol',
      'alcohol',
      'gambling',
      'gambling',
    ]);
  });
});

describe('reference lists', () => {
  it('has the BNS nationalities, «Другая национальность» last', () => {
    expect(places.nationalities).toHaveLength(71);
    expect(places.nationalities[0]).toEqual({ code: '005', name: 'Казахи' });
    expect(places.nationalities.at(-1)).toEqual({ code: '199', name: 'Другая национальность' });
    expect(places.searchNationalities('кор').map((n) => n.name)).toEqual(['Корейцы']);
  });

  it('has every country but Kazakhstan, named in Russian', () => {
    expect(places.countries).toHaveLength(248);
    expect(places.isCountryCode('KZ')).toBe(false);
    expect(places.placeName('TR')).toBe('Турция');
    expect(places.placeName('750000000')).toBe('Алматы');
    expect(places.searchCountries('турц').map((c) => c.code)).toEqual(['TR']);
    expect(places.firstSettlement(['TR', '750000000'])).toBe('750000000');
  });
});

describe('meetingCatalog', () => {
  it('reuses the single source lists', () => {
    expect(keys.meetingCatalog.formats).toBe(keys.meetingFormats);
    expect(keys.meetingCatalog.durations).toEqual([30, 60, 90, 120]);
    expect(keys.meetingCatalog.goals).toBe(keys.meetingGoals);
    expect(keys.meetingCatalog.paymentPolicies).toBe(keys.paymentPolicies);
  });
});

describe('membership offers', () => {
  it('has only paid periods with the v3 prices', () => {
    expect(keys.membershipOffers.map((o) => [o.tier, o.periodMonths, o.priceKzt])).toEqual([
      ['paid', 1, 1990],
      ['paid', 3, 4990],
      ['paid', 6, 8490],
      ['paid', 12, 14990],
    ]);
  });
});
