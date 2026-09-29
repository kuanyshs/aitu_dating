import { describe, expect, it } from 'vitest';

import { loadSeed } from './seed';
import { matchPeople, matchPosts, normalize } from './search';

const seed = loadSeed();
const people = seed.members.filter((m) => !m.restricted);

describe('normalize', () => {
  it('ignores case, reads «ё» as «е» and squeezes spaces', () => {
    expect(normalize('  Ёлка   ЗЕЛЁНАЯ ')).toBe('елка зеленая');
  });
});

describe('matchPeople', () => {
  it('finds a name from its middle, whatever the case', () => {
    const someone = people[0]!;
    const part = someone.name.slice(1, 4).toUpperCase();
    expect(matchPeople(people, { kind: 'people', text: part }, undefined)).toContainEqual(someone);
  });

  it('puts names starting with the text first, then goes by name', () => {
    const someone = people[0]!;
    const prefix = someone.name.slice(0, 2);
    const found = matchPeople(people, { kind: 'people', text: prefix }, undefined);
    const starting = found.filter((p) => normalize(p.name).startsWith(normalize(prefix)));
    expect(found.slice(0, starting.length)).toEqual(starting);
    const names = starting.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')));
  });

  it('matches interests by their label and needs all the chosen ones', () => {
    const found = matchPeople(people, { kind: 'people', text: 'кофе' }, undefined);
    expect(found.length).toBeGreaterThan(0);
    expect(
      found.every((p) => p.card.interests.includes('coffee') || /кофе/i.test(p.name + p.card.bio)),
    ).toBe(true);

    const both = matchPeople(people, { kind: 'people', interests: ['coffee', 'books'] }, undefined);
    expect(
      both.every((p) => p.card.interests.includes('coffee') && p.card.interests.includes('books')),
    ).toBe(true);
  });

  it('filters by city and intent; with nothing asked, shows the viewer’s city', () => {
    const inAlmaty = matchPeople(people, { kind: 'people', city: 'almaty' }, undefined);
    expect(inAlmaty.length).toBeGreaterThan(0);
    expect(inAlmaty.every((p) => p.city === 'almaty')).toBe(true);

    const dating = matchPeople(people, { kind: 'people', intent: 'dating' }, 'astana');
    expect(dating.every((p) => p.card.intent === 'dating')).toBe(true);
    expect(dating.some((p) => p.city !== 'astana')).toBe(true);

    const nearby = matchPeople(people, { kind: 'people' }, 'astana');
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby.every((p) => p.city === 'astana')).toBe(true);
  });
});

describe('matchPosts', () => {
  it('finds text and Темы, newest first', () => {
    const byTopic = matchPosts(seed.posts, { kind: 'posts', topics: ['meetings'] });
    expect(byTopic.length).toBeGreaterThan(0);
    expect(byTopic.every((p) => p.topics.includes('meetings'))).toBe(true);
    const dates = byTopic.map((p) => p.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());

    // A Тема's label is searchable as text.
    const byLabel = matchPosts(seed.posts, { kind: 'posts', text: 'встречи' });
    expect(byLabel.map((p) => p.id)).toEqual(expect.arrayContaining(byTopic.map((p) => p.id)));
  });

  it('reads «ё» as «е» in the posts too', () => {
    const post = seed.posts.find((p) => /е/.test(p.text))!;
    const word = post.text.split(' ').find((w) => w.includes('е') && w.length > 3)!;
    const withYo = word.replace('е', 'ё');
    expect(matchPosts(seed.posts, { kind: 'posts', text: withYo }).map((p) => p.id)).toContain(
      post.id,
    );
  });
});
