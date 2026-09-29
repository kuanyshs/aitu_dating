import { interestLabels, topicLabels } from '@/catalogs';
import type { SearchQuery } from '@/contracts';

import type { MemberRecord, PostRecord } from './records';

/** Lower case, «ё» as «е», single spaces: how both the text and the query are compared. */
export function normalize(value: string): string {
  // U+0451 «ё» reads as U+0435 «е».
  return value
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/\s+/g, ' ')
    .trim();
}

const hasFilters = (query: SearchQuery) =>
  !!query.city || !!query.intent || (query.interests?.length ?? 0) > 0;

/**
 * People matching the query, best first: names starting with the text, then by name.
 * Without text and filters the list falls back to the viewer's city.
 */
export function matchPeople(
  people: readonly MemberRecord[],
  query: SearchQuery,
  viewerCity: MemberRecord['city'] | undefined,
): MemberRecord[] {
  const text = normalize(query.text ?? '');
  const city = query.city ?? (!text && !hasFilters(query) ? viewerCity : undefined);
  const found = people.filter((person) => {
    if (city && person.city !== city) return false;
    if (query.intent && person.card.intent !== query.intent) return false;
    if (query.interests?.some((i) => !person.card.interests.includes(i))) return false;
    if (!text) return true;
    const haystack = [
      person.name,
      person.card.bio,
      ...person.card.interests.map((i) => interestLabels[i]),
    ].map(normalize);
    return haystack.some((field) => field.includes(text));
  });
  const starts = (person: MemberRecord) =>
    text && normalize(person.name).startsWith(text) ? 0 : 1;
  return found.sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name, 'ru'));
}

/** Posts matching the text and Темы, newest first. */
export function matchPosts(posts: readonly PostRecord[], query: SearchQuery): PostRecord[] {
  const text = normalize(query.text ?? '');
  return posts
    .filter((post) => {
      if (query.topics?.length && !post.topics.some((t) => query.topics!.includes(t))) {
        return false;
      }
      if (!text) return true;
      return [post.text, ...post.topics.map((t) => topicLabels[t])]
        .map(normalize)
        .some((field) => field.includes(text));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
