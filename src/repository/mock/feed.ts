import type { QuestionKey } from '@/catalogs';
import {
  chosenFilterCount,
  type FeedContent,
  type FeedFilters,
  type FeedQuery,
  type FeedReason,
  type QuestionnaireAnswers as QuestionnaireRecord,
} from '@/contracts';

import { almatyDate, type CurrentPlan } from './plans';
import type { PostRecord } from './records';
import type { PostCounters } from './shaping';

/** What the ranking knows about the person behind a post. */
export type FeedAuthor = {
  answers?: QuestionnaireRecord;
  interests: readonly string[];
  city?: string;
};

export type PlanStats = { opens: number; responses: number; accepted: boolean };

export type FeedContext = {
  now: Date;
  /** The member asking; their own fresh posts lead «Для тебя». Absent for a guest. */
  viewerId?: string;
  /** The filter in force for «Поиск» and «Мои подписки»; an empty field is left out. */
  filters: FeedFilters;
  /** The viewer's own Анкета answers: «Поиск» puts people like them first. Absent for a guest. */
  wanted?: QuestionnaireRecord;
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

/** The first of a person's answers to a question that the viewer also gave. */
function matchedOption(
  wanted: QuestionnaireRecord,
  answers: QuestionnaireRecord,
  q: QuestionKey,
): string | undefined {
  const mine = wanted[q] as readonly string[];
  return (answers[q] as readonly string[]).find((a) => mine.includes(a));
}

/** Questions where the person shares at least one answer with the viewer. */
function matchedQuestions(
  wanted?: QuestionnaireRecord,
  answers?: QuestionnaireRecord,
): QuestionKey[] {
  if (!wanted || !answers) return [];
  return (Object.keys(wanted) as QuestionKey[]).filter(
    (q) => matchedOption(wanted, answers, q) !== undefined,
  );
}

const overlaps = (chosen: readonly string[], values: readonly string[] | undefined) =>
  chosen.length === 0 || (values ?? []).some((v) => chosen.includes(v));

/** The Almaty dates «Ближайшие даты» stand for. */
function soonDates(soon: FeedFilters['soon'], now: Date): Set<string> {
  const dates = new Set<string>();
  const weekday = new Date(`${almatyDate(now)}T12:00:00Z`).getUTCDay();
  for (const pick of soon) {
    if (pick === 'today') dates.add(almatyDate(now));
    if (pick === 'tomorrow') dates.add(almatyDate(now, 1));
    if (pick === 'week') for (let d = 0; d < 7; d++) dates.add(almatyDate(now, d));
    if (pick === 'weekend') {
      // The coming Saturday and Sunday; on a Sunday, just today.
      const toSaturday = weekday === 0 ? -1 : 6 - weekday;
      for (const d of [toSaturday, toSaturday + 1]) if (d >= 0) dates.add(almatyDate(now, d));
    }
  }
  return dates;
}

/** Whether a post passes the filter: every field with a choice, any one value within it. */
export function matchesFilters(post: PostRecord, ctx: FeedContext): boolean {
  const f = ctx.filters;
  if (chosenFilterCount(f) === 0) return true;
  const author = ctx.author(post);
  const plan = post.type === 'plan' && post.planId ? ctx.plan(post.planId) : undefined;
  if (!overlaps(f.city, [plan ? plan.city : (author.city ?? '')].filter(Boolean))) return false;
  if (!overlaps(f.interests, author.interests)) return false;
  if (!overlaps(f.topics, post.topics)) return false;
  if (!overlaps(f.intent, author.answers?.intent)) return false;
  if (!plan) return true;
  if (!overlaps(f.format, [plan.format])) return false;
  if (!overlaps(f.goal, [plan.goal])) return false;
  if (!overlaps(f.budget, [plan.budget ?? 'not_specified'])) return false;
  if (!overlaps(f.payment, [plan.paymentPolicy])) return false;
  if (f.soon.length || f.days.length) {
    const dates = soonDates(f.soon, ctx.now);
    for (const day of f.days) dates.add(day);
    if (!dates.has(plan.date)) return false;
  }
  return true;
}

/** Only an open Встреча stays in a Лента; past, cancelled, closed and agreed ones leave. */
function isActive(post: PostRecord, ctx: FeedContext): boolean {
  if (post.type !== 'plan' || !post.planId) return true;
  return ctx.plan(post.planId)?.status === 'published';
}

function ofContent(post: PostRecord, content: FeedContent): boolean {
  if (content === 'posts') return post.type !== 'plan';
  if (content === 'plans') return post.type === 'plan';
  return true;
}

/** How well a post fits «Поиск» for this viewer, and why. */
function forYou(post: PostRecord, ctx: FeedContext): { score: number; reasons: FeedReason[] } {
  const author = ctx.author(post);
  const matched = matchedQuestions(ctx.wanted, author.answers);
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
    const formats = (ctx.wanted?.dateFormat ?? []) as readonly string[];
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
    if (matched.includes(question) && author.answers && ctx.wanted) {
      const option = matchedOption(ctx.wanted, author.answers, question);
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
      const ranked = candidates
        .filter((post) => !fresh(post) && matchesFilters(post, ctx))
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
        .filter((post) => ctx.followingIds.has(post.authorId) && matchesFilters(post, ctx))
        .sort(newestFirst)
        .map((post) => ({ post }));
  }
}
