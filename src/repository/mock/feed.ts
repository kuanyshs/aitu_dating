import { habitOf, type QuestionKey } from '@/catalogs';
import {
  chosenFilterCount,
  rangeEnds,
  type FeedContent,
  type FeedFilters,
  type FeedQuery,
  type FeedReason,
  type PartialAnswers,
} from '@/contracts';

import { almatyDate, type CurrentPlan } from './plans';
import type { PostRecord } from './records';
import type { PostCounters } from './shaping';

/** What the ranking knows about the person behind a post. */
export type FeedAuthor = {
  answers?: PartialAnswers;
  city?: string;
  /** From Passport; absent only for someone the mock does not know. */
  gender?: string;
  age?: number;
};

export type PlanStats = { opens: number; responses: number; accepted: boolean };

export type FeedContext = {
  now: Date;
  /** The member asking; their own fresh posts lead «Для тебя». Absent for a guest. */
  viewerId?: string;
  /** The filter in force for «Поиск» and «Мои подписки»; an empty field is left out. */
  filters: FeedFilters;
  /** The viewer's own Анкета answers: «Поиск» puts people like them first. Absent for a guest. */
  wanted?: PartialAnswers;
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

/** The answers two people share to a question; «Свой вариант» is nobody's in common. */
function shared(
  question: 'interests' | 'intent' | 'city',
  wanted?: PartialAnswers,
  answers?: PartialAnswers,
): string[] {
  const mine = (wanted?.[question] ?? []) as readonly string[];
  const theirs = (answers?.[question] ?? []) as readonly string[];
  return theirs.filter((a) => a !== 'other' && mine.includes(a));
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

/** The questions of «Кого ищу» compared value by value with the author's answer. */
const answerFields = [
  'nationality',
  'intent',
  'familyPlans',
  'maritalStatus',
  'children',
  'wantChildren',
  'education',
  'occupation',
  'incomeSource',
  'income',
  'car',
  'housing',
  'livingWith',
  'parents',
] as const satisfies readonly QuestionKey[];

/** Lower case, «ё» as «е»: how «Свой вариант» texts are compared. */
const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(new RegExp(String.fromCharCode(0x0451), 'g'), String.fromCharCode(0x0435))
    .trim();

/** «Кого ищу»: whether the author is someone the viewer looks for. */
function matchesPartner(f: FeedFilters, author: FeedAuthor, plan?: CurrentPlan): boolean {
  const answers = author.answers ?? {};
  if (f.gender.length && !f.gender.includes(author.gender as never)) return false;
  if (f.age.length) {
    const [from, to] = rangeEnds(f.age[0]!);
    if (author.age === undefined || author.age < from || author.age > to) return false;
  }
  // Where the author lives; a Встреча also counts where it takes place.
  const places = [
    ...(answers.city ?? (author.city ? [author.city] : [])),
    ...(plan ? [plan.city] : []),
  ];
  if (f.city.length && !places.some((p) => f.city.includes(p))) return false;
  for (const field of answerFields) {
    const chosen = f[field] as readonly string[];
    if (chosen.length && !(answers[field] ?? []).some((a) => chosen.includes(a))) return false;
  }
  if (f.childrenCount.length) {
    const count = answers.childrenCount?.[0];
    const wanted = f.childrenCount[0]!;
    if (!count) return false;
    if (wanted === 'none' ? count !== 'none' : count === 'none') return false;
    if (wanted !== 'none') {
      const [from, to] = rangeEnds(wanted);
      if (Number(count) < from || Number(count) > to) return false;
    }
  }
  // Each habit chosen must match; «никогда» or «иногда» of one habit, either will do.
  for (const habit of new Set(f.habits.map(habitOf))) {
    const options = f.habits.filter((h) => habitOf(h) === habit);
    if (!(answers.habits ?? []).some((h) => options.includes(h as never))) return false;
  }
  if (f.interests.length) {
    const theirs = answers.interests ?? [];
    const own = plain(answers.interestOther?.[0] ?? '');
    const text = plain(f.interestOther[0] ?? '');
    const matched = f.interests.some((i) =>
      i === 'other'
        ? theirs.includes('other') && (!text || own.includes(text))
        : theirs.includes(i),
    );
    if (!matched) return false;
  }
  return true;
}

/** Whether a post passes the filter: every field with a choice, any one value within it. */
export function matchesFilters(post: PostRecord, ctx: FeedContext): boolean {
  const f = ctx.filters;
  if (chosenFilterCount(f) === 0) return true;
  const author = ctx.author(post);
  const plan = post.type === 'plan' && post.planId ? ctx.plan(post.planId) : undefined;
  if (!matchesPartner(f, author, plan)) return false;
  if (!overlaps(f.topics, post.topics)) return false;
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

/**
 * How well a post fits «Поиск» for this viewer, and why: shared interests first, then the
 * same Намерение, then the same place.
 */
function forYou(post: PostRecord, ctx: FeedContext): { score: number; reasons: FeedReason[] } {
  const author = ctx.author(post);
  const interests = shared('interests', ctx.wanted, author.answers);
  const intents = shared('intent', ctx.wanted, author.answers);
  const places = shared('city', ctx.wanted, author.answers);
  let score =
    interests.length * 100 +
    (intents.length ? 40 : 0) +
    (places.length ? 30 : 0) +
    (ctx.followingIds.has(post.authorId) ? 5 : 0);

  const plan = post.planId ? ctx.plan(post.planId) : undefined;
  if (plan) {
    // A nearer date lifts a Встреча, and one in a place the viewer lives in.
    const daysAway = (new Date(`${plan.date}T12:00:00Z`).getTime() - ctx.now.getTime()) / DAY_MS;
    score += Math.max(0, 14 - Math.max(daysAway, 0)) / 14;
    if ((ctx.wanted?.city ?? []).includes(plan.city)) score += 10;
  }
  const ageDays = (ctx.now.getTime() - new Date(post.createdAt).getTime()) / DAY_MS;
  score += 1 / (1 + Math.max(ageDays, 0));

  const reasons: FeedReason[] = [];
  if (interests[0]) reasons.push({ kind: 'interest', interest: interests[0] as never });
  if (intents[0]) reasons.push({ kind: 'answer', question: 'intent', option: intents[0] });
  if (reasons.length < 2 && places[0]) {
    reasons.push({ kind: 'answer', question: 'city', option: places[0] });
  }
  return { score, reasons: reasons.slice(0, 2) };
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
