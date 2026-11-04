import { z } from 'zod';

import {
  communicationStyles,
  interests,
  membershipTiers,
  QUESTION_MAX,
  questionKeys,
  questionnaire,
  type QuestionKey,
} from '@/catalogs';

import { LIMITS } from './limits';

import { Id, IsoDateTime } from './common';
import { AvatarRef, GenderKey, SettlementCode } from './people';
import { PHOTO_LIMITS, PhotoRef } from './photo';

/** Up to four different profile Фото, in order. */
export const PhotoIds = z
  .array(z.string().min(1))
  .max(PHOTO_LIMITS.profile, 'too_many')
  .refine((ids) => new Set(ids).size === ids.length, 'duplicate');

export const UpdatePhotosInput = z.strictObject({ photoIds: PhotoIds });
export type UpdatePhotosInput = z.infer<typeof UpdatePhotosInput>;

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
  /** «Показывать фамилию в профиле»; off unless the member turns it on. */
  showSurname: z.boolean().optional(),
  /** Profile Фото in order, the first one main; set on the card step or later. */
  photoIds: PhotoIds.optional(),
});
export type ProfileStepInput = z.infer<typeof ProfileStepInput>;

const unique = <T>(list: T[]) => new Set(list).size === list.length;

/** One Анкета question's options: at least one, at most its limit, no repeats. */
const choices = <T extends readonly [string, ...string[]]>(values: T, max: number) =>
  z.array(z.enum(values)).min(1, 'required').max(max, 'too_many').refine(unique, 'duplicate');

/**
 * The seven answers of the Анкета. Several options are allowed where it makes sense
 * (QUESTION_MAX); the Населённый пункт takes up to two settlements, or none — «Не указывать».
 */
export const QuestionnaireAnswers = z.strictObject({
  city: z.array(SettlementCode).max(QUESTION_MAX.city, 'too_many').refine(unique, 'duplicate'),
  intent: choices(questionnaire.intent, QUESTION_MAX.intent),
  communication: choices(questionnaire.communication, QUESTION_MAX.communication),
  pace: choices(questionnaire.pace, QUESTION_MAX.pace),
  firstMeeting: choices(questionnaire.firstMeeting, QUESTION_MAX.firstMeeting),
  boundaries: choices(questionnaire.boundaries, QUESTION_MAX.boundaries),
  dateFormat: choices(questionnaire.dateFormat, QUESTION_MAX.dateFormat),
});
export type QuestionnaireAnswers = z.infer<typeof QuestionnaireAnswers>;

/** A draft with any subset of answers; every present answer is still valid. */
export const PartialAnswers = QuestionnaireAnswers.partial();
export type PartialAnswers = z.infer<typeof PartialAnswers>;

/**
 * «Редактировать анкету»: the card fields and, when given, the Анкета's answers; the
 * Намерения are the answer to its second question.
 */
export const UpdateCardInput = ProfileStepInput.extend({
  answers: QuestionnaireAnswers.optional(),
});
export type UpdateCardInput = z.infer<typeof UpdateCardInput>;

export const SaveAnswerInput = z.strictObject({
  question: z.enum(questionKeys as [QuestionKey, ...QuestionKey[]]),
  answer: z.array(z.string().min(1)),
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
  /** The owner always sees their own surname, whatever its visibility. */
  surname: z.string().min(1).optional(),
  age: z.number().int().min(18),
  gender: GenderKey,
  /** The first Населённый пункт of the Анкета; absent when not named. */
  city: SettlementCode.optional(),
  verified: z.boolean(),
  avatar: AvatarRef,
  /** Own profile Фото, the main one first; the owner sees them whatever their access. */
  photos: z.array(PhotoRef).max(PHOTO_LIMITS.profile),
  card: z.strictObject({
    bio: z.string(),
    showSurname: z.boolean(),
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
