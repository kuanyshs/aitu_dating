import type { Clock } from '@/clock';
import {
  FeedPage,
  FeedQuery,
  RepositoryError,
  Session,
  type AituRepository,
  type ApiError,
} from '@/contracts';

import { selectFeed } from './feed';
import type { PostRecord, SeedData } from './records';
import { loadSeed } from './seed';
import { toPostView, type PostCounters, type ShapingContext, type Viewer } from './shaping';

export type MockRepositoryOptions = {
  clock: Clock;
  /** Simulated network latency range in ms; `0` disables it (tests). */
  latency?: readonly [min: number, max: number] | 0;
  seed?: SeedData;
  /** Starting session; later tickets move this behind the access flow and storage. */
  session?: Session;
};

const DEFAULT_PAGE_SIZE = 10;

export function createMockRepository(options: MockRepositoryOptions): AituRepository {
  const { clock, latency = [300, 600] } = options;
  const data = options.seed ?? loadSeed();
  const session: Session = options.session ?? { accessState: 'GUEST_PREVIEW', roles: [] };
  let requestCounter = 0;

  const membersById = new Map(data.members.map((m) => [m.id, m]));
  const plansById = new Map(data.plans.map((p) => [p.id, p]));
  const postsById = new Map(data.posts.map((p) => [p.id, p]));

  function nextRequestId(): string {
    requestCounter += 1;
    return `mock-${requestCounter.toString().padStart(6, '0')}`;
  }

  function fail(requestId: string, error: Omit<ApiError, 'requestId'>): never {
    throw new RepositoryError({ ...error, requestId });
  }

  async function respond<T>(work: (requestId: string) => T): Promise<T> {
    const requestId = nextRequestId();
    if (latency !== 0) {
      const [min, max] = latency;
      await new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
    }
    return work(requestId);
  }

  function counters(postId: string): PostCounters {
    return {
      reactions: data.reactions.filter((r) => r.postId === postId).length,
      reposts: data.reposts.filter((r) => r.postId === postId).length,
      commentsCount: data.comments.filter((c) => c.postId === postId && !c.deleted).length,
    };
  }

  function isVisible(post: PostRecord): boolean {
    const author = membersById.get(post.authorId);
    return !!author && !author.restricted;
  }

  function viewerOf(current: Session): Viewer {
    return { accessState: current.accessState, userId: current.userId };
  }

  return {
    getSession: () => respond(() => Session.parse(session)),

    getHomeFeed: (rawQuery) =>
      respond((requestId) => {
        const parsed = FeedQuery.safeParse(rawQuery);
        if (!parsed.success) {
          fail(requestId, { code: 'VALIDATION_ERROR', message: parsed.error.message });
        }
        const query = parsed.data;
        const viewer = viewerOf(session);
        const isMember = viewer.accessState === 'ACTIVE_MEMBER';

        if (query.tab === 'following' && !isMember) {
          fail(requestId, {
            code: 'FORBIDDEN',
            message: 'The following feed is available to active members only.',
          });
        }
        if (query.tab === 'city' && !query.city) {
          fail(requestId, {
            code: 'VALIDATION_ERROR',
            message: 'The city feed requires a city.',
            fieldErrors: { city: 'required' },
          });
        }

        const viewerRecord = viewer.userId ? membersById.get(viewer.userId) : undefined;
        const followingIds = new Set(
          isMember
            ? data.follows.filter((f) => f.followerId === viewer.userId).map((f) => f.followingId)
            : [],
        );
        const viewerTopics = new Set<string>(
          isMember && viewerRecord
            ? data.posts.filter((p) => p.authorId === viewerRecord.id).flatMap((p) => p.topics)
            : [],
        );

        const ordered = selectFeed(data.posts.filter(isVisible), query, {
          now: clock.now(),
          viewerTopics,
          followingIds,
          counters,
          authorCity: (post) => membersById.get(post.authorId)?.city,
          plan: (id) => plansById.get(id),
        });

        const offset = query.cursor === undefined ? 0 : Number(query.cursor);
        if (!Number.isInteger(offset) || offset < 0) {
          fail(requestId, {
            code: 'VALIDATION_ERROR',
            message: 'Invalid cursor.',
            fieldErrors: { cursor: 'invalid' },
          });
        }
        const limit = query.limit ?? DEFAULT_PAGE_SIZE;
        const slice = ordered.slice(offset, offset + limit);
        const hasMore = offset + limit < ordered.length;

        const ctx: ShapingContext = {
          viewer,
          member: (id) => membersById.get(id),
          plan: (id) => plansById.get(id),
          post: (id) => postsById.get(id),
          counters,
          isVisible,
        };

        return FeedPage.parse({
          items: slice.map((post) => toPostView(post, ctx)),
          hasMore,
          ...(hasMore ? { nextCursor: String(offset + limit) } : {}),
        });
      }),
  };
}
