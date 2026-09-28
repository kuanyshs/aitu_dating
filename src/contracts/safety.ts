import { z } from 'zod';

import { Id, IsoDateTime, Page } from './common';
import { LIMITS } from './limits';
import { AuthorView } from './people';

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

/**
 * Whom a Блокировка is about: a person, or the author of a post or comment (the only
 * handle an expired member has on someone shown in the safe view). `block` names an
 * entry of «Заблокированные», whose person is no longer visible otherwise.
 */
export const BlockTarget = z.strictObject({
  type: z.enum(['user', 'post', 'comment', 'block']),
  id: Id,
});
export type BlockTarget = z.infer<typeof BlockTarget>;

/**
 * Блокировка works both ways. For both people the other one's posts, comments and
 * replies, profile and quotes are hidden (counters stay as they were); a root comment
 * that still holds others' replies reads «Комментарий скрыт». No new Контекстный чат
 * and no Отклик is possible between them (enforced by the chats and plans specs).
 * Members, expired ones too, may block; guests get UNAUTHENTICATED; oneself is CONFLICT.
 * Setting the same value again is a no-op.
 */
export const SetBlockInput = z.strictObject({ target: BlockTarget, active: z.boolean() });
export type SetBlockInput = z.infer<typeof SetBlockInput>;

export const BlockState = z.strictObject({ target: BlockTarget, blocked: z.boolean() });
export type BlockState = z.infer<typeof BlockState>;

/** An entry of «Заблокированные»: the person in the viewer's own view of them. */
export const BlockedView = z.strictObject({
  blockId: Id,
  person: AuthorView,
  createdAt: IsoDateTime,
});
export type BlockedView = z.infer<typeof BlockedView>;

export const BlockedPage = Page(BlockedView);
export type BlockedPage = z.infer<typeof BlockedPage>;
