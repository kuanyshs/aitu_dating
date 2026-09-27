import { describe, expect, it } from 'vitest';

import { selectFeed, type FeedContext } from './feed';
import type { PostRecord } from './records';

const now = new Date('2026-09-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const post = (id: string, authorId: string, age: number, topics: string[] = []): PostRecord =>
  ({ id, authorId, type: 'post', text: id, topics, createdAt: hoursAgo(age) }) as PostRecord;

const ctx = (viewerId?: string): FeedContext => ({
  now,
  viewerId,
  // The viewer cares about «встречи», so others' posts on it outrank a plain own post.
  viewerTopics: new Set(['meetings']),
  followingIds: new Set(),
  counters: () => ({ reactions: 0, reposts: 0, commentsCount: 0 }),
  authorCity: () => undefined,
  plan: () => undefined,
});

const ids = (posts: PostRecord[]) => posts.map((p) => p.id);

describe('«Для вас» and the author’s own posts', () => {
  const others = [post('topical', 'm02', 2, ['meetings']), post('fresh', 'm03', 1)];

  it('puts the viewer’s posts from the last day first, newest first', () => {
    const own = [post('mine-old', 'me', 20), post('mine-new', 'me', 3)];
    const feed = selectFeed([...others, ...own], { tab: 'for_you' }, ctx('me'));
    expect(ids(feed)).toEqual(['mine-new', 'mine-old', 'topical', 'fresh']);
  });

  it('ranks them like any post once they are a day old', () => {
    const feed = selectFeed([...others, post('mine', 'me', 25)], { tab: 'for_you' }, ctx('me'));
    expect(ids(feed)).toEqual(['topical', 'fresh', 'mine']);
  });

  it('pins nothing for someone else or a guest', () => {
    const all = [...others, post('mine', 'me', 3)];
    for (const viewer of ['m04', undefined]) {
      expect(ids(selectFeed(all, { tab: 'for_you' }, ctx(viewer)))[0]).toBe('topical');
    }
  });

  it('leaves the other tabs alone', () => {
    const all = [...others, post('mine', 'me', 3)];
    expect(ids(selectFeed(all, { tab: 'popular' }, ctx('me')))[0]).toBe('fresh');
  });
});
