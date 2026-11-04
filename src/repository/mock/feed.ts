import type { QuestionKey } from '@/catalogs';
import type {
  FeedContent,
  FeedFilters,
  FeedQuery,
  FeedReason,
  QuestionnaireAnswers as QuestionnaireRecord,
} from '@/contracts';

import type { CurrentPlan } from './plans';
import type { PostRecord } from './records';
import type { PostCounters } from './shaping';

/** What the ranking knows about the person behind a post. */
export type FeedAuthor = { answers?: QuestionnaireRecord; interests: readonly string[] };

export type PlanStats = { opens: number; responses: number; accepted: boolean };

export type FeedContext = {
  now: Date;
  /** The member asking; their own fresh posts lead «Для тебя». Absent for a guest. */
  viewerId?: string;
  /** The Фильтры ленты in force; empty lists for a question leave it out. */
  filters: FeedFilters;
  /** The viewer's interests; empty for a guest. */
  viewerInterests: ReadonlySet<string>;
  followingIds: ReadonlySet<string>;
  /** Whether to explain the picks: active members only, so no answer reaches a guest. */
  withReasons: boolean;
  counters(postId: string): PostCounters;
  author(post: PostRecord): FeedAuthor;
  plan(id: string): CurrentPlan | undefined;
  planStats(id: string): PlanStats;
};

export type RankedPost = { post: PostRecord; reasons?: FeedReason[] };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The questions that rank ahead of everything else, together with shared interests. */
const coreQuestions: QuestionKey[] = ['communication', 'pace', 'firstMeeting', 'boundaries'];
/** Order in which matched answers are offered as reasons, after a shared interest. */
const reasonOrder: QuestionKey[] = [
  'dateFormat',
  'intent',
  'communication',
  'pace',
  'firstMeeting',
  'boundaries',
  'city',
];

function newestFirst(a: PostRecord, b: PostRecord): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function popularity(counters: PostCounters): number {
  return counters.reactions + 2 * counters.reposts + counters.commentsCount;
}

/** «Популярное» for a План: opens of its card, Отклики, and an accepted one. */
export function planPopularity(stats: PlanStats): number {
  return stats.opens + 2 * stats.responses + (stats.accepted ? 5 : 0);
}

export const emptyFeedFilters = (): FeedFilters => ({
  city: [],
  intent: [],
  communication: [],
  pace: [],
  firstMeeting: [],
  boundaries: [],
  dateFormat: [],
});

/** A member's starting filters: their own answer to each question. */
export function filtersFromAnswers(answers: QuestionnaireRecord): FeedFilters {
  return {
    city: [...answers.city],
    intent: [...answers.intent],
    communication: [...answers.communication],
    pace: [...answers.pace],
    firstMeeting: [...answers.firstMeeting],
    boundaries: [...answers.boundaries],
    dateFormat: [...answers.dateFormat],
  };
}

const chosen = (filters: FeedFilters) =>
  (Object.keys(filters) as QuestionKey[]).filter((q) => filters[q].length > 0);

/** The first of a person's answers to a question that the filters ask for. */
function matchedOption(
  filters: FeedFilters,
  answers: QuestionnaireRecord,
  q: QuestionKey,
): string | undefined {
  const wanted = filters[q] as readonly string[];
  return (answers[q] as readonly string[]).find((a) => wanted.includes(a));
}

/** Questions where at least one of the person's answers is among the chosen options. */
function matchedQuestions(filters: FeedFilters, answers?: QuestionnaireRecord): QuestionKey[] {
  if (!answers) return [];
  return chosen(filters).filter((q) => matchedOption(filters, answers, q) !== undefined);
}

/** A cancelled or past План leaves every Лента. */
function isActive(post: PostRecord, ctx: FeedContext): boolean {
  if (post.type !== 'plan' || !post.planId) return true;
  const status = ctx.plan(post.planId)?.status;
  return status === 'published' || status === 'closed' || status === 'matched';
}

