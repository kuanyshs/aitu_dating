import { z } from 'zod';

import { membershipTiers } from '@/catalogs';

import { Id, IsoDateTime } from './common';
import { PartialAnswers, ProfileStepInput } from './onboarding';
import { CityKey, GenderKey } from './people';

/** A mock Aitu Passport identity the demo user can enter as. Shown only to its owner. */
export const PassportCandidate = z.strictObject({
  id: Id,
  aituSubjectId: z.string().min(1),
  name: z.string().min(1),
  gender: GenderKey,
  age: z.number().int().min(18),
  city: CityKey,
});
export type PassportCandidate = z.infer<typeof PassportCandidate>;

/** Steps of the single access flow. UI states only; they are never an access role. */
export const AccessFlowStep = z.enum([
  'passport',
  'rules',
  'membership',
  'payment',
  'profile',
  'questionnaire',
]);
export type AccessFlowStep = z.infer<typeof AccessFlowStep>;

export const PeriodMonths = z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]);
export type PeriodMonths = z.infer<typeof PeriodMonths>;

/** Exactly one period; free verified is always twelve months. */
export const MembershipSelection = z
  .strictObject({ tier: z.enum(membershipTiers), periodMonths: PeriodMonths })
  .refine((s) => s.tier === 'paid' || s.periodMonths === 12, {
    message: 'Free verified membership is always 12 months',
    path: ['periodMonths'],
  });
export type MembershipSelection = z.infer<typeof MembershipSelection>;

export const PaymentReceipt = z.strictObject({
  reference: z.string().min(1),
  amountKzt: z.number().int().min(0),
  paidAt: IsoDateTime,
});
export type PaymentReceipt = z.infer<typeof PaymentReceipt>;

export const CLUB_RULES_VERSION = 'clubRules.v1';

/** Where the current visitor is in the access flow; null before «Вступить». */
export const AccessFlowState = z.strictObject({
  step: AccessFlowStep,
  candidate: PassportCandidate.optional(),
  rulesAcceptedVersion: z.string().optional(),
  membership: MembershipSelection.optional(),
  payment: PaymentReceipt.optional(),
  /** Onboarding draft: survives closing the flow and restarting the app. */
  profile: ProfileStepInput.optional(),
  answers: PartialAnswers.optional(),
});
export type AccessFlowState = z.infer<typeof AccessFlowState>;

export const ConfirmPaymentInput = z.strictObject({ idempotencyKey: z.string().min(8) });
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentInput>;
