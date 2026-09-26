import type { FeedQuery } from '@/contracts';

import type { PlanRecord, PostRecord } from './records';
import type { PostCounters } from './shaping';

export type FeedContext = {
  now: Date;
  /** Topics the viewer cares about; empty for a guest. */
  viewerTopics: ReadonlySet<string>;
  followingIds: ReadonlySet<string>;
  counters(postId: string): PostCounters;
  authorCity(post: PostRecord): string | undefined;
  plan(id: string): PlanRecord | undefined;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function newestFirst(a: PostRecord, b: PostRecord): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function popularity(counters: PostCounters): number {
  return counters.reactions + 2 * counters.reposts + counters.commentsCount;
}

/** «Для тебя»: topic overlap with the viewer + follow bonus + recency. */
function forYouScore(post: PostRecord, ctx: FeedContext): number {
  const overlap = post.topics.filter((t) => ctx.viewerTopics.has(t)).length;
  const follow = ctx.followingIds.has(post.authorId) ? 3 : 0;
  const ageDays = (ctx.now.getTime() - new Date(post.createdAt).getTime()) / DAY_MS;
  const recency = 1 / (1 + Math.max(ageDays, 0));
  return overlap * 2 + follow + recency;
}

/** Orders and filters visible posts for a tab. Access checks happen before this. */
export function selectFeed(posts: PostRecord[], query: FeedQuery, ctx: FeedContext): PostRecord[] {
  switch (query.tab) {
    case 'for_you':
      return posts
        .map((post) => ({ post, score: forYouScore(post, ctx) }))
        .sort((a, b) => b.score - a.score || newestFirst(a.post, b.post))
        .map(({ post }) => post);

    case 'popular':
      return [...posts].sort(
        (a, b) =>
          popularity(ctx.counters(b.id)) - popularity(ctx.counters(a.id)) || newestFirst(a, b),
      );

    case 'city':
      return posts
        .filter((post) => {
          const city = post.planId ? ctx.plan(post.planId)?.city : ctx.authorCity(post);
          return city === query.city;
        })
        .sort(newestFirst);

    case 'plans':
      return posts
        .filter((post) => {
          const status = post.planId ? ctx.plan(post.planId)?.status : undefined;
          return post.type === 'plan' && (status === 'published' || status === 'matched');
        })
        .sort((a, b) => {
          const dateA = ctx.plan(a.planId ?? '')?.date ?? '';
          const dateB = ctx.plan(b.planId ?? '')?.date ?? '';
          return dateA.localeCompare(dateB) || newestFirst(a, b);
        });

    case 'following':
      return posts.filter((post) => ctx.followingIds.has(post.authorId)).sort(newestFirst);
  }
}