function ofContent(post: PostRecord, content: FeedContent): boolean {
  if (content === 'posts') return post.type !== 'plan';
  if (content === 'plans') return post.type === 'plan';
  return true;
}

/** How well a post fits «Для тебя», and why. */
function forYou(post: PostRecord, ctx: FeedContext): { score: number; reasons: FeedReason[] } {
  const author = ctx.author(post);
  const matched = matchedQuestions(ctx.filters, author.answers);
  const shared = author.interests.filter((i) => ctx.viewerInterests.has(i));
  const core = matched.filter((q) => coreQuestions.includes(q)).length + shared.length;
  const has = (q: QuestionKey) => (matched.includes(q) ? 1 : 0);
  let score =
    core * 100 +
    has('city') * 30 +
    has('intent') * 20 +
    has('dateFormat') * 10 +
    (ctx.followingIds.has(post.authorId) ? 5 : 0);

  const plan = post.planId ? ctx.plan(post.planId) : undefined;
  if (plan) {
    // A nearer date, and a format and goal the viewer looks for, lift a План.
    const daysAway = (new Date(`${plan.date}T12:00:00Z`).getTime() - ctx.now.getTime()) / DAY_MS;
    score += Math.max(0, 14 - Math.max(daysAway, 0)) / 14;
    const formats = ctx.filters.dateFormat as readonly string[];
    if (formats.includes('walk') && plan.format === 'walk') score += 5;
    if (formats.includes('joint_activity') && plan.goal === 'joint_activity') score += 5;
    if (formats.includes('short_meeting') && plan.durationMinutes <= 60) score += 5;
  }
  const ageDays = (ctx.now.getTime() - new Date(post.createdAt).getTime()) / DAY_MS;
  score += 1 / (1 + Math.max(ageDays, 0));

  const reasons: FeedReason[] = [];
  if (shared[0]) reasons.push({ kind: 'interest', interest: shared[0] as never });
  for (const question of reasonOrder) {
    if (reasons.length === 2) break;
    if (matched.includes(question) && author.answers) {
      const option = matchedOption(ctx.filters, author.answers, question);
      if (option) reasons.push({ kind: 'answer', question, option });
    }
  }
  return { score, reasons };
}

/** Orders and filters visible posts for a Лента. Access checks happen before this. */
export function selectFeed(posts: PostRecord[], query: FeedQuery, ctx: FeedContext): RankedPost[] {
  const content = query.content ?? 'all';
  const candidates = posts.filter((post) => isActive(post, ctx) && ofContent(post, content));

  switch (query.tab) {
    case 'for_you': {
      // An author finds what they just published at the top for a day; others see it ranked.
      const fresh = (post: PostRecord) =>
        post.authorId === ctx.viewerId &&
        ctx.now.getTime() - new Date(post.createdAt).getTime() < DAY_MS;
      const own = candidates.filter(fresh).sort(newestFirst);
      const filtering = chosen(ctx.filters).length > 0;
      const ranked = candidates
        .filter((post) => !fresh(post))
        .filter(
          (post) =>
            !filtering ||
            post.authorId === ctx.viewerId ||
            matchedQuestions(ctx.filters, ctx.author(post).answers).length > 0,
        )
        .map((post) => ({ post, ...forYou(post, ctx) }))
        .sort((a, b) => b.score - a.score || newestFirst(a.post, b.post));
      return [
        ...own.map((post) => ({ post })),
        ...ranked.map(({ post, reasons }) => ({
          post,
          ...(ctx.withReasons && post.authorId !== ctx.viewerId && reasons.length
            ? { reasons }
            : {}),
        })),
      ];
    }

    case 'popular': {
      const score = (post: PostRecord) =>
        post.planId
          ? planPopularity(ctx.planStats(post.planId))
          : popularity(ctx.counters(post.id));
      return [...candidates]
        .sort((a, b) => score(b) - score(a) || newestFirst(a, b))
        .map((post) => ({ post }));
    }

    case 'following':
      return candidates
        .filter((post) => ctx.followingIds.has(post.authorId))
        .sort(newestFirst)
        .map((post) => ({ post }));
  }
}
