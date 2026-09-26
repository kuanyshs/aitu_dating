import { z } from 'zod';

import { MembershipSelection } from './access';

/**
 * Продление: exactly one Период and, for paid tiers, the mock checkout in one request.
 * The Анкета and the card are kept; a retry with the same key renews once.
 */
export const RenewMembershipInput = z.strictObject({
  selection: MembershipSelection,
  idempotencyKey: z.string().min(8),
});
export type RenewMembershipInput = z.infer<typeof RenewMembershipInput>;
