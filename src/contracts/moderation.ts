import { z } from 'zod';

import { Id } from './common';

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
