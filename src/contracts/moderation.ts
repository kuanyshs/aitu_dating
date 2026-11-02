import { z } from 'zod';

import { Id, Page } from './common';
import { MemberAuthorView } from './people';
import { RestrictionTerm } from './restriction';
import { ReportOutcome, ReportReason, ReportView } from './safety';

/** A moderator's decision on a member: Ограничение hides their content from everyone. */
export const ModerateMemberInput = z.strictObject({
  memberId: Id,
  decision: z.enum(['restrict', 'lift']),
  /** For `restrict`; «Другое» for 7 days when left out. */
  reason: ReportReason.optional(),
  term: RestrictionTerm.optional(),
});
export type ModerateMemberInput = z.infer<typeof ModerateMemberInput>;

export const ModerationResult = z.strictObject({
  memberId: Id,
  restricted: z.boolean(),
});
export type ModerationResult = z.infer<typeof ModerationResult>;

export const ReportsQuery = z.strictObject({
  status: z.enum(['created', 'reviewing', 'resolved']).optional(),
  cursor: z.string().optional(),
});
export type ReportsQuery = z.infer<typeof ReportsQuery>;

/** Restricting needs a term; the reason is the report's. */
export const ResolveReportInput = z
  .strictObject({
    reportId: Id,
    resolution: ReportOutcome,
    term: RestrictionTerm.optional(),
  })
  .refine((r) => r.resolution !== 'member_restricted' || !!r.term, {
    message: 'required',
    path: ['term'],
  });
export type ResolveReportInput = z.infer<typeof ResolveReportInput>;

export const ReportRef = z.strictObject({ reportId: Id });
export type ReportRef = z.infer<typeof ReportRef>;

/**
 * A Жалоба as the Очередь модерации shows it: with who is behind the target (always in
 * the full view: moderation sees through blocks and restrictions) and what they wrote.
 * `subject` is absent when the person no longer exists; `text` for a post, a comment,
 * a plan or a message. `restricted` tells whether «Ограничить участника» still makes sense.
 */
export const ModerationReportView = z.strictObject({
  report: ReportView,
  subject: z
    .strictObject({
      person: MemberAuthorView,
      text: z.string().optional(),
      restricted: z.boolean(),
    })
    .optional(),
});
export type ModerationReportView = z.infer<typeof ModerationReportView>;

export const ModerationReportPage = Page(ModerationReportView);
export type ModerationReportPage = z.infer<typeof ModerationReportPage>;
