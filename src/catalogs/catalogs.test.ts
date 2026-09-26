import { describe, expect, it } from 'vitest';

import * as keys from './keys';
import * as labels from './labels';

const pairs: [string, readonly (string | number)[], Record<string, string>][] = [
  ['cities', keys.cities, labels.cityLabels],
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
  it('has seven questions, each labelled', () => {
    expect(keys.questionKeys).toHaveLength(7);
    for (const key of keys.questionKeys) expect(labels.questionLabels[key]).toBeTruthy();
  });

  it('labels every option that is not another catalog', () => {
    for (const key of [
      'communication',
      'pace',
      'firstMeeting',
      'boundaries',
      'dateFormat',
    ] as const) {
      for (const option of keys.questionnaire[key]) {
        expect(labels.questionOptionLabels[option], `${key}.${option}`).toBeTruthy();
      }
    }
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
  it('has one free offer and one paid offer per period', () => {
    const paid = keys.membershipOffers.filter((o) => o.tier === 'paid').map((o) => o.periodMonths);
    expect(paid).toEqual([1, 3, 6, 12]);
    expect(keys.membershipOffers.filter((o) => o.tier === 'free_verified')).toHaveLength(1);
  });
});
