import { z } from 'zod';

import { Id, IsoDateTime, Page } from './common';
import { LIMITS } from './limits';
import { MemberAuthorView } from './people';

export const ReportReason = z.enum(['safety', 'harassment', 'spam', 'privacy', 'other']);
export type ReportReason = z.infer<typeof ReportReason>;

export const ReportTarget = z.strictObject({
  type: z.enum(['user', 'post', 'comment', 'plan', 'message']),
  id: Id,
});
export type ReportTarget = z.infer<typeof ReportTarget>;

/**
 * Жалоба. A guest may report what they can see (anonymously); they cannot block.
 * Details are optional except for «Другое»; nobody reports their own content (CONFLICT).
 * A second report by the same person on a target still under review returns the first.
 */
export const CreateReportInput = z
  .strictObject({
    target: ReportTarget,
    reason: ReportReason,
    details: z.string().trim().max(LIMITS.reportDetails, 'too_long').optional(),
    idempotencyKey: z.string().min(8),
  })
  .superRefine((input, ctx) => {
    if (input.reason === 'other' && !input.details) {
      ctx.addIssue({ code: 'custom', path: ['details'], message: 'required' });
    }
  });
export type CreateReportInput = z.infer<typeof CreateReportInput>;

export const ReportStatus = z.enum(['created', 'reviewing', 'resolved']);
export type ReportStatus = z.infer<typeof ReportStatus>;

/** Итог жалобы: the moderator's decision, present once the report is resolved. */
export const ReportOutcome = z.enum(['dismissed', 'content_removed', 'member_restricted']);
export type ReportOutcome = z.infer<typeof ReportOutcome>;

export const ReportView = z.strictObject({
  id: Id,
  target: ReportTarget,
  reason: ReportReason,
  details: z.string().optional(),
  status: ReportStatus,
  outcome: ReportOutcome.optional(),
  createdAt: IsoDateTime,
});
export type ReportView = z.infer<typeof ReportView>;

/**
 * The answer to sending a Жалоба. `alreadyReported` means the same person already has a
 * report on this target under review and this one was not added: «Вы уже пожаловались».
 */
export const ReportReceipt = z.strictObject({
  report: ReportView,
  alreadyReported: z.boolean(),
});
export type ReportReceipt = z.infer<typeof ReportReceipt>;

export const ReportPage = Page(ReportView);
export type ReportPage = z.infer<typeof ReportPage>;

/** Блокировка works both ways: content, chats and new Отклики are hidden and refused. */
export const SetBlockInput = z.strictObject({ memberId: Id, active: z.boolean() });
export type SetBlockInput = z.infer<typeof SetBlockInput>;

export const BlockState = z.strictObject({ memberId: Id, blocked: z.boolean() });
export type BlockState = z.infer<typeof BlockState>;

export const BlockedPage = Page(MemberAuthorView);
export type BlockedPage = z.infer<typeof BlockedPage>;
