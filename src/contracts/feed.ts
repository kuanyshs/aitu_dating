import { z } from 'zod';

import { questionnaire } from '@/catalogs';

import { SettlementCode } from './people';

import { Page } from './common';
import { PostView } from './post';

/** The three Ленты of Главная; Планы are a kind of post in them, not a feed of their own. */
export const FeedTab = z.enum(['for_you', 'popular', 'following']);
export type FeedTab = z.infer<typeof FeedTab>;

/** What a Лента shows: everything, ordinary posts only or Планы only. */
export const FeedContent = z.enum(['all', 'posts', 'plans']);
export type FeedContent = z.infer<typeof FeedContent>;

const options = <T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values)).max(values.length);

/**
 * Фильтры ленты: the chosen options of each Анкета question. A person matches a question
 * when any of their answers is one of its options; a question with none chosen is left out.
 */
export const FeedFilters = z.strictObject({
  city: z.array(SettlementCode).max(20),
  intent: options(questionnaire.intent),
  communication: options(questionnaire.communication),
  pace: options(questionnaire.pace),
  firstMeeting: options(questionnaire.firstMeeting),
  boundaries: options(questionnaire.boundaries),
  dateFormat: options(questionnaire.dateFormat),
});
export type FeedFilters = z.infer<typeof FeedFilters>;

export const FeedQuery = z.object({
  tab: FeedTab,
  /** `all` when omitted. */
  content: FeedContent.optional(),
  /** A guest's filters for «Для тебя», kept on the device; a member's are stored with them. */
  filters: FeedFilters.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type FeedQuery = z.infer<typeof FeedQuery>;

export const FeedPage = Page(PostView);
export type FeedPage = z.infer<typeof FeedPage>;
