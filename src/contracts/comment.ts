import { z } from 'zod';

import { Id, IsoDateTime, Page } from './common';
import { LIMITS } from './limits';
import { AuthorView } from './people';

/**
 * A Комментарий or, with `parentId`, an Ответ. A deleted comment keeps its place in the
 * thread with empty text so its replies stay readable («Комментарий удалён»).
 */
export const CommentView = z.strictObject({
  id: Id,
  postId: Id,
  parentId: Id.optional(),
  author: AuthorView,
  text: z.string().max(LIMITS.commentText),
  createdAt: IsoDateTime,
  reactions: z.number().int().min(0),
  deleted: z.boolean(),
  /** Present for active members: their own comment can be deleted. */
  mine: z.boolean().optional(),
  /** Present for active members: whether the viewer has liked this comment. */
  reactedByMe: z.boolean().optional(),
});
export type CommentView = z.infer<typeof CommentView>;

/** A root comment with its replies (one level deep), oldest reply first. */
export const CommentThread = z.strictObject({
  comment: CommentView,
  replies: z.array(CommentView),
});
export type CommentThread = z.infer<typeof CommentThread>;

/** «Популярные»: by reactions, newer first on a tie. «Новые»: newest first. */
export const CommentSort = z.enum(['popular', 'new']);
export type CommentSort = z.infer<typeof CommentSort>;

export const CommentQuery = z.strictObject({
  postId: Id,
  sort: CommentSort,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type CommentQuery = z.infer<typeof CommentQuery>;

export const CommentPage = Page(CommentThread);
export type CommentPage = z.infer<typeof CommentPage>;

export const CreateCommentInput = z.strictObject({
  postId: Id,
  /** Reply to a root comment; replies to replies attach to the same root. */
  parentId: Id.optional(),
  text: z.string().trim().min(1, 'required').max(LIMITS.commentText, 'too_long'),
  idempotencyKey: z.string().min(8),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

export const CommentRef = z.strictObject({ commentId: Id });
export type CommentRef = z.infer<typeof CommentRef>;

/** Like or unlike a Комментарий or an Ответ; setting the same value again is a no-op. */
export const SetCommentReactionInput = z.strictObject({ commentId: Id, active: z.boolean() });
export type SetCommentReactionInput = z.infer<typeof SetCommentReactionInput>;

export const CommentReactionState = z.strictObject({
  commentId: Id,
  reactions: z.number().int().min(0),
  reactedByMe: z.boolean(),
});
export type CommentReactionState = z.infer<typeof CommentReactionState>;
