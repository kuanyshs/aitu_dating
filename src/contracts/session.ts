import { z } from 'zod';

import { Id, IsoDateTime } from './common';

export const AccessState = z.enum([
  'GUEST_PREVIEW',
  'ACTIVE_MEMBER',
  'ACTIVE_MEMBER_EXPIRED',
  'BLOCKED',
]);
export type AccessState = z.infer<typeof AccessState>;

export const Role = z.enum(['member', 'moderator']);
export type Role = z.infer<typeof Role>;

/** Server-decided session; the client never sets `accessState` itself. */
export const Session = z.object({
  accessState: AccessState,
  roles: z.array(Role),
  userId: Id.optional(),
  expiresAt: IsoDateTime.optional(),
});
export type Session = z.infer<typeof Session>;
