import { z } from 'zod';

import {
  genders,
  INTEREST_OTHER_MAX,
  MAX_CHILDREN,
  meetingFormats,
  meetingGoals,
  paymentPolicies,
  planBudgets,
  questionnaire,
  topics as catalogTopics,
} from '@/catalogs';

import { NationalityCode, PlaceCode } from './people';

import { IsoDate, Page } from './common';
import { PostView } from './post';

/** The three Ленты of Главная; Планы are a kind of post in them, not a feed of their own. */
export const FeedTab = z.enum(['for_you', 'popular', 'following']);
export type FeedTab = z.infer<typeof FeedTab>;

/** What a Лента shows: everything, ordinary posts only or Планы only. */
export const FeedContent = z.enum(['all', 'posts', 'plans']);
export type FeedContent = z.infer<typeof FeedContent>;

const options = <T extends readonly [string, ...string[]]>(values: T, max = values.length) =>
  z.array(z.enum(values)).max(max);

/** The ages a person may have, as the Анкета allows them. */
export const AGE_MIN = 18;
export const AGE_MAX = 100;

/** «от … до …», both ends included: one value «25-35». */
const range = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d{1,3}-\d{1,3}$/)
    .refine((v) => v.split('-').every((n) => Number(n) >= min && Number(n) <= max), 'range');

/** The two ends of a range value, smaller first. */
export function rangeEnds(value: string): [number, number] {
  const [a, b] = value.split('-').map(Number) as [number, number];
  return a <= b ? [a, b] : [b, a];
}

/** «Ближайшие даты» of a Встреча, counted in Asia/Almaty from today. */
export const FeedSoon = z.enum(['today', 'tomorrow', 'weekend', 'week']);
export type FeedSoon = z.infer<typeof FeedSoon>;

/** How many days ahead the filter offers single dates; a Встреча is never further away. */
export const FEED_DAYS_AHEAD = 14;

/**
 * The one filter of «Поиск» and «Мои подписки». «Кого ищу» (owner's document, block 2) holds
 * the same answers as the Анкета and is compared with the author's; nothing chosen is «Все
 * варианты». Within a field any chosen value is enough, the habits excepted: there each
 * habit chosen must match. Every field with something chosen must match, and a person
 * who did not answer a question does not. Meeting fields and dates narrow Встречи only and
 * never hide ordinary posts. The content type is a device setting, not part of it.
 */
export const FeedFilters = z.strictObject({
  gender: options(genders, 1),
  /** «от … до …» лет, one value. */
  age: z.array(range(AGE_MIN, AGE_MAX)).max(1),
  nationality: z.array(NationalityCode).max(100),
  /** Where the author lives; for a Встреча its own Населённый пункт counts too. */
  city: z.array(PlaceCode).max(20),
  intent: options(questionnaire.intent),
  familyPlans: options(questionnaire.familyPlans, 1),
  maritalStatus: options(questionnaire.maritalStatus),
  children: options(questionnaire.children, 1),
  /** «Нет детей» or «от … до …», one value. */
  childrenCount: z.array(z.union([z.literal('none'), range(1, MAX_CHILDREN)])).max(1),
  wantChildren: options(questionnaire.wantChildren, 1),
  education: options(questionnaire.education),
  occupation: options(questionnaire.occupation),
  incomeSource: options(questionnaire.incomeSource),
  income: options(questionnaire.income, 1),
  car: options(questionnaire.car, 1),
  housing: options(questionnaire.housing, 1),
  livingWith: options(questionnaire.livingWith, 1),
  parents: options(questionnaire.parents),
  habits: options(questionnaire.habits),
  interests: options(questionnaire.interests),
  /** The text «Свой вариант» looks for in the author's own one. */
  interestOther: z.array(z.string().trim().min(1).max(INTEREST_OTHER_MAX)).max(1),
  /** The publication's Темы. */
  topics: options(catalogTopics),
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

/** «Кого ищу»: the fields compared with the author's Пол, возраст and Анкета. */
export const partnerFilterKeys = feedFilterKeys.filter(
  (k) => !['topics', 'format', 'goal', 'budget', 'payment', 'soon', 'days'].includes(k),
);

/**
 * What the Безопасный вид shows, the only «Кого ищу» fields a guest or an expired member
 * filters by: anything else would tell them answers they may not see.
 */
export const safeFilterKeys: readonly FeedFilterKey[] = ['gender', 'age', 'city'];

/** The filter without what a viewer in the Безопасный вид may not filter by. */
export function safeFeedFilters(filters: FeedFilters): FeedFilters {
  const result = { ...filters };
  for (const key of partnerFilterKeys) {
    if (!safeFilterKeys.includes(key)) (result as Record<string, unknown>)[key] = [];
  }
  return result;
}

/** The fields that narrow Встречи only. */
export const meetingFilterKeys: readonly FeedFilterKey[] = [
  'format',
  'goal',
  'budget',
  'payment',
  'soon',
  'days',
];

export const emptyFeedFilters = (): FeedFilters =>
  Object.fromEntries(feedFilterKeys.map((k) => [k, []])) as unknown as FeedFilters;

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

/**
 * A saved filter after its catalogs changed: every value still known is kept, field by
 * field; unknown values and fields drop out.
 */
export function keepKnownFeedFilters(old: unknown): FeedFilters {
  const parsed = FeedFilters.safeParse(old);
  if (parsed.success) return parsed.data;
  const source = (old && typeof old === 'object' ? old : {}) as Record<string, unknown>;
  const result = emptyFeedFilters() as Record<FeedFilterKey, unknown[]>;
  for (const key of feedFilterKeys) {
    const values = Array.isArray(source[key]) ? (source[key] as unknown[]) : [];
    const field = FeedFilters.shape[key];
    const item = field.element;
    const kept = [...new Set(values.filter((v) => item.safeParse(v).success))];
    result[key] = kept;
    // Respect each field's limit.
    while (!field.safeParse(result[key]).success && result[key].length) result[key].pop();
  }
  return result as FeedFilters;
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
