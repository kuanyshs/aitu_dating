import { z } from 'zod';

import {
  communicationStyles,
  datingIntents,
  interests,
  membershipTiers,
  questionnaire,
  type QuestionKey,
} from '@/catalogs';

import { LIMITS } from './limits';

import { Id, IsoDateTime } from './common';
import { AvatarRef, CityKey, GenderKey } from './people';

export const BIO_MAX = LIMITS.bio;
export const INTERESTS_MAX = 5;

/** Profile step of onboarding: what the member writes about themself. */
export const ProfileStepInput = z.strictObject({
  bio: z.string().trim().min(1, 'required').max(BIO_MAX, 'too_long'),
  interests: z
    .array(z.enum(interests))
    .min(1, 'required')
    .max(INTERESTS_MAX, 'too_many')
    .refine((list) => new Set(list).size === list.length, 'duplicate'),
  communicationStyle: z.enum(communicationStyles, 'required'),
});
export type ProfileStepInput = z.infer<typeof ProfileStepInput>;

/**
 * Editing one's own Карточка: the profile step's fields and, optionally, the Намерение.
 * The Намерение is also the Анкета's answer to the same question, so both change together.
 */
export const UpdateCardInput = ProfileStepInput.extend({
  intent: z.enum(datingIntents).optional(),
});
export type UpdateCardInput = z.infer<typeof UpdateCardInput>;

/** All seven single-choice answers of the Анкета, stored as catalog keys. */
export const QuestionnaireAnswers = z.strictObject({
  city: z.enum(questionnaire.city),
  intent: z.enum(questionnaire.intent),
  communication: z.enum(questionnaire.communication),
  pace: z.enum(questionnaire.pace),
  firstMeeting: z.enum(questionnaire.firstMeeting),
  boundaries: z.enum(questionnaire.boundaries),
  dateFormat: z.enum(questionnaire.dateFormat),
});
export type QuestionnaireAnswers = z.infer<typeof QuestionnaireAnswers>;

/** A draft with any subset of answers; every present answer is still a valid key. */
export const PartialAnswers = QuestionnaireAnswers.partial();
export type PartialAnswers = z.infer<typeof PartialAnswers>;

export const SaveAnswerInput = z.strictObject({
  question: z.enum(Object.keys(questionnaire) as [QuestionKey, ...QuestionKey[]]),
  answer: z.string().min(1),
});
export type SaveAnswerInput = z.infer<typeof SaveAnswerInput>;

export const CompleteOnboardingInput = z.strictObject({
  answers: PartialAnswers,
  idempotencyKey: z.string().min(8),
});
export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingInput>;

/** The member's own view of themself: Passport identity (read-only), Карточка and membership. */
export const MyProfile = z.strictObject({
  id: Id,
  name: z.string().min(1),
  age: z.number().int().min(18),
  gender: GenderKey,
  city: CityKey,
  verified: z.boolean(),
  avatar: AvatarRef,
  card: z.strictObject({
    bio: z.string(),
    intent: z.enum(datingIntents),
    interests: z.array(z.enum(interests)),
    communicationStyle: z.enum(communicationStyles),
    questionnaire: QuestionnaireAnswers,
    publishedAt: IsoDateTime,
  }),
  membership: z.strictObject({
    tier: z.enum(membershipTiers),
    periodMonths: z.number().int(),
    status: z.enum(['active', 'expired']),
    startsAt: IsoDateTime,
    endsAt: IsoDateTime,
  }),
});
export type MyProfile = z.infer<typeof MyProfile>;
