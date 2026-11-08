import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { createMemoryStore } from '@/storage';
import {
  emptyFeedFilters,
  FeedPage,
  RepositoryError,
  type AituRepository,
  type FeedQuery,
  type FeedTab,
  type PostView,
} from '@/contracts';

import { createMockRepository } from './createMockRepository';
import { popularity } from './feed';
import { loadSeed } from './seed';

// Contract tests at the repository boundary. They only use the public interface, so
// the same suite can later run against the Cloud Code adapter.

const seed = loadSeed();
const clock = fixedClock();

function guestRepository(): AituRepository {
  return createMockRepository({ clock, latency: 0 });
}

function memberRepository(userId = 'm01'): AituRepository {
  return createMockRepository({
    clock,
    latency: 0,
    session: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId },
  });
}

async function allPages(repo: AituRepository, query: FeedQuery): Promise<PostView[]> {
  const items: PostView[] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 50; guard += 1) {
    const page = await repo.getHomeFeed({ ...query, cursor });
    items.push(...page.items);
    if (!page.hasMore) return items;
    cursor = page.nextCursor;
  }
  throw new Error('pagination did not terminate');
}

const FORBIDDEN_GUEST_KEYS = [
  'name',
  'id',
  'photoKey',
  'interests',
  'intent',
  'aituSubjectId',
  'bio',
];

function collectAuthorKeys(post: PostView): string[] {
  const authors = [post.author, ...(post.quoted ? [post.quoted.author] : [])];
  return authors.flatMap((a) => Object.keys(a));
}

const guestTabs: FeedQuery[] = [
  { tab: 'for_you' },
  { tab: 'popular' },
  { tab: 'for_you', content: 'plans' },
  { tab: 'popular', content: 'posts' },
];

describe('getSession', () => {
  it('starts as a guest preview with no identity', async () => {
    const session = await guestRepository().getSession();
    expect(session).toEqual({ accessState: 'GUEST_PREVIEW', roles: [] });
  });
});

describe('guest feed privacy', () => {
  it.each(guestTabs.map((q) => [`${q.tab}:${q.content ?? 'all'}`, q] as const))(
    '%s returns only safe author views',
    async (_label, query) => {
      const posts = await allPages(guestRepository(), query);
      expect(posts.length).toBeGreaterThan(0);
      for (const post of posts) {
        for (const key of collectAuthorKeys(post)) expect(FORBIDDEN_GUEST_KEYS).not.toContain(key);
        expect(post.author).toMatchObject({ view: 'safe', avatar: { kind: 'neutral' } });
        if (post.quoted) expect(post.quoted.author.view).toBe('safe');
      }
      const json = JSON.stringify(posts);
      for (const member of seed.members) {
        expect(json).not.toContain(member.name);
        expect(json).not.toContain(member.photoKey);
        expect(json).not.toContain(member.aituSubjectId);
      }
    },
  );

  it('responses validate against the contract', async () => {
    const page = await guestRepository().getHomeFeed({ tab: 'for_you' });
    expect(() => FeedPage.parse(page)).not.toThrow();
  });

  it('does not expose the exact meeting place in plan summaries', async () => {
    const posts = await allPages(guestRepository(), { tab: 'for_you', content: 'plans' });
    const json = JSON.stringify(posts);
    for (const plan of seed.plans) expect(json).not.toContain(plan.place);
  });
});

describe('member feed', () => {
  it('shows active members the full view of other members', async () => {
    const page = await memberRepository().getHomeFeed({ tab: 'for_you' });
    const author = page.items[0]?.author;
    expect(author?.view).toBe('member');
    if (author?.view === 'member') {
      expect(author.name).toBeTruthy();
      expect(author.avatar.kind).toBe('synthetic');
    }
  });

  it('shows expired members everyone else in the safe view, and themselves in full', async () => {
    const repo = createMockRepository({
      clock,
      latency: 0,
      session: { accessState: 'ACTIVE_MEMBER_EXPIRED', roles: ['member'], userId: 'm12' },
    });
    const posts = await allPages(repo, { tab: 'for_you' });
    const own = posts.filter((p) => p.mine);
    expect(own.length).toBeGreaterThan(0);
    for (const post of own) expect(post.author).toMatchObject({ view: 'member', id: 'm12' });
    for (const post of posts.filter((p) => !p.mine)) expect(post.author.view).toBe('safe');
  });

  it('limits the following tab to followed authors', async () => {
    const posts = await allPages(memberRepository('m01'), { tab: 'following' });
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.author.view === 'member' && post.author.id).toBe('m09');
    }
  });
});

