import { z } from 'zod';

import { Id, IsoDateTime, Page } from './common';
import { LIMITS } from './limits';
import { MemberAuthorView } from './people';
import { ReportReason } from './safety';

/** How long an Ограничение lasts: it ends by itself unless it is until lifted. */
export const RestrictionTerm = z.enum(['days_7', 'days_30', 'permanent']);
export type RestrictionTerm = z.infer<typeof RestrictionTerm>;

/** Days in each term; `permanent` has no end. */
export const RESTRICTION_DAYS: Record<RestrictionTerm, number | undefined> = {
  days_7: 7,
  days_30: 30,
  permanent: undefined,
};

/** An Апелляция is sent within this many calendar days of the decision. */
export const APPEAL_WINDOW_DAYS = 7;

export const AppealStatus = z.enum(['pending', 'lifted', 'upheld']);
export type AppealStatus = z.infer<typeof AppealStatus>;

export const AppealView = z.strictObject({
  id: Id,
  text: z.string(),
  status: AppealStatus,
  createdAt: IsoDateTime,
  decidedAt: IsoDateTime.optional(),
});
export type AppealView = z.infer<typeof AppealView>;

/**
 * The restricted person's own Ограничение: why, until when (no `endsAt` — until lifted),
 * and where their one Апелляция stands.
 */
export const MyRestriction = z.strictObject({
  id: Id,
  reason: ReportReason,
  term: RestrictionTerm,
  decidedAt: IsoDateTime,
  endsAt: IsoDateTime.optional(),
  appeal: AppealView.optional(),
  /** The last moment an Апелляция is accepted. */
  appealUntil: IsoDateTime,
  canAppeal: z.boolean(),
});
export type MyRestriction = z.infer<typeof MyRestriction>;

export const CreateAppealInput = z.strictObject({
  text: z.string().trim().min(1, 'required').max(LIMITS.appealText, 'too_long'),
  idempotencyKey: z.string().min(8),
});
export type CreateAppealInput = z.infer<typeof CreateAppealInput>;

export const AppealsQuery = z.strictObject({
  status: z.enum(['pending', 'decided']).optional(),
  cursor: z.string().optional(),
});
export type AppealsQuery = z.infer<typeof AppealsQuery>;

/** An Апелляция as moderation sees it: who, which decision, and what they say. */
export const ModerationAppealView = z.strictObject({
  appeal: AppealView,
  person: MemberAuthorView,
  restriction: z.strictObject({
    reason: ReportReason,
    term: RestrictionTerm,
    decidedAt: IsoDateTime,
    endsAt: IsoDateTime.optional(),
  }),
});
export type ModerationAppealView = z.infer<typeof ModerationAppealView>;

export const ModerationAppealPage = Page(ModerationAppealView);
export type ModerationAppealPage = z.infer<typeof ModerationAppealPage>;

export const DecideAppealInput = z.strictObject({
  appealId: Id,
  decision: z.enum(['lift', 'uphold']),
});
export type DecideAppealInput = z.infer<typeof DecideAppealInput>;

export const SupportTopic = z.enum(['restriction', 'safety', 'account', 'payment', 'other']);
export type SupportTopic = z.infer<typeof SupportTopic>;

export const CreateSupportRequestInput = z.strictObject({
  topic: SupportTopic,
  text: z.string().trim().min(1, 'required').max(LIMITS.supportText, 'too_long'),
  idempotencyKey: z.string().min(8),
});
export type CreateSupportRequestInput = z.infer<typeof CreateSupportRequestInput>;

/** An Обращение в поддержку; support answers outside the app, so it is only received. */
export const SupportRequestView = z.strictObject({
  id: Id,
  topic: SupportTopic,
  text: z.string(),
  status: z.literal('received'),
  createdAt: IsoDateTime,
});
export type SupportRequestView = z.infer<typeof SupportRequestView>;

export const SupportRequestPage = Page(SupportRequestView);
export type SupportRequestPage = z.infer<typeof SupportRequestPage>;
