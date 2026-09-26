import { z } from 'zod';

import { Id } from './common';

/** The only reaction in the product is `like`. Social actions need an active membership. */
export const SetReactionInput = z.strictObject({
  postId: Id,
  reaction: z.literal('like'),
  active: z.boolean(),
});
export type SetReactionInput = z.infer<typeof SetReactionInput>;

export const ReactionState = z.strictObject({
  postId: Id,
  reactions: z.number().int().min(0),
  reactedByMe: z.boolean(),
});
export type ReactionState = z.infer<typeof ReactionState>;
