import { describe, expect, it } from 'vitest';

import type { QuestionnaireAnswers } from '@/contracts';

import { emptyFeedFilters, filtersFromAnswers, selectFeed, type FeedContext } from './feed';
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
  city: 'almaty',
  intent: 'dating',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
  ...patch,
});

// m02 answers like the viewer and shares «кино»; m03 differs in everything but the city.
const authors: Record<string, { answers: QuestionnaireAnswers; interests: string[] }> = {
  me: { answers: answers(), interests: ['cinema'] },
  m02: { answers: answers(), interests: ['cinema'] },
  m03: {
    answers: answers({
      intent: 'friendship',
      communication: 'slow_pace',
      pace: 'meet_soon',
      firstMeeting: 'active_walk',
      boundaries: 'respect_boundaries',
      dateFormat: 'joint_activity',
    }),
    interests: ['sport'],
  },
  m04: {
    answers: answers({
      city: 'astana',
      intent: 'friendship',
      communication: 'slow_pace',
      pace: 'meet_soon',
      firstMeeting: 'active_walk',
      boundaries: 'respect_boundaries',
      dateFormat: 'joint_activity',
    }),
    interests: ['sport'],
  },
};

const plans: Record<string, Partial<CurrentPlan>> = {
  open: {
    status: 'published',
    date: '2026-09-27',
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
  filters: viewerId ? filtersFromAnswers(authors[viewerId]!.answers) : emptyFeedFilters(),
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

describe('«Для тебя»', () => {
  const others = [post('far', 'm04', 1), post('city-only', 'm03', 1), post('alike', 'm02', 5)];

  it('ranks people with the most matching answers and shared interests first', () => {
    expect(ids(selectFeed(others, { tab: 'for_you' }, ctx('me')))).toEqual(['alike', 'city-only']);
  });

  it('leaves out people who match no chosen question, and keeps everyone without filters', () => {
    expect(ids(selectFeed(others, { tab: 'for_you' }, ctx('me')))).not.toContain('far');
    expect(ids(selectFeed(others, { tab: 'for_you' }, ctx(undefined)))).toHaveLength(3);
  });

  it('gives an active member up to two reasons, a shared interest first', () => {
    const [top] = selectFeed(others, { tab: 'for_you' }, ctx('me'));
    expect(top!.reasons).toEqual([
      { kind: 'interest', interest: 'cinema' },
      { kind: 'answer', question: 'dateFormat', option: 'walk' },
    ]);
  });

  it('gives no reasons to a guest, even with filters', () => {
    const guest = ctx(undefined, { filters: filtersFromAnswers(answers()) });
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
  ];

  it('shows posts, Планы or both, and never a cancelled or past План', () => {
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
