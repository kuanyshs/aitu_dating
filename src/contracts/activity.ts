import { z } from 'zod';

import { activityCategories } from '@/catalogs';

import { Id, IsoDateTime, Page } from './common';
import { AuthorView } from './people';

export const ActivityKind = z.enum([
  'follow',
  'comment',
  'reply',
  'mention',
  'reaction',
  'repost',
  'plan_response',
  'response_accepted',
  'response_declined',
  'membership_expiring',
  'system',
]);
export type ActivityKind = z.infer<typeof ActivityKind>;

/** An Активность event. Expired members get actors in the safe view only. */
export const ActivityItem = z.strictObject({
  id: Id,
  kind: ActivityKind,
  createdAt: IsoDateTime,
  actor: AuthorView.optional(),
  postId: Id.optional(),
  commentId: Id.optional(),
  planId: Id.optional(),
  chatId: Id.optional(),
  read: z.boolean(),
});
export type ActivityItem = z.infer<typeof ActivityItem>;

export const ActivityQuery = z.strictObject({
  category: z.enum(activityCategories),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;

export const ActivityPage = Page(ActivityItem);
export type ActivityPage = z.infer<typeof ActivityPage>;

/** When the member last opened «Активность»: everything up to it reads as seen. */
export const ActivitySeen = z.strictObject({ seenAt: IsoDateTime });
export type ActivitySeen = z.infer<typeof ActivitySeen>;
