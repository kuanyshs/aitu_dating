import { z } from 'zod';

import { datingIntents, interests, topics } from '@/catalogs';

import { Page } from './common';
import { AuthorView, CityKey } from './people';
import { PlanView } from './plan';
import { PostView } from './post';
import { PublicCard } from './profile';

export const SearchKind = z.enum(['people', 'posts', 'plans']);
export type SearchKind = z.infer<typeof SearchKind>;

/**
 * Поиск. Case-insensitive, «ё» reads as «е».
 * - people (active members only): name, «О себе» and interest labels; names starting with
 *   the text first, then by name. Interests must all match. No text and no filters: the
 *   viewer's city.
 * - posts (anyone who reads): text and Тема labels, newest first; `topics` keeps posts
 *   with any of them. Text shorter than 2 characters needs `topics`.
 * Nobody hidden from the viewer shows up, and never the viewer among people.
 */
export const SearchQuery = z.strictObject({
  kind: SearchKind,
  text: z.string().trim().max(100).optional(),
  city: CityKey.optional(),
  interests: z.array(z.enum(interests)).max(5).optional(),
  intent: z.enum(datingIntents).optional(),
  topics: z.array(z.enum(topics)).max(4).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const SearchHit = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('person'), person: AuthorView, card: PublicCard.optional() }),
  z.strictObject({ kind: z.literal('post'), post: PostView }),
  z.strictObject({ kind: z.literal('plan'), plan: PlanView }),
]);
export type SearchHit = z.infer<typeof SearchHit>;

export const SearchPage = Page(SearchHit);
export type SearchPage = z.infer<typeof SearchPage>;
