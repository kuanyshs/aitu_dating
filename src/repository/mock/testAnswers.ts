import type { QuestionnaireAnswers } from '@/contracts';

/** A complete Анкета for tests that need someone to finish Вступление. */
export const sampleAnswers: QuestionnaireAnswers = {
  nationality: ['005'],
  city: ['750000000'],
  intent: ['serious_relationship'],
  familyPlans: ['within_5_years'],
  maritalStatus: ['never_married'],
  children: ['no'],
  childrenCount: ['none'],
  wantChildren: ['later'],
  education: ['bachelor'],
  occupation: ['employed'],
  incomeSource: ['salary'],
  income: ['250k_400k'],
  car: ['no'],
  housing: ['rent'],
  livingWith: ['alone'],
  parents: ['discussable'],
  habits: ['smoking_never'],
  interests: ['travel'],
  interestOther: [],
};
