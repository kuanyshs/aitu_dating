import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
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
  { tab: 'plans' },
  { tab: 'city', city: 'almaty' },
  { tab: 'city', city: 'astana' },
  { tab: 'city', city: 'karaganda' },
];

describe('getSession', () => {
  it('starts as a guest preview with no identity', async () => {
    const session = await guestRepository().getSession();
    expect(session).toEqual({ accessState: 'GUEST_PREVIEW', roles: [] });
  });
});

describe('guest feed privacy', () => {
  it.each(guestTabs.map((q) => [q.tab + (q.city ? `:${q.city}` : ''), q] as const))(
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
    const posts = await allPages(guestRepository(), { tab: 'plans' });
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

  it('shows expired members only the safe view', async () => {
    const repo = createMockRepository({
      clock,
      latency: 0,
      session: { accessState: 'ACTIVE_MEMBER_EXPIRED', roles: ['member'], userId: 'm12' },
    });
    const posts = await allPages(repo, { tab: 'for_you' });
    for (const post of posts) expect(post.author.view).toBe('safe');
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

  it('requires a city for the city tab', async () => {
    await expect(guestRepository().getHomeFeed({ tab: 'city' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { city: 'required' },
    });
  });

  it('returns an empty city feed for Shymkent', async () => {
    const page = await guestRepository().getHomeFeed({ tab: 'city', city: 'shymkent' });
    expect(page).toEqual({ items: [], hasMore: false });
  });

  it('filters the city tab by plan city for plans and author city otherwise', async () => {
    const posts = await allPages(guestRepository(), { tab: 'city', city: 'astana' });
    for (const post of posts) {
      expect(post.plan ? post.plan.city : post.author.city).toBe('astana');
    }
  });

  it('shows only plan posts on the plans tab, soonest first', async () => {
    const posts = await allPages(guestRepository(), { tab: 'plans' });
    expect(posts).toHaveLength(6);
    const dates = posts.map((p) => p.plan?.date ?? '');
    expect(posts.every((p) => p.type === 'plan' && p.plan)).toBe(true);
    expect(dates).toEqual([...dates].sort());
  });

  it('orders the popular tab by reactions + 2·reposts + comments', async () => {
    const posts = await allPages(guestRepository(), { tab: 'popular' });
    const scores = posts.map(popularity);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('hides content of a restricted member everywhere', async () => {
    const restricted = seed.members.filter((m) => m.restricted).map((m) => m.id);
    const hiddenPostIds = seed.posts
      .filter((p) => restricted.includes(p.authorId))
      .map((p) => p.id);
    expect(hiddenPostIds.length).toBeGreaterThan(0);
    for (const query of [...guestTabs, { tab: 'city', city: 'karaganda' } as const]) {
      const ids = (await allPages(guestRepository(), query)).map((p) => p.id);
      for (const id of hiddenPostIds) expect(ids).not.toContain(id);
    }
  });

  it('derives counters from the stored relations', async () => {
    const posts = await allPages(guestRepository(), { tab: 'for_you' });
    const post = posts.find((p) => p.id === 'p01');
    expect(post?.reactions).toBe(seed.reactions.filter((r) => r.postId === 'p01').length);
    expect(post?.commentsCount).toBe(seed.comments.filter((c) => c.postId === 'p01').length);
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
      expect(ids).toHaveLength(seed.posts.length - 1); // one post belongs to a restricted member
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
