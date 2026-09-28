import { z } from 'zod';

import { Id } from './common';
import { ReportOutcome } from './safety';

/** A moderator's decision on a member: Ограничение hides their content from everyone. */
export const ModerateMemberInput = z.strictObject({
  memberId: Id,
  decision: z.enum(['restrict', 'lift']),
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

export const ResolveReportInput = z.strictObject({
  reportId: Id,
  resolution: ReportOutcome,
});
export type ResolveReportInput = z.infer<typeof ResolveReportInput>;
