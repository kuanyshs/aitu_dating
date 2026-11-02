import { z } from 'zod';

import { Id, IsoDateTime, Page } from './common';
import { AuthorView } from './people';

/** What the member did themselves; «Уведомления» are what others did. */
export const MyActionKind = z.enum(['reaction', 'comment', 'reply', 'repost', 'follow']);
export type MyActionKind = z.infer<typeof MyActionKind>;

export const MyActionCategory = z.enum([
  'all',
  'reactions',
  'comments',
  'replies',
  'reposts',
  'follows',
]);
export type MyActionCategory = z.infer<typeof MyActionCategory>;

export const MyAction = z.strictObject({
  id: Id,
  kind: MyActionKind,
  createdAt: IsoDateTime,
  /** The post acted on (reaction, comment, reply, repost). */
  postId: Id.optional(),
  commentId: Id.optional(),
  /** Who the post belongs to, or who was followed. */
  person: AuthorView.optional(),
  /** The member's own words (comment, reply) or the start of the post. */
  excerpt: z.string().optional(),
});
export type MyAction = z.infer<typeof MyAction>;

export const MyActionsQuery = z.strictObject({
  category: MyActionCategory,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type MyActionsQuery = z.infer<typeof MyActionsQuery>;

export const MyActionsPage = Page(MyAction);
export type MyActionsPage = z.infer<typeof MyActionsPage>;
