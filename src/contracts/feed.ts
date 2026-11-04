import { z } from 'zod';

import {
  interests as catalogInterests,
  meetingFormats,
  meetingGoals,
  paymentPolicies,
  planBudgets,
  questionnaire,
  topics as catalogTopics,
} from '@/catalogs';

import { SettlementCode } from './people';

import { IsoDate, Page } from './common';
import { PostView } from './post';

/** The three Ленты of Главная; Планы are a kind of post in them, not a feed of their own. */
export const FeedTab = z.enum(['for_you', 'popular', 'following']);
export type FeedTab = z.infer<typeof FeedTab>;

/** What a Лента shows: everything, ordinary posts only or Планы only. */
export const FeedContent = z.enum(['all', 'posts', 'plans']);
export type FeedContent = z.infer<typeof FeedContent>;

const options = <T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values)).max(values.length);

/** «Ближайшие даты» of a Встреча, counted in Asia/Almaty from today. */
export const FeedSoon = z.enum(['today', 'tomorrow', 'weekend', 'week']);
export type FeedSoon = z.infer<typeof FeedSoon>;

/** How many days ahead the filter offers single dates; a Встреча is never further away. */
export const FEED_DAYS_AHEAD = 14;

/**
 * The one filter of «Поиск» and «Мои подписки». Within a field one chosen value is enough;
 * every field with something chosen must match. Meeting fields and dates narrow Встречи
 * only and never hide ordinary posts. The content type is a device setting, not part of it.
 */
export const FeedFilters = z.strictObject({
  /** The author's Населённый пункт for a post, the Встреча's own for a Встреча. */
  city: z.array(SettlementCode).max(20),
  /** The author's interests. */
  interests: options(catalogInterests),
  /** The publication's Темы. */
  topics: options(catalogTopics),
  /** The author's Намерения. */
  intent: options(questionnaire.intent),
  format: options(meetingFormats),
  goal: options(meetingGoals),
  budget: options(planBudgets),
  payment: options(paymentPolicies),
  soon: z.array(FeedSoon).max(FeedSoon.options.length),
  days: z.array(IsoDate).max(FEED_DAYS_AHEAD),
});
export type FeedFilters = z.infer<typeof FeedFilters>;
export type FeedFilterKey = keyof FeedFilters;

export const feedFilterKeys = Object.keys(FeedFilters.shape) as FeedFilterKey[];

/** The fields that narrow Встречи only. */
export const meetingFilterKeys: readonly FeedFilterKey[] = [
  'format',
  'goal',
  'budget',
  'payment',
  'soon',
  'days',
];

export const emptyFeedFilters = (): FeedFilters => ({
  city: [],
  interests: [],
  topics: [],
  intent: [],
  format: [],
  goal: [],
  budget: [],
  payment: [],
  soon: [],
  days: [],
});

/**
 * A filter saved before v4: the Анкета questions. Only its Населённые пункты and Намерения
 * carry over; the rest start empty.
 */
export function fromLegacyFeedFilters(old: unknown): FeedFilters {
  const parsed = FeedFilters.safeParse(old);
  if (parsed.success) return parsed.data;
  const source = (old && typeof old === 'object' ? old : {}) as Record<string, unknown>;
  // Each value on its own: one unknown value never costs the others.
  const keep = <K extends 'city' | 'intent'>(key: K) => {
    const values = Array.isArray(source[key]) ? (source[key] as unknown[]) : [];
    const item = FeedFilters.shape[key].element;
    const kept = values.filter((v) => item.safeParse(v).success);
    // At most 20 places; Намерения are a short list anyway.
    return [...new Set(kept)].slice(0, 20) as FeedFilters[K];
  };
  return { ...emptyFeedFilters(), city: keep('city'), intent: keep('intent') };
}

/** How many values are chosen across all fields. */
export const chosenFilterCount = (filters?: FeedFilters | null): number =>
  filters ? feedFilterKeys.reduce((sum, key) => sum + filters[key].length, 0) : 0;

export const FeedQuery = z.object({
  tab: FeedTab,
  /** `all` when omitted. */
  content: FeedContent.optional(),
  /** A guest's filter, kept on the device; a member's is stored with them. Not for «Популярное». */
  filters: FeedFilters.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type FeedQuery = z.infer<typeof FeedQuery>;

export const FeedPage = Page(PostView);
export type FeedPage = z.infer<typeof FeedPage>;