describe('feed tabs', () => {
  it('rejects the following tab for guests with FORBIDDEN', async () => {
    await expect(guestRepository().getHomeFeed({ tab: 'following' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(guestRepository().getHomeFeed({ tab: 'following' })).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });

  it('shows only Планы, or only ordinary posts, by content type', async () => {
    const plans = await allPages(guestRepository(), { tab: 'popular', content: 'plans' });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => p.type === 'plan' && p.plan)).toBe(true);
    const posts = await allPages(guestRepository(), { tab: 'popular', content: 'posts' });
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => p.type !== 'plan')).toBe(true);
  });

  it('orders the popular tab by reactions + 2·reposts + comments', async () => {
    const posts = await allPages(guestRepository(), { tab: 'popular', content: 'posts' });
    const scores = posts.map(popularity);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('hides content of a restricted member everywhere', async () => {
    const restricted = seed.members.filter((m) => m.restricted).map((m) => m.id);
    const hiddenPostIds = seed.posts
      .filter((p) => restricted.includes(p.authorId))
      .map((p) => p.id);
    expect(hiddenPostIds.length).toBeGreaterThan(0);
    for (const query of guestTabs) {
      const ids = (await allPages(guestRepository(), query)).map((p) => p.id);
      for (const id of hiddenPostIds) expect(ids).not.toContain(id);
    }
  });

  it('derives counters from the stored relations', async () => {
    const posts = await allPages(guestRepository(), { tab: 'for_you' });
    const post = posts.find((p) => p.id === 'p01');
    expect(post?.reactions).toBe(seed.reactions.filter((r) => r.postId === 'p01').length);
    expect(post?.commentsCount).toBe(
      seed.comments.filter((c) => c.postId === 'p01' && !c.deleted).length,
    );
  });
});

describe('pagination', () => {
  it.each<FeedTab>(['for_you', 'popular'])(
    '%s pages do not overlap and cover the feed',
    async (tab) => {
      const repo = guestRepository();
      const first = await repo.getHomeFeed({ tab, limit: 7 });
      expect(first.items).toHaveLength(7);
      expect(first.hasMore).toBe(true);
      expect(first.nextCursor).toBeDefined();

      const all = await allPages(repo, { tab, limit: 7 });
      const ids = all.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      // One post belongs to a restricted member; only open Встречи stay in a Лента.
      const notOpen = seed.posts.filter(
        (p) => p.planId && seed.plans.find((plan) => plan.id === p.planId)?.status !== 'published',
      ).length;
      expect(ids).toHaveLength(seed.posts.length - 1 - notOpen);
    },
  );

  it('rejects a malformed cursor', async () => {
    await expect(
      guestRepository().getHomeFeed({ tab: 'for_you', cursor: 'abc' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { cursor: 'invalid' } });
  });

  it('stamps every error with a request id', async () => {
    const error = await guestRepository()
      .getHomeFeed({ tab: 'following' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).requestId).toMatch(/^mock-/);
  });
});

describe('the filter of «Поиск» and «Мои подписки»', () => {
  it('starts empty for a member, is kept with the account and narrows both feeds', async () => {
    const store = createMemoryStore();
    const open = () =>
      createMockRepository({
        clock,
        latency: 0,
        store,
        session: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm01' },
      });
    const repo = open();
    expect(await repo.getFeedFilters()).toEqual(emptyFeedFilters());

    const astana = { ...emptyFeedFilters(), city: ['710000000'] };
    expect(await repo.updateFeedFilters(astana)).toEqual(astana);
    const restarted = open();
    expect(await restarted.getFeedFilters()).toEqual(astana);

    const inAstana = (post: PostView) => {
      // One's own post of the last day leads «Поиск» whatever the filter.
      if (post.mine) return true;
      const record = seed.posts.find((p) => p.id === post.id)!;
      if (record.planId)
        return seed.plans.find((p) => p.id === record.planId)?.city === '710000000';
      return seed.members.find((m) => m.id === record.authorId)?.city === '710000000';
    };
    for (const tab of ['for_you', 'following'] as const) {
      const posts = await allPages(restarted, { tab });
      expect(posts.filter((p) => !inAstana(p)).map((p) => p.id)).toEqual([]);
    }
    const popular = await allPages(restarted, { tab: 'popular' });
    expect(popular.some((p) => !inAstana(p))).toBe(true);
  });

  it('is for members to keep; a guest sends theirs with the request', async () => {
    await expect(guestRepository().getFeedFilters()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    // A guest filters by what the Безопасный вид shows; the rest of «Кого ищу» is ignored,
    // so nobody learns an answer through the filter.
    const filters = {
      ...emptyFeedFilters(),
      gender: ['woman' as const],
      interests: ['travel' as const],
      income: ['over_2m' as const],
    };
    const posts = await allPages(guestRepository(), { tab: 'for_you', filters });
    const authorOf = (id: string) =>
      seed.members.find((m) => m.id === seed.posts.find((p) => p.id === id)!.authorId)!;
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(authorOf(post.id).gender).toBe('woman');
      expect(post.reasons).toBeUndefined();
    }
    expect(
      posts.some((p) => !authorOf(p.id).card.questionnaire.interests?.includes('travel')),
    ).toBe(true);
  });

  it('compares «Кого ищу» with the author’s answers for an active member', async () => {
    const repo = memberRepository('m02');
    await repo.updateFeedFilters({
      ...emptyFeedFilters(),
      gender: ['woman'],
      age: ['25-30'],
      interests: ['travel'],
    });
    const posts = await allPages(repo, { tab: 'for_you' });
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts.filter((p) => !p.mine)) {
      const record = seed.posts.find((p) => p.id === post.id)!;
      const author = seed.members.find((m) => m.id === record.authorId)!;
      expect(author.gender).toBe('woman');
      expect(author.age).toBeGreaterThanOrEqual(25);
      expect(author.age).toBeLessThanOrEqual(30);
      expect(author.card.questionnaire.interests).toContain('travel');
    }
  });

  it('explain the picks to an active member with up to two reasons', async () => {
    const posts = await allPages(memberRepository('m01'), { tab: 'for_you' });
    const explained = posts.filter((p) => p.reasons);
    expect(explained.length).toBeGreaterThan(0);
    for (const post of explained) expect(post.reasons!.length).toBeLessThanOrEqual(2);
    for (const post of posts.filter((p) => p.mine)) expect(post.reasons).toBeUndefined();
  });
});

describe('«Подписки» and «Популярное»', () => {
  it('lets an expired member read their Подписки in the safe view', async () => {
    const repo = createMockRepository({
      clock,
      latency: 0,
      session: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm01' },
    });
    await repo.expireMembership();
    const posts = await allPages(repo, { tab: 'following' });
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) expect(post.author.view).toBe('safe');
  });

  it('lifts a План others opened in «Популярное»', async () => {
    const store = createMemoryStore();
    const as = (userId: string) =>
      createMockRepository({
        clock,
        latency: 0,
        store,
        session: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId },
      });
    const before = await allPages(guestRepository(), { tab: 'popular', content: 'plans' });
    const last = before[before.length - 1]!;
    const planId = last.plan!.id;
    for (const id of ['m01', 'm02', 'm03', 'm04', 'm05', 'm07', 'm08', 'm09']) {
      await as(id)
        .getPlan({ planId })
        .catch(() => undefined);
    }
    const after = await allPages(as('m10'), { tab: 'popular', content: 'plans' });
    expect(after[0]!.plan!.id).toBe(planId);
  });
});
