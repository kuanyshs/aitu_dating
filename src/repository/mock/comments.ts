import type { CommentSort } from '@/contracts';

import type { CommentRecord } from './records';

export type Thread = { root: CommentRecord; replies: CommentRecord[] };

/**
 * Groups a post's comments into root threads (replies oldest first) and orders them:
 * «Популярные» by reactions with newer first on a tie, «Новые» newest first.
 */
export function buildThreads(
  comments: CommentRecord[],
  sort: CommentSort,
  reactionsOf: (commentId: string) => number,
): Thread[] {
  const roots = comments.filter((c) => !c.parentCommentId);
  const threads = roots.map((root) => ({
    root,
    replies: comments
      .filter((c) => c.parentCommentId === root.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
  const newestFirst = (a: Thread, b: Thread) => b.root.createdAt.localeCompare(a.root.createdAt);
  return threads.sort((a, b) =>
    sort === 'popular'
      ? reactionsOf(b.root.id) - reactionsOf(a.root.id) || newestFirst(a, b)
      : newestFirst(a, b),
  );
}
