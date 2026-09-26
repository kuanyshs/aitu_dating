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

/** Жалоба. A guest may report what they can see; they cannot block. */
export const CreateReportInput = z.strictObject({
  target: ReportTarget,
  reason: ReportReason,
  details: z.string().trim().max(LIMITS.reportDetails, 'too_long').optional(),
  idempotencyKey: z.string().min(8),
});
export type CreateReportInput = z.infer<typeof CreateReportInput>;

export const ReportStatus = z.enum(['created', 'reviewing', 'resolved']);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const ReportView = z.strictObject({
  id: Id,
  target: ReportTarget,
  reason: ReportReason,
  details: z.string().optional(),
  status: ReportStatus,
  createdAt: IsoDateTime,
});
export type ReportView = z.infer<typeof ReportView>;

export const ReportPage = Page(ReportView);
export type ReportPage = z.infer<typeof ReportPage>;

/** Блокировка works both ways: content, chats and new Отклики are hidden and refused. */
export const SetBlockInput = z.strictObject({ memberId: Id, active: z.boolean() });
export type SetBlockInput = z.infer<typeof SetBlockInput>;

export const BlockState = z.strictObject({ memberId: Id, blocked: z.boolean() });
export type BlockState = z.infer<typeof BlockState>;

export const BlockedPage = Page(MemberAuthorView);
export type BlockedPage = z.infer<typeof BlockedPage>;
