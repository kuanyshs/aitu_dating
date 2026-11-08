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
    const interestsOf = (p: (typeof people)[number]) => p.card.questionnaire.interests ?? [];
    const found = matchPeople(people, { kind: 'people', text: 'путешеств' }, undefined);
    expect(found.length).toBeGreaterThan(0);
    expect(
      found.every(
        (p) => interestsOf(p).includes('travel') || /путешеств/i.test(p.name + p.card.bio),
      ),
    ).toBe(true);
    // «Свой вариант» is found by its own text.
    const guitar = matchPeople(people, { kind: 'people', text: 'гитар' }, undefined);
    expect(guitar.map((p) => p.id)).toContain('m12');

    const both = matchPeople(
      people,
      { kind: 'people', interests: ['travel', 'reading'] },
      undefined,
    );
    expect(both.length).toBeGreaterThan(0);
    expect(
      both.every((p) => interestsOf(p).includes('travel') && interestsOf(p).includes('reading')),
    ).toBe(true);
  });

  it('filters by city and intent; with nothing asked, shows the viewer’s city', () => {
    const inAlmaty = matchPeople(people, { kind: 'people', city: '750000000' }, undefined);
    expect(inAlmaty.length).toBeGreaterThan(0);
    expect(inAlmaty.every((p) => p.card.questionnaire.city?.includes('750000000'))).toBe(true);
    // Someone living in two cities is found in both.
    expect(inAlmaty.map((p) => p.id)).toContain('m10');

    const marriage = matchPeople(people, { kind: 'people', intent: 'marriage' }, '710000000');
    expect(marriage.length).toBeGreaterThan(0);
    expect(marriage.every((p) => p.card.questionnaire.intent?.includes('marriage'))).toBe(true);
    expect(marriage.some((p) => p.city !== '710000000')).toBe(true);

    const abroad = matchPeople(people, { kind: 'people', city: 'KR' }, undefined);
    expect(abroad.map((p) => p.id)).toEqual(['m03']);

    const nearby = matchPeople(people, { kind: 'people' }, '710000000');
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby.every((p) => p.card.questionnaire.city?.includes('710000000'))).toBe(true);
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
