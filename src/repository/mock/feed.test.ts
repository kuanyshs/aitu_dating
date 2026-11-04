import { describe, expect, it } from 'vitest';

import { emptyFeedFilters, type FeedFilters, type QuestionnaireAnswers } from '@/contracts';

import { selectFeed, type FeedAuthor, type FeedContext } from './feed';
import type { CurrentPlan } from './plans';
import type { PostRecord } from './records';

const now = new Date('2026-09-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const post = (id: string, authorId: string, age: number, extra: Partial<PostRecord> = {}) =>
  ({
    id,
    authorId,
    type: 'post',
    text: id,
    topics: [],
    createdAt: hoursAgo(age),
    ...extra,
  }) as PostRecord;

const answers = (patch: Partial<QuestionnaireAnswers> = {}): QuestionnaireAnswers => ({
  city: ['750000000'],
  intent: ['dating'],
  communication: ['messages_first'],
  pace: ['gradual'],
  firstMeeting: ['coffee_talk'],
  boundaries: ['public_place'],
  dateFormat: ['walk'],
  ...patch,
});

// m02 answers like the viewer and shares «кино»; m03 differs in everything but the city.
const authors: Record<string, FeedAuthor & { answers: QuestionnaireAnswers }> = {
  me: { answers: answers(), interests: ['cinema'], city: '750000000' },
  m02: { answers: answers(), interests: ['cinema'], city: '750000000' },
  m03: {
    answers: answers({
      intent: ['friendship'],
      communication: ['slow_pace'],
      pace: ['meet_soon'],
      firstMeeting: ['active_walk'],
      boundaries: ['respect_boundaries'],
      dateFormat: ['joint_activity'],
    }),
    interests: ['sport'],
    city: '750000000',
  },
  m04: {
    answers: answers({
      city: ['710000000'],
      intent: ['friendship'],
      communication: ['slow_pace'],
      pace: ['meet_soon'],
      firstMeeting: ['active_walk'],
      boundaries: ['respect_boundaries'],
      dateFormat: ['joint_activity'],
    }),
    interests: ['sport'],
    city: '710000000',
  },
};

const plans: Record<string, Partial<CurrentPlan>> = {
  open: {
    status: 'published',
    city: '710000000',
    date: '2026-09-27',
    format: 'coffee',
    goal: 'talk',
    budget: 'up_to_3000',
    paymentPolicy: 'each_pays',
    durationMinutes: 60,
  },
  later: {
    status: 'published',
    city: '750000000',
    date: '2026-10-03',
    format: 'walk',
    goal: 'get_acquainted',
    paymentPolicy: 'creator_pays',
    durationMinutes: 90,
  },
  shut: {
    status: 'closed',
    date: '2026-09-28',
    format: 'coffee',
    goal: 'talk',
    durationMinutes: 60,
  },
  agreed: {
    status: 'matched',
    date: '2026-09-28',
    format: 'coffee',
    goal: 'talk',
    durationMinutes: 60,
  },
  gone: {
    status: 'cancelled',
    date: '2026-09-27',
    format: 'coffee',
    goal: 'talk',
    durationMinutes: 60,
  },
  over: { status: 'past', date: '2026-09-20', format: 'coffee', goal: 'talk', durationMinutes: 60 },
};

const ctx = (viewerId: string | undefined, patch: Partial<FeedContext> = {}): FeedContext => ({
  now,
  viewerId,
  filters: emptyFeedFilters(),
  wanted: viewerId ? authors[viewerId]!.answers : undefined,
  viewerInterests: new Set(viewerId ? authors[viewerId]!.interests : []),
  followingIds: new Set(),
  withReasons: !!viewerId,
  counters: () => ({ reactions: 0, reposts: 0, commentsCount: 0 }),
  author: (p) => authors[p.authorId] ?? { interests: [] },
  plan: (id) => plans[id] as CurrentPlan | undefined,
  planStats: () => ({ opens: 0, responses: 0, accepted: false }),
  ...patch,
});

const ids = (ranked: { post: PostRecord }[]) => ranked.map((r) => r.post.id);

describe('«Поиск»', () => {
  const others = [post('far', 'm04', 1), post('city-only', 'm03', 1), post('alike', 'm02', 5)];

  it('ranks people who answered like the viewer and share interests first, and hides nobody', () => {
    expect(ids(selectFeed(others, { tab: 'for_you' }, ctx('me')))).toEqual([
      'alike',
      'city-only',
      'far',
    ]);
    expect(ids(selectFeed(others, { tab: 'for_you' }, ctx(undefined)))).toHaveLength(3);
  });

  it('gives an active member up to two reasons, a shared interest first', () => {
    const [top] = selectFeed(others, { tab: 'for_you' }, ctx('me'));
    expect(top!.reasons).toEqual([
      { kind: 'interest', interest: 'cinema' },
      { kind: 'answer', question: 'dateFormat', option: 'walk' },
    ]);
  });

  it('gives no reasons to a guest, even with a filter', () => {
    const guest = ctx(undefined, { filters: { ...emptyFeedFilters(), city: ['750000000'] } });
    expect(selectFeed(others, { tab: 'for_you' }, guest).every((r) => !r.reasons)).toBe(true);
  });

  it('puts the viewer’s posts from the last day first, then ranks them like any other', () => {
    const own = [post('mine-old', 'me', 30), post('mine-new', 'me', 3)];
    const feed = selectFeed([...others, ...own], { tab: 'for_you' }, ctx('me'));
    expect(ids(feed).slice(0, 1)).toEqual(['mine-new']);
    expect(ids(feed)).toContain('mine-old');
  });
});

describe('every Лента', () => {
  const mixed = [
    post('text', 'm02', 3),
    post('plan-open', 'm02', 2, { type: 'plan', planId: 'open' }),
    post('plan-gone', 'm02', 1, { type: 'plan', planId: 'gone' }),
    post('plan-over', 'm02', 1, { type: 'plan', planId: 'over' }),
    post('plan-shut', 'm02', 1, { type: 'plan', planId: 'shut' }),
    post('plan-agreed', 'm02', 1, { type: 'plan', planId: 'agreed' }),
  ];

  it('shows posts, Встречи or both, and only open Встречи', () => {
    for (const tab of ['for_you', 'popular', 'following'] as const) {
      const following = ctx('me', { followingIds: new Set(['m02']) });
      expect(ids(selectFeed(mixed, { tab }, following)).sort()).toEqual(['plan-open', 'text']);
      expect(ids(selectFeed(mixed, { tab, content: 'posts' }, following))).toEqual(['text']);
      expect(ids(selectFeed(mixed, { tab, content: 'plans' }, following))).toEqual(['plan-open']);
    }
  });

  it('weighs a План in «Популярное» by opens, Отклики and an accepted one', () => {
    const popular = ctx('me', {
      counters: () => ({ reactions: 4, reposts: 0, commentsCount: 0 }),
      planStats: () => ({ opens: 1, responses: 1, accepted: false }),
    });
    expect(ids(selectFeed(mixed, { tab: 'popular' }, popular))).toEqual(['text', 'plan-open']);
    const accepted = ctx('me', {
      counters: () => ({ reactions: 4, reposts: 0, commentsCount: 0 }),
      planStats: () => ({ opens: 1, responses: 1, accepted: true }),
    });
    expect(ids(selectFeed(mixed, { tab: 'popular' }, accepted))).toEqual(['plan-open', 'text']);
  });
});

describe('the one filter of «Поиск» and «Мои подписки»', () => {
  const items = [
    post('alike-text', 'm02', 5, { topics: ['thoughts'] }),
    post('sport-text', 'm03', 4, { topics: ['meetings'] }),
    post('astana-text', 'm04', 3),
    post('astana-coffee', 'm02', 2, { type: 'plan', planId: 'open', topics: ['meetings'] }),
    post('almaty-walk', 'm03', 1, { type: 'plan', planId: 'later' }),
  ];
  const run = (
    filters: Partial<FeedFilters>,
    tab: 'for_you' | 'following' | 'popular' = 'for_you',
  ) =>
    ids(
      selectFeed(
        items,
        { tab },
        ctx(undefined, {
          filters: { ...emptyFeedFilters(), ...filters },
          followingIds: new Set(['m02', 'm03', 'm04']),
        }),
      ),
    ).sort();

  it('takes a post’s place from its author and a Встреча’s from the Встреча, any one chosen', () => {
    expect(run({ city: ['710000000'] })).toEqual(['astana-coffee', 'astana-text']);
    expect(run({ city: ['710000000', '750000000'] })).toHaveLength(5);
  });

  it('matches interests and Намерения of the author and Темы of the publication', () => {
    expect(run({ interests: ['sport'] })).toEqual(['almaty-walk', 'astana-text', 'sport-text']);
    expect(run({ intent: ['friendship'] })).toEqual(['almaty-walk', 'astana-text', 'sport-text']);
    expect(run({ topics: ['meetings'] })).toEqual(['astana-coffee', 'sport-text']);
  });

  it('needs every field with a choice to match', () => {
    expect(run({ interests: ['sport'], city: ['750000000'] })).toEqual([
      'almaty-walk',
      'sport-text',
    ]);
  });

  it('narrows Встречи by format, goal, budget and who pays, and keeps the posts', () => {
    const posts = ['alike-text', 'astana-text', 'sport-text'];
    expect(run({ format: ['walk'] })).toEqual(['almaty-walk', ...posts].sort());
    expect(run({ goal: ['talk'] })).toEqual(['astana-coffee', ...posts].sort());
    expect(run({ budget: ['not_specified'] })).toEqual(['almaty-walk', ...posts].sort());
    expect(run({ payment: ['each_pays', 'creator_pays'] })).toHaveLength(5);
  });

  it('reads nearest dates from today in Almaty and single dates as given', () => {
    // 26 September 2026 is a Saturday.
    const posts = ['alike-text', 'astana-text', 'sport-text'];
    expect(run({ soon: ['tomorrow'] })).toEqual(['astana-coffee', ...posts].sort());
    expect(run({ soon: ['weekend'] })).toEqual(['astana-coffee', ...posts].sort());
    expect(run({ soon: ['today'] })).toEqual(posts);
    expect(run({ soon: ['week'] })).toEqual(['astana-coffee', ...posts].sort());
    expect(run({ days: ['2026-10-03'] })).toEqual(['almaty-walk', ...posts].sort());
    expect(run({ soon: ['today'], days: ['2026-10-03'] })).toEqual(
      ['almaty-walk', ...posts].sort(),
    );
  });

  it('works the same in «Мои подписки» and leaves «Популярное» alone', () => {
    expect(run({ city: ['710000000'] }, 'following')).toEqual(['astana-coffee', 'astana-text']);
    expect(run({ city: ['710000000'] }, 'popular')).toHaveLength(5);
  });
});
