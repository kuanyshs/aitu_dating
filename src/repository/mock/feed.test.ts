import { describe, expect, it } from 'vitest';
import { sampleAnswers } from './testAnswers';

import {
  emptyFeedFilters,
  safeFeedFilters,
  type FeedFilters,
  type QuestionnaireAnswers,
} from '@/contracts';

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
  ...sampleAnswers,
  city: ['750000000'],
  intent: ['serious_relationship'],
  interests: ['art_culture'],
  ...patch,
});

// m02 looks for the same and shares «Искусство»; m03 differs in everything but the city.
const authors: Record<string, FeedAuthor & { answers: QuestionnaireAnswers }> = {
  me: { answers: answers(), city: '750000000', gender: 'woman', age: 27 },
  m02: { answers: answers(), city: '750000000', gender: 'man', age: 34 },
  m03: {
    answers: answers({
      intent: ['friendship'],
      interests: ['sport', 'other'],
      interestOther: ['Настольный теннис'],
      children: ['live_apart'],
      childrenCount: ['2'],
      habits: ['smoking_sometimes', 'alcohol_never'],
      nationality: ['001'],
    }),
    city: '750000000',
    gender: 'woman',
    age: 30,
  },
  m04: {
    answers: answers({
      city: ['710000000', 'TR'],
      intent: ['friendship'],
      interests: ['sport'],
      habits: ['smoking_never', 'alcohol_never'],
      income: ['over_2m'],
    }),
    city: '710000000',
    gender: 'man',
    age: 41,
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
  followingIds: new Set(),
  withReasons: !!viewerId,
  counters: () => ({ reactions: 0, reposts: 0, commentsCount: 0 }),
  author: (p) => authors[p.authorId] ?? {},
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
      { kind: 'interest', interest: 'art_culture' },
      { kind: 'answer', question: 'intent', option: 'serious_relationship' },
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

describe('«Кого ищу»', () => {
  const items = [
    post('m02-text', 'm02', 4),
    post('m03-text', 'm03', 3),
    post('m04-text', 'm04', 2),
    post('m04-almaty-walk', 'm04', 1, { type: 'plan', planId: 'later' }),
    post('stranger', 'nobody', 1),
  ];
  const run = (filters: Partial<FeedFilters>) =>
    ids(
      selectFeed(
        items,
        { tab: 'for_you' },
        ctx(undefined, {
          filters: { ...emptyFeedFilters(), ...filters },
        }),
      ),
    ).sort();

  it('compares Пол and возраст from Passport, the range ends included', () => {
    expect(run({ gender: ['woman'] })).toEqual(['m03-text']);
    expect(run({ age: ['30-34'] })).toEqual(['m02-text', 'm03-text']);
    expect(run({ age: ['41-41'] })).toEqual(['m04-almaty-walk', 'm04-text']);
  });

  it('takes any place the author lives in, and for a Встреча its own place too', () => {
    expect(run({ city: ['TR'] })).toEqual(['m04-almaty-walk', 'm04-text']);
    // m04 lives in Astana and Turkey; the Встреча is in Almaty.
    expect(run({ city: ['750000000'] })).toEqual(['m02-text', 'm03-text', 'm04-almaty-walk']);
  });

  it('matches any chosen answer within a question and needs every question chosen', () => {
    expect(run({ nationality: ['001'] })).toEqual(['m03-text']);
    expect(run({ intent: ['friendship'], income: ['over_2m'] })).toEqual([
      'm04-almaty-walk',
      'm04-text',
    ]);
    // Someone who did not answer never matches a chosen question.
    expect(run({ intent: ['serious_relationship', 'friendship'] })).not.toContain('stranger');
  });

  it('reads «Нет детей» and a number of children as a range', () => {
    expect(run({ childrenCount: ['none'] })).toEqual(['m02-text', 'm04-almaty-walk', 'm04-text']);
    expect(run({ childrenCount: ['1-3'] })).toEqual(['m03-text']);
    expect(run({ childrenCount: ['3-5'] })).toEqual([]);
  });

  it('needs every habit chosen; «никогда» or «иногда» of one habit, either', () => {
    expect(run({ habits: ['smoking_never', 'alcohol_never'] })).toEqual([
      'm04-almaty-walk',
      'm04-text',
    ]);
    expect(run({ habits: ['smoking_never', 'smoking_sometimes', 'alcohol_never'] })).toEqual([
      'm03-text',
      'm04-almaty-walk',
      'm04-text',
    ]);
  });

  it('finds «Свой вариант» by its text, without case or «ё»', () => {
    expect(run({ interests: ['other'] })).toEqual(['m03-text']);
    expect(run({ interests: ['other'], interestOther: ['ТЕННИС'] })).toEqual(['m03-text']);
    expect(run({ interests: ['other'], interestOther: ['шахматы'] })).toEqual([]);
    expect(run({ interests: ['art_culture', 'other'], interestOther: ['шахматы'] })).toEqual([
      'm02-text',
    ]);
  });
});

describe('the filter in the Безопасный вид', () => {
  it('keeps only Пол, возраст and place of «Кого ищу», and every other field', () => {
    const all = {
      ...emptyFeedFilters(),
      gender: ['woman' as const],
      age: ['20-30'],
      city: ['750000000'],
      nationality: ['005'],
      income: ['over_2m' as const],
      habits: ['smoking_never' as const],
      topics: ['meetings' as const],
      format: ['walk' as const],
    };
    expect(safeFeedFilters(all)).toEqual({
      ...emptyFeedFilters(),
      gender: ['woman'],
      age: ['20-30'],
      city: ['750000000'],
      topics: ['meetings'],
      format: ['walk'],
    });
  });
});
