import { z } from 'zod';

import {
  communicationStyles,
  habitOf,
  INTEREST_OTHER_MAX,
  membershipTiers,
  QUESTION_MAX,
  questionKeys,
  questionnaire,
  type QuestionKey,
} from '@/catalogs';

import { LIMITS } from './limits';

import { Id, IsoDateTime } from './common';
import { AvatarRef, GenderKey, NationalityCode, PlaceCode, SettlementCode } from './people';
import { PHOTO_LIMITS, PhotoRef } from './photo';

/** Up to four different profile Фото, in order. */
export const PhotoIds = z
  .array(z.string().min(1))
  .max(PHOTO_LIMITS.profile, 'too_many')
  .refine((ids) => new Set(ids).size === ids.length, 'duplicate');

export const UpdatePhotosInput = z.strictObject({ photoIds: PhotoIds });
export type UpdatePhotosInput = z.infer<typeof UpdatePhotosInput>;

export const BIO_MAX = LIMITS.bio;

/**
 * Profile step of onboarding: what the member writes about themself. Interests are an
 * Анкета answer («Свободное время») since v5.
 */
export const ProfileStepInput = z.strictObject({
  bio: z.string().trim().min(1, 'required').max(BIO_MAX, 'too_long'),
  communicationStyle: z.enum(communicationStyles, 'required'),
  /** «Показывать фамилию в профиле»; off unless the member turns it on. */
  showSurname: z.boolean().optional(),
  /** Profile Фото in order, the first one main; set on the card step or later. */
  photoIds: PhotoIds.optional(),
});
export type ProfileStepInput = z.infer<typeof ProfileStepInput>;

const unique = <T>(list: T[]) => new Set(list).size === list.length;

/** One question's options: at least one (none for the habits), at most its limit, no repeats. */
const choices = <T extends readonly [string, ...string[]]>(values: T, max: number, min = 1) =>
  z.array(z.enum(values)).min(min, 'required').max(max, 'too_many').refine(unique, 'duplicate');

const answerShape = {
  nationality: z.array(NationalityCode).length(1, 'required'),
  city: z
    .array(PlaceCode)
    .min(1, 'required')
    .max(QUESTION_MAX.city, 'too_many')
    .refine(unique, 'duplicate'),
  intent: choices(questionnaire.intent, QUESTION_MAX.intent),
  familyPlans: choices(questionnaire.familyPlans, 1),
  maritalStatus: choices(questionnaire.maritalStatus, 1),
  children: choices(questionnaire.children, 1),
  childrenCount: choices(questionnaire.childrenCount, 1),
  wantChildren: choices(questionnaire.wantChildren, 1),
  education: choices(questionnaire.education, QUESTION_MAX.education),
  occupation: choices(questionnaire.occupation, QUESTION_MAX.occupation),
  incomeSource: choices(questionnaire.incomeSource, QUESTION_MAX.incomeSource),
  income: choices(questionnaire.income, 1),
  car: choices(questionnaire.car, 1),
  housing: choices(questionnaire.housing, 1),
  livingWith: choices(questionnaire.livingWith, 1),
  parents: choices(questionnaire.parents, QUESTION_MAX.parents),
  habits: choices(questionnaire.habits, QUESTION_MAX.habits, 0).refine(
    (list) => unique(list.map(habitOf)),
    'conflict',
  ),
  interests: choices(questionnaire.interests, QUESTION_MAX.interests),
  /** The text of «Свой вариант»: present exactly when it is chosen. */
  interestOther: z
    .array(z.string().trim().min(1, 'required').max(INTEREST_OTHER_MAX, 'too_long'))
    .max(1, 'too_many'),
} satisfies Record<QuestionKey, z.ZodType>;

type Answers = { [K in QuestionKey]?: string[] };

/** The rules between answers, checked where both answers are present. */
function crossCheck(answers: Answers, ctx: z.RefinementCtx) {
  const { children, childrenCount, interests, interestOther } = answers;
  if (children?.length && childrenCount?.length) {
    // «Нет» children means «Нет детей»; children mean a number.
    if ((children[0] === 'no') !== (childrenCount[0] === 'none')) {
      ctx.addIssue({ code: 'custom', path: ['childrenCount'], message: 'mismatch' });
    }
  }
  if (interests && interestOther) {
    const chosen = interests.includes('other');
    if (chosen && interestOther.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['interestOther'], message: 'required' });
    }
    if (!chosen && interestOther.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['interestOther'], message: 'mismatch' });
    }
  }
}

/** The answers of the Анкета «Вопросы о тебе» (owner's document, block 1). */
export const QuestionnaireAnswers = z.strictObject(answerShape).superRefine(crossCheck);
export type QuestionnaireAnswers = z.infer<typeof QuestionnaireAnswers>;

/** Any subset of the answers; every present answer is still valid. */
export const PartialAnswers = z.strictObject(answerShape).partial().superRefine(crossCheck);
export type PartialAnswers = z.infer<typeof PartialAnswers>;

/** Whether every question is answered: saved Анкеты from before v5 are not. */
export const isCompleteAnswers = (answers: unknown) =>
  QuestionnaireAnswers.safeParse(answers).success;

/**
 * «Редактировать анкету»: the card fields and, when given, the Анкета's answers. Answers
 * may still be incomplete for someone who filled the Анкета before v5.
 */
export const UpdateCardInput = ProfileStepInput.extend({
  answers: PartialAnswers.optional(),
});
export type UpdateCardInput = z.infer<typeof UpdateCardInput>;

/** One page of the Анкета during onboarding: the answers it holds, saved together. */
export const SaveAnswersInput = z.strictObject({
  answers: z
    .partialRecord(z.enum(questionKeys as [QuestionKey, ...QuestionKey[]]), z.array(z.string()))
    .refine((r) => Object.keys(r).length > 0, 'required'),
});
export type SaveAnswersInput = z.infer<typeof SaveAnswersInput>;

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
  /** The first Населённый пункт of Kazakhstan the Анкета names; absent for someone abroad. */
  city: SettlementCode.optional(),
  verified: z.boolean(),
  avatar: AvatarRef,
  /** Own profile Фото, the main one first; the owner sees them whatever their access. */
  photos: z.array(PhotoRef).max(PHOTO_LIMITS.profile),
  card: z.strictObject({
    bio: z.string(),
    showSurname: z.boolean(),
    communicationStyle: z.enum(communicationStyles),
    questionnaire: PartialAnswers,
    /** False until every question is answered: «Анкета обновилась». */
    questionnaireComplete: z.boolean(),
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
