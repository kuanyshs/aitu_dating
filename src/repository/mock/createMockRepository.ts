import type { Clock } from '@/clock';
import {
  AccessFlowState,
  BlockedPage,
  BlockState,
  CommentPage,
  CommentQuery,
  CommentReactionState,
  CommentRef,
  CommentView,
  CompleteOnboardingInput,
  CreateCommentInput,
  CreatePostInput,
  CreateReportInput,
  FollowListQuery,
  FollowState,
  ListQuery,
  MemberPage,
  ConfirmPaymentInput,
  MyProfile,
  FeedPage,
  FeedQuery,
  ModerateMemberInput,
  ModerationReportPage,
  ModerationReportView,
  ModerationResult,
  MemberRef,
  PassportCandidate,
  PlanRef,
  PlanView,
  PostRef,
  PostView,
  ProfilePostsQuery,
  ProfileStepInput,
  ProfileView,
  ReactionState,
  RenewMembershipInput,
  ReportPage,
  ReportReceipt,
  ReportRef,
  ReportsQuery,
  ResolveReportInput,
  ReportView,
  RepositoryError,
  RepostState,
  Session,
  SetBlockInput,
  SetCommentReactionInput,
  SetFollowInput,
  SetReactionInput,
  SetRepostInput,
  UpdateSettingsInput,
  UserSettings,
  defaultUserSettings,
  type RepositoryMethod,
  type AituRepository,
  type ApiError,
} from '@/contracts';

import { createMemoryStore, createSlot, storageKeys, type KeyValueStore } from '@/storage';

import * as access from './access';
import {
  defaultMockState,
  MOCK_STATE_VERSION,
  MockState,
  mockStateMigrations,
  type DemoControls,
  type DemoFlags,
  type ResetNotice,
} from './demo';
import { buildThreads } from './comments';
import { selectFeed } from './feed';
import {
  BlockRecord,
  FollowRecord,
  PostRecord,
  ReportRecord,
  type CommentRecord,
  type MemberRecord,
  type SeedData,
} from './records';
import { loadSeed } from './seed';
import { passportCandidates } from './seed/candidates';
import {
  isMemberViewer,
  seesFullView,
  toAuthorView,
  toPlanSummary,
  toPostView,
  type PostCounters,
  type ShapingContext,
  type Viewer,
} from './shaping';

export type MockRepositoryOptions = {
  clock: Clock;
  /** Simulated network latency range in ms; `0` disables it (tests). */
  latency?: readonly [min: number, max: number] | 0;
  seed?: SeedData;
  /** Where the mock backend keeps its session and demo state; memory when omitted. */
  store?: KeyValueStore;
  /** Session to start from when nothing is stored yet (tests). */
  session?: Session;
};

export type MockRepository = AituRepository & DemoControls;

const guestSession = (): Session => ({ accessState: 'GUEST_PREVIEW', roles: [] });

const DEFAULT_PAGE_SIZE = 10;

export function createMockRepository(options: MockRepositoryOptions): MockRepository {
  const { clock, latency = [300, 600] } = options;
  const data = options.seed ?? loadSeed();
  const store = options.store ?? createMemoryStore();
  let requestCounter = 0;

  const sessionSlot = createSlot({
    store,
    key: storageKeys.session,
    schema: Session,
    version: 1,
    defaults: () => options.session ?? guestSession(),
  });
  const stateSlot = createSlot({
    store,
    key: storageKeys.state,
    schema: MockState,
    version: MOCK_STATE_VERSION,
    migrations: mockStateMigrations,
    defaults: defaultMockState,
  });

  let session: Session = guestSession();
  let state: MockState = defaultMockState();
  let resetNotice: ResetNotice | undefined;

  // Persisted state loads once, before the first request is answered.
  const ready = (async () => {
    const [loadedSession, loadedState] = await Promise.all([sessionSlot.load(), stateSlot.load()]);
    session = loadedSession.data;
    state = loadedState.data;
    resetNotice = loadedSession.reset ?? loadedState.reset;
  })();

  async function saveState(next: MockState): Promise<void> {
    state = next;
    await stateSlot.save(next);
  }

  const seedMembersById = new Map(data.members.map((m) => [m.id, m]));
  /**
   * Members who joined during the demo, plus the seed community. A seed member changed
   * by the demo (renewed, expired) is stored in state and wins over the seed copy.
   */
  function member(id: string): MemberRecord | undefined {
    return state.members.find((m) => m.id === id) ?? seedMembersById.get(id);
  }

  async function saveMember(record: MemberRecord, patch: Partial<MockState> = {}) {
    await saveState({
      ...state,
      ...patch,
      members: [...state.members.filter((m) => m.id !== record.id), record],
    });
  }

  /**
   * The demo clock restarts from the seed instant on every app start, so a membership
   * ended from the demo panel is flagged rather than trusted to a date in the past.
   */
  const isExpired = (record: MemberRecord) =>
    record.id in state.expiredMemberships || new Date(record.membership.endsAt) <= clock.now();
  const plansById = new Map(data.plans.map((p) => [p.id, p]));
  const seedPostsById = new Map(data.posts.map((p) => [p.id, p]));

  /** Seed posts and those published during the demo. */
  function allPosts(): PostRecord[] {
    return [...data.posts, ...state.posts];
  }

  function postById(id: string): PostRecord | undefined {
    return seedPostsById.get(id) ?? state.posts.find((p) => p.id === id);
  }

  function nextRequestId(): string {
    requestCounter += 1;
    return `mock-${requestCounter.toString().padStart(6, '0')}`;
  }

  function fail(requestId: string, error: Omit<ApiError, 'requestId'>): never {
    throw new RepositoryError({ ...error, requestId });
  }

  async function delay(extraMs = 0): Promise<void> {
    if (latency === 0) return;
    const [min, max] = latency;
    const ms = min + Math.random() * (max - min) + extraMs;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Answers a request like a server would. `data` requests go "over the network" and
   * honour the demo failure flags; the session and demo controls are local.
   */
  async function respond<T>(
    kind: 'data' | 'local',
    work: (requestId: string) => T | Promise<T>,
    extraLatencyMs = 0,
  ): Promise<T> {
    await ready;
    const requestId = nextRequestId();
    await delay(extraLatencyMs);
    if (kind === 'data') {
      if (state.demoFlags.offline) {
        fail(requestId, { code: 'NETWORK_ERROR', message: 'Offline (demo).' });
      }
      if (state.demoFlags.networkErrorOnce) {
        await saveState({ ...state, demoFlags: { ...state.demoFlags, networkErrorOnce: false } });
        fail(requestId, { code: 'NETWORK_ERROR', message: 'Simulated network error (demo).' });
      }
    }
    return work(requestId);
  }

  /** Seed and demo comments with the authors' soft deletions applied. */
  function allComments(): CommentRecord[] {
    const deleted = new Set(state.deletedCommentIds);
    return [...data.comments, ...state.comments].map((c) =>
      deleted.has(c.id) ? { ...c, deleted: true } : c,
    );
  }

  function commentReactionsOf(commentId: string) {
    return [...data.commentReactions, ...state.commentReactions].filter(
      (r) => r.commentId === commentId,
    );
  }

  function reactionsOf(postId: string) {
    return [...data.reactions, ...state.reactions].filter((r) => r.postId === postId);
  }

  function repostsOf(postId: string) {
    return [...data.reposts, ...state.reposts].filter((r) => r.postId === postId);
  }

  function counters(postId: string): PostCounters {
    return {
      reactions: reactionsOf(postId).length,
      reposts: repostsOf(postId).length,
      commentsCount: allComments().filter((c) => c.postId === postId && !c.deleted).length,
    };
  }

  /** Ограничение comes from the seed or from a moderation decision during the demo. */
  function isRestricted(record: MemberRecord): boolean {
    return record.restricted || state.restrictedSubjects.includes(record.aituSubjectId);
  }

  /**
   * Блокировка between the current member and someone else, whoever blocked whom.
   * Everything a request reads is shaped for the current session, so it is the viewer.
   */
  function blockedWithMe(memberId: string): boolean {
    const me = session.userId;
    return (
      !!me &&
      state.blocks.some(
        (b) =>
          (b.blockerId === me && b.blockedId === memberId) ||
          (b.blockerId === memberId && b.blockedId === me),
      )
    );
  }

  const samePair = (a: { followerId: string; followingId: string }, b: typeof a) =>
    a.followerId === b.followerId && a.followingId === b.followingId;

  /** Seed Подписки still in place, and those made during the demo. */
  function allFollows(): FollowRecord[] {
    return [
      ...data.follows.filter((f) => !state.unfollows.some((u) => samePair(u, f))),
      ...state.follows,
    ];
  }

  const isFollowing = (followerId: string, followingId: string) =>
    allFollows().some((f) => samePair(f, { followerId, followingId }));

  /** The state without the given Подписки: demo ones dropped, seed ones marked undone. */
  function withoutFollows(next: MockState, gone: (f: FollowRecord) => boolean): MockState {
    const undone = data.follows
      .filter(gone)
      .filter((f) => !next.unfollows.some((u) => samePair(u, f)))
      .map(({ followerId, followingId }) => ({ followerId, followingId }));
    return {
      ...next,
      follows: next.follows.filter((f) => !gone(f)),
      unfollows: [...next.unfollows, ...undone],
    };
  }

  /** A person the viewer may see: not restricted, not in a Блокировка with them. */
  function isShown(record: MemberRecord | undefined): record is MemberRecord {
    return !!record && !isRestricted(record) && !blockedWithMe(record.id);
  }

  function isVisible(post: PostRecord): boolean {
    return isShown(member(post.authorId)) && !state.deletedPostIds.includes(post.id);
  }

  /** Seed reports and those sent during the demo, oldest first. */
  function allReports(): ReportRecord[] {
    return [...data.reports, ...state.reports].map((r) => {
      const update = state.reportUpdates[r.id];
      if (!update) return r;
      const { outcome: _previous, ...rest } = r;
      return { ...rest, ...update };
    });
  }

  /** Who is behind a report target at all, seen or hidden, for moderation. */
  function reportTargetAuthor(type: ReportRecord['targetType'], id: string) {
    switch (type) {
      case 'user':
        return member(id);
      case 'post': {
        const post = postById(id);
        return post ? { ...member(post.authorId)!, text: post.text } : undefined;
      }
      case 'comment': {
        const comment = allComments().find((c) => c.id === id);
        return comment ? { ...member(comment.authorId)!, text: comment.text } : undefined;
      }
      case 'plan': {
        const plan = plansById.get(id);
        const post = allPosts().find((p) => p.planId === id);
        return plan ? { ...member(plan.authorId)!, text: post?.text } : undefined;
      }
      case 'message':
        return undefined;
    }
  }

  /** Newest first; among equal times the later one wins. */
  const newestFollows = (follows: FollowRecord[]) =>
    [...follows].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /** Who follows a member, as the viewer may see them. */
  function followersOf(memberId: string): MemberRecord[] {
    return newestFollows(allFollows().filter((f) => f.followingId === memberId))
      .map((f) => member(f.followerId))
      .filter(isShown);
  }

  /** Whom a member follows, as the viewer may see them. */
  function followingOf(memberId: string): MemberRecord[] {
    return newestFollows(allFollows().filter((f) => f.followerId === memberId))
      .map((f) => member(f.followingId))
      .filter(isShown);
  }

  /** «Подписчики» and «Подписки»: active members only, of someone they may see or of themselves. */
  function followPage(
    requestId: string,
    input: unknown,
    people: (memberId: string) => MemberRecord[],
  ): MemberPage {
    const me = requireActiveMember(requestId);
    const { memberId, cursor, limit } = parseOrFail(FollowListQuery, input, requestId);
    if (memberId !== me.id && !isShown(member(memberId))) {
      fail(requestId, { code: 'NOT_FOUND', message: 'Member not found.' });
    }
    const viewer = viewerOf(effectiveSession());
    return MemberPage.parse(
      page(
        people(memberId).map((person) => toAuthorView(person, viewer)),
        cursor,
        limit ?? DEFAULT_PAGE_SIZE,
        requestId,
      ),
    );
  }

  /** Moderation sessions only: an active role on a session that is not restricted. */
  function requireModerator(requestId: string): Session {
    const current = effectiveSession();
    if (current.accessState === 'BLOCKED' || !current.roles.includes('moderator')) {
      fail(requestId, { code: 'FORBIDDEN', message: 'Moderators only.' });
    }
    return current;
  }

  function toModerationView(record: ReportRecord): ModerationReportView {
    const author = reportTargetAuthor(record.targetType, record.targetId);
    const person = author ? member(author.id) : undefined;
    return ModerationReportView.parse({
      report: toReportView(record),
      ...(person && author
        ? {
            subject: {
              // Moderation sees the person in full, whoever is looking.
              person: toAuthorView(person, { accessState: 'ACTIVE_MEMBER' }),
              ...('text' in author && author.text ? { text: author.text } : {}),
              restricted: isRestricted(person),
            },
          }
        : {}),
    });
  }

  /** A report this moderator may decide on: it exists and is not about their content. */
  function moderatedReport(requestId: string, moderator: Session, reportId: string) {
    const record = allReports().find((r) => r.id === reportId);
    const author = record ? reportTargetAuthor(record.targetType, record.targetId) : undefined;
    if (!record || (author && author.id === moderator.userId)) {
      fail(requestId, { code: 'NOT_FOUND', message: 'Report not found.' });
    }
    return record;
  }

  function toReportView(record: ReportRecord): ReportView {
    return ReportView.parse({
      id: record.id,
      target: { type: record.targetType, id: record.targetId },
      reason: record.reason,
      ...(record.details ? { details: record.details } : {}),
      status: record.status,
      ...(record.outcome ? { outcome: record.outcome } : {}),
      createdAt: record.createdAt,
    });
  }

  /**
   * Who is behind a report target the reporter can still see: undefined when it does
   * not exist or is hidden. Messages arrive with the chats spec; none exist yet.
   */
  function reportTargetOwner(type: ReportRecord['targetType'], id: string): string | undefined {
    const visibleMember = (memberId: string) => {
      const record = member(memberId);
      return isShown(record) ? record.id : undefined;
    };
    switch (type) {
      case 'user':
        return visibleMember(id);
      case 'post': {
        const post = postById(id);
        return post && isVisible(post) ? post.authorId : undefined;
      }
      case 'comment': {
        const comment = allComments().find((c) => c.id === id);
        const post = comment ? postById(comment.postId) : undefined;
        if (!comment || comment.deleted || !post || !isVisible(post)) return undefined;
        return visibleMember(comment.authorId);
      }
      case 'plan': {
        const plan = plansById.get(id);
        return plan ? visibleMember(plan.authorId) : undefined;
      }
      case 'message':
        return undefined;
    }
  }

  /** The Aitu subject behind the current session, member or not. */
  function currentSubject(): string | undefined {
    const record = session.userId ? member(session.userId) : undefined;
    if (record) return record.aituSubjectId;
    return passportCandidates.find((c) => c.id === session.candidateId)?.aituSubjectId;
  }

  async function setRestricted(subjectId: string, restricted: boolean) {
    const others = state.restrictedSubjects.filter((id) => id !== subjectId);
    await saveState({ ...state, restrictedSubjects: restricted ? [...others, subjectId] : others });
  }

  function flowResult(requestId: string, outcome: access.Outcome<MockState['accessFlow'] & {}>) {
    if (!outcome.ok) fail(requestId, outcome.error);
    return outcome.value;
  }

  async function saveFlow(flow: NonNullable<MockState['accessFlow']>): Promise<AccessFlowState> {
    await saveState({ ...state, accessFlow: flow });
    return AccessFlowState.parse(access.toFlowState(flow, passportCandidates));
  }

  function toMyProfile(record: MemberRecord): MyProfile {
    const expired = isExpired(record);
    return MyProfile.parse({
      id: record.id,
      name: record.name,
      age: record.age,
      gender: record.gender,
      city: record.city,
      verified: record.verified,
      avatar: { kind: 'synthetic', key: record.photoKey },
      card: record.card,
      membership: {
        tier: record.membership.tier,
        periodMonths: record.membership.periodMonths,
        status: expired ? 'expired' : 'active',
        endsAt: record.membership.endsAt,
      },
    });
  }

  const memberIdOf = (candidateId: string) => `me-${candidateId}`;

  function hasCard(candidateId: string | undefined): boolean {
    return !!candidateId && !!member(memberIdOf(candidateId));
  }

  async function setSession(next: Session): Promise<Session> {
    session = next;
    await sessionSlot.save(next);
    return publicSession();
  }

  /** A member's mode follows their membership dates, so it also expires on its own. */
  function effectiveSession(): Session {
    // Ограничение wins over every other mode; the stored mode comes back when lifted.
    const subject = currentSubject();
    if (subject && state.restrictedSubjects.includes(subject)) {
      return { ...session, accessState: 'BLOCKED' };
    }
    const record = session.userId ? member(session.userId) : undefined;
    if (!record) return session;
    if (session.accessState !== 'ACTIVE_MEMBER' && session.accessState !== 'ACTIVE_MEMBER_EXPIRED')
      return session;
    return {
      ...session,
      accessState: isExpired(record) ? 'ACTIVE_MEMBER_EXPIRED' : 'ACTIVE_MEMBER',
    };
  }

  /** The stored session plus what the client may derive from it. */
  function publicSession(): Session {
    const current = effectiveSession();
    const canLogin = current.accessState === 'GUEST_PREVIEW' && hasCard(current.candidateId);
    return Session.parse({ ...current, ...(canLogin ? { canLogin: true } : {}) });
  }

  /** Social actions need an active membership; the server says why when they don't. */
  function requireActiveMember(requestId: string): MemberRecord {
    const current = effectiveSession();
    if (current.accessState === 'ACTIVE_MEMBER_EXPIRED') {
      fail(requestId, { code: 'MEMBERSHIP_EXPIRED', message: 'Renew the membership to do this.' });
    }
    if (current.accessState === 'BLOCKED') {
      fail(requestId, { code: 'FORBIDDEN', message: 'Access is restricted.' });
    }
    const record = current.userId ? member(current.userId) : undefined;
    if (current.accessState !== 'ACTIVE_MEMBER' || !record) {
      fail(requestId, { code: 'UNAUTHENTICATED', message: 'Join the community to do this.' });
    }
    return record;
  }

  function addMonths(iso: string, months: number): string {
    const date = new Date(iso);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString();
  }

  function viewerOf(current: Session): Viewer {
    return { accessState: current.accessState, userId: current.userId };
  }

  function shapingContext(viewer: Viewer): ShapingContext {
    return {
      viewer,
      member: (id) => member(id),
      plan: (id) => plansById.get(id),
      post: (id) => postById(id),
      counters,
      reactedByMe: (postId) => reactionsOf(postId).some((r) => r.userId === viewer.userId),
      repostedByMe: (postId) => repostsOf(postId).some((r) => r.userId === viewer.userId),
      isVisible,
    };
  }

  /** Readers of community content: anyone but a restricted session. */
  function requireReader(requestId: string): Viewer {
    const viewer = viewerOf(effectiveSession());
    if (viewer.accessState === 'BLOCKED') {
      fail(requestId, { code: 'FORBIDDEN', message: 'Access is restricted.' });
    }
    return viewer;
  }

  /** The own card: active and expired members (an expired card stays editable). */
  function requireOwnCard(requestId: string): MemberRecord {
    const current = effectiveSession();
    if (current.accessState === 'BLOCKED') {
      fail(requestId, { code: 'FORBIDDEN', message: 'Access is restricted.' });
    }
    const record = current.userId ? member(current.userId) : undefined;
    if (current.accessState === 'GUEST_PREVIEW' || !record) {
      fail(requestId, { code: 'UNAUTHENTICATED', message: 'No published card.' });
    }
    return record;
  }

  function page<T>(items: T[], cursor: string | undefined, limit: number, requestId: string) {
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isInteger(offset) || offset < 0) {
      fail(requestId, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid cursor.',
        fieldErrors: { cursor: 'invalid' },
      });
    }
    const hasMore = offset + limit < items.length;
    return {
      items: items.slice(offset, offset + limit),
      hasMore,
      ...(hasMore ? { nextCursor: String(offset + limit) } : {}),
    };
  }

  function parseOrFail<T>(
    schema: {
      safeParse(
        v: unknown,
      ): { success: true; data: T } | { success: false; error: { message: string } };
    },
    input: unknown,
    requestId: string,
  ): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success)
      fail(requestId, { code: 'VALIDATION_ERROR', message: parsed.error.message });
    return parsed.data;
  }

  /** Part of the frozen contract; the behaviour lands with its own spec. */
  const notImplemented = (method: RepositoryMethod) => () =>
    respond('local', (requestId) =>
      fail(requestId, {
        code: 'NOT_IMPLEMENTED',
        message: `${method} is not implemented in the mock yet.`,
      }),
    );

  return {
    getSession: () => respond('local', () => publicSession()),

    logout: () =>
      respond('local', () =>
        setSession({
          accessState: 'GUEST_PREVIEW',
          roles: [],
          ...(session.candidateId ? { candidateId: session.candidateId } : {}),
        }),
      ),

    login: () =>
      respond('local', (requestId) => {
        const candidateId = session.candidateId;
        const record = candidateId ? member(memberIdOf(candidateId)) : undefined;
        if (!candidateId || !record) {
          fail(requestId, { code: 'CONFLICT', message: 'This identity has no published card.' });
        }
        return setSession({
          accessState: isExpired(record) ? 'ACTIVE_MEMBER_EXPIRED' : 'ACTIVE_MEMBER',
          roles: ['member'],
          userId: record.id,
          candidateId,
        });
      }),

    getHomeFeed: (rawQuery) =>
      respond('data', (requestId) => {
        const parsed = FeedQuery.safeParse(rawQuery);
        if (!parsed.success) {
          fail(requestId, { code: 'VALIDATION_ERROR', message: parsed.error.message });
        }
        const query = parsed.data;
        const viewer = viewerOf(effectiveSession());
        if (viewer.accessState === 'BLOCKED') {
          fail(requestId, { code: 'FORBIDDEN', message: 'Access is restricted.' });
        }
        const isMember = viewer.accessState === 'ACTIVE_MEMBER';

        if (query.tab === 'following' && viewer.accessState === 'ACTIVE_MEMBER_EXPIRED') {
          fail(requestId, {
            code: 'MEMBERSHIP_EXPIRED',
            message: 'Renew the membership to see the following feed.',
          });
        }
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

        const viewerRecord = viewer.userId ? member(viewer.userId) : undefined;
        const followingIds = new Set(
          isMember
            ? allFollows()
                .filter((f) => f.followerId === viewer.userId)
                .map((f) => f.followingId)
            : [],
        );
        const viewerTopics = new Set<string>(
          isMember && viewerRecord
            ? allPosts()
                .filter((p) => p.authorId === viewerRecord.id)
                .flatMap((p) => p.topics)
            : [],
        );

        const ordered = selectFeed(allPosts().filter(isVisible), query, {
          viewerId: isMember ? viewer.userId : undefined,
          now: clock.now(),
          viewerTopics,
          followingIds,
          counters,
          authorCity: (post) => member(post.authorId)?.city,
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

        const ctx = shapingContext(viewer);

        return FeedPage.parse({
          items: slice.map((post) => toPostView(post, ctx)),
          hasMore,
          ...(hasMore ? { nextCursor: String(offset + limit) } : {}),
        });
      }),

    listPassportCandidates: () =>
      respond('data', () => passportCandidates.map((c) => PassportCandidate.parse(c))),

    getAccessFlow: () =>
      respond('local', () =>
        state.accessFlow
          ? AccessFlowState.parse(access.toFlowState(state.accessFlow, passportCandidates))
          : null,
      ),

    startAccess: () => respond('local', () => saveFlow(access.start(state.accessFlow))),

    selectPassport: ({ candidateId }) =>
      respond('data', async (requestId) => {
        if (hasCard(candidateId)) {
          fail(requestId, {
            code: 'CONFLICT',
            message: 'This identity is already a member; use login.',
            fieldErrors: { candidateId: 'already_member' },
          });
        }
        const flow = flowResult(
          requestId,
          access.selectPassport(state.accessFlow, candidateId, passportCandidates),
        );
        await setSession({ ...session, candidateId });
        return saveFlow(flow);
      }),

    acceptRules: ({ rulesVersion }) =>
      respond('data', (requestId) =>
        saveFlow(flowResult(requestId, access.acceptRules(state.accessFlow, rulesVersion))),
      ),

    selectMembership: (selection) =>
      respond('data', (requestId) =>
        saveFlow(
          flowResult(
            requestId,
            access.selectMembership(state.accessFlow, selection, clock.now().toISOString()),
          ),
        ),
      ),

    confirmPayment: (input) =>
      respond(
        'data',
        async (requestId) => {
          const parsed = ConfirmPaymentInput.safeParse(input);
          if (!parsed.success) {
            fail(requestId, {
              code: 'VALIDATION_ERROR',
              message: 'An idempotency key is required.',
              fieldErrors: { idempotencyKey: 'required' },
            });
          }
          const { idempotencyKey } = parsed.data;
          const flow = state.accessFlow;
          const previous = state.payments[idempotencyKey];
          // A retried request with the same key returns the original result, never a second charge.
          if (previous && flow?.payment?.reference === previous.reference) {
            return AccessFlowState.parse(access.toFlowState(flow, passportCandidates));
          }
          if (!flow?.membership) {
            fail(requestId, { code: 'CONFLICT', message: 'Choose a membership period first.' });
          }
          const receipt = {
            reference: `mock-pay-${Object.keys(state.payments).length + 1}`,
            amountKzt: access.priceOf(flow.membership),
            paidAt: clock.now().toISOString(),
          };
          const next = flowResult(requestId, access.confirmPayment(flow, receipt));
          await saveState({
            ...state,
            payments: { ...state.payments, [idempotencyKey]: receipt },
          });
          return saveFlow(next);
        },
        1500,
      ),

    saveProfileStep: (input) =>
      respond('data', (requestId) =>
        saveFlow(flowResult(requestId, access.saveProfileStep(state.accessFlow, input))),
      ),

    saveAnswer: (input) =>
      respond('data', (requestId) =>
        saveFlow(flowResult(requestId, access.saveAnswer(state.accessFlow, input))),
      ),

    completeOnboarding: (input) =>
      respond('data', async (requestId) => {
        const parsed = CompleteOnboardingInput.safeParse(input);
        if (!parsed.success) {
          fail(requestId, {
            code: 'VALIDATION_ERROR',
            message: 'Answers and an idempotency key are required.',
            fieldErrors: { idempotencyKey: 'required' },
          });
        }
        const { answers, idempotencyKey } = parsed.data;

        // A retry of a request that already published returns the same card.
        const publishedId = state.onboardings[idempotencyKey];
        const published = publishedId ? member(publishedId) : undefined;
        if (published) return toMyProfile(published);

        const flow = state.accessFlow;
        const outcome = access.validateOnboarding(flow, answers);
        if (!outcome.ok) fail(requestId, outcome.error);
        const candidate = passportCandidates.find((c) => c.id === flow?.candidateId);
        if (!flow?.membership || !flow.payment || !candidate) {
          fail(requestId, { code: 'CONFLICT', message: 'Membership is not confirmed.' });
        }

        const now = clock.now().toISOString();
        const record: MemberRecord = {
          id: memberIdOf(candidate.id),
          aituSubjectId: candidate.aituSubjectId,
          name: candidate.name,
          gender: candidate.gender,
          age: candidate.age,
          city: candidate.city,
          photoKey: `avatar-${candidate.id}`,
          verified: true,
          card: {
            ...outcome.value.profile,
            intent: outcome.value.answers.intent,
            questionnaire: outcome.value.answers,
            publishedAt: now,
          },
          membership: {
            tier: flow.membership.tier,
            periodMonths: flow.membership.periodMonths,
            startsAt: flow.payment.paidAt,
            endsAt: addMonths(flow.payment.paidAt, flow.membership.periodMonths),
          },
          restricted: false,
        };

        // One write: card, cleared flow and idempotency record land together.
        await saveState({
          ...state,
          accessFlow: null,
          members: [...state.members.filter((m) => m.id !== record.id), record],
          onboardings: { ...state.onboardings, [idempotencyKey]: record.id },
        });
        await setSession({
          accessState: 'ACTIVE_MEMBER',
          roles: ['member'],
          userId: record.id,
          candidateId: candidate.id,
        });
        return toMyProfile(record);
      }),

    getMyProfile: () =>
      respond('local', (requestId) => {
        const record = session.userId ? member(session.userId) : undefined;
        if (!record) {
          fail(requestId, { code: 'UNAUTHENTICATED', message: 'No published card.' });
        }
        return toMyProfile(record);
      }),

    updateMyCard: (input) =>
      respond('data', async (requestId) => {
        const record = requireOwnCard(requestId);
        const parsed = ProfileStepInput.safeParse(input);
        if (!parsed.success) {
          fail(requestId, {
            code: 'VALIDATION_ERROR',
            message: 'Check the profile fields.',
            fieldErrors: access.fieldErrorsOf(parsed.error, 'profile'),
          });
        }
        const updated: MemberRecord = { ...record, card: { ...record.card, ...parsed.data } };
        await saveMember(updated);
        return toMyProfile(updated);
      }),

    getPost: (input) =>
      respond('data', (requestId) => {
        const viewer = requireReader(requestId);
        const { postId } = parseOrFail(PostRef, input, requestId);
        const post = postById(postId);
        if (!post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Post not found.' });
        }
        return PostView.parse(toPostView(post, shapingContext(viewer)));
      }),

    listComments: (query) =>
      respond('data', (requestId) => {
        const viewer = requireReader(requestId);
        const { postId, sort, cursor, limit } = parseOrFail(CommentQuery, query, requestId);
        const post = postById(postId);
        if (!post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Post not found.' });
        }
        // Comments of restricted people are hidden like their posts; a deleted reply is
        // gone, a deleted root stays only while it still has replies to hold together.
        // A Блокировка hides comments the same way, and a root it hides reads «скрыт».
        const hiddenRoot = (c: CommentRecord) => !c.parentCommentId && blockedWithMe(c.authorId);
        const visible = allComments().filter((c) => {
          const author = member(c.authorId);
          return (
            c.postId === postId &&
            !!author &&
            !isRestricted(author) &&
            !(c.parentCommentId && (c.deleted || blockedWithMe(c.authorId)))
          );
        });
        const threads = buildThreads(visible, sort, (id) => commentReactionsOf(id).length).filter(
          (t) => (!t.root.deleted && !hiddenRoot(t.root)) || t.replies.length > 0,
        );
        const full = seesFullView(viewer);
        const toView = (c: CommentRecord): CommentView =>
          hiddenRoot(c) ? hiddenView(c) : shownView(c);
        // Nothing of the hidden author leaves: no text, no name, no photo.
        const hiddenView = (c: CommentRecord): CommentView => ({
          id: c.id,
          postId: c.postId,
          author: toAuthorView(member(c.authorId)!, { accessState: 'GUEST_PREVIEW' }),
          text: '',
          createdAt: c.createdAt,
          reactions: commentReactionsOf(c.id).length,
          deleted: false,
          hidden: true,
        });
        const shownView = (c: CommentRecord): CommentView => ({
          id: c.id,
          postId: c.postId,
          ...(c.parentCommentId ? { parentId: c.parentCommentId } : {}),
          author: toAuthorView(member(c.authorId)!, viewer),
          text: c.deleted ? '' : c.text,
          createdAt: c.createdAt,
          reactions: commentReactionsOf(c.id).length,
          deleted: c.deleted,
          ...(isMemberViewer(viewer) ? { mine: c.authorId === viewer.userId } : {}),
          ...(full
            ? { reactedByMe: commentReactionsOf(c.id).some((r) => r.userId === viewer.userId) }
            : {}),
        });
        return CommentPage.parse(
          page(
            threads.map((t) => ({ comment: toView(t.root), replies: t.replies.map(toView) })),
            cursor,
            limit ?? DEFAULT_PAGE_SIZE,
            requestId,
          ),
        );
      }),

    getProfile: (input) =>
      respond('data', (requestId) => {
        const viewer = requireReader(requestId);
        if (viewer.accessState === 'GUEST_PREVIEW') {
          fail(requestId, { code: 'UNAUTHENTICATED', message: 'Profiles are for members.' });
        }
        const { memberId } = parseOrFail(MemberRef, input, requestId);
        const record = member(memberId);
        if (!isShown(record)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Member not found.' });
        }
        const full = seesFullView(viewer);
        return ProfileView.parse({
          person: toAuthorView(record, viewer),
          ...(full
            ? {
                card: {
                  bio: record.card.bio,
                  intent: record.card.intent,
                  interests: record.card.interests,
                  communicationStyle: record.card.communicationStyle,
                },
              }
            : {}),
          stats: {
            posts: allPosts().filter((p) => p.authorId === record.id && isVisible(p)).length,
            // Counted as the lists show them: without anyone hidden from the viewer.
            followers: followersOf(record.id).length,
            following: followingOf(record.id).length,
          },
          ...(full
            ? {
                relation: {
                  following: isFollowing(viewer.userId!, record.id),
                  followsMe: isFollowing(record.id, viewer.userId!),
                  blocked: false,
                },
              }
            : {}),
        });
      }),

    listProfilePosts: (query) =>
      respond('data', (requestId) => {
        const viewer = requireReader(requestId);
        if (viewer.accessState === 'GUEST_PREVIEW') {
          fail(requestId, { code: 'UNAUTHENTICATED', message: 'Profiles are for members.' });
        }
        const { memberId, cursor, limit } = parseOrFail(ProfilePostsQuery, query, requestId);
        const record = member(memberId);
        if (!isShown(record)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Member not found.' });
        }
        const posts = allPosts()
          .filter((p) => p.authorId === memberId && isVisible(p))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const ctx = shapingContext(viewer);
        return FeedPage.parse(
          page(
            posts.map((p) => toPostView(p, ctx)),
            cursor,
            limit ?? DEFAULT_PAGE_SIZE,
            requestId,
          ),
        );
      }),

    getPlan: (input) =>
      respond('data', (requestId) => {
        const viewer = requireReader(requestId);
        const { planId } = parseOrFail(PlanRef, input, requestId);
        const plan = plansById.get(planId);
        const author = plan ? member(plan.authorId) : undefined;
        const post = allPosts().find((p) => p.planId === planId);
        if (!plan || !isShown(author) || !post) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Plan not found.' });
        }
        const full = seesFullView(viewer);
        return PlanView.parse({
          ...toPlanSummary(plan),
          postId: post.id,
          author: toAuthorView(author, viewer),
          description: plan.description,
          ...(full ? { place: plan.place } : {}),
          createdAt: plan.createdAt,
          ...(full && plan.authorId === viewer.userId ? { pendingResponses: 0 } : {}),
        });
      }),

    getSettings: () =>
      respond('data', (requestId) => {
        const record = requireOwnCard(requestId);
        return UserSettings.parse(state.settings[record.id] ?? defaultUserSettings());
      }),

    updateSettings: (input) =>
      respond('data', async (requestId) => {
        const record = requireOwnCard(requestId);
        const patch = parseOrFail(UpdateSettingsInput, input, requestId);
        const current = state.settings[record.id] ?? defaultUserSettings();
        const next = UserSettings.parse({
          notifications: { ...current.notifications, ...patch.notifications },
        });
        await saveState({ ...state, settings: { ...state.settings, [record.id]: next } });
        return next;
      }),

    createPost: (input) =>
      respond('data', async (requestId) => {
        const me = requireActiveMember(requestId);
        const parsed = CreatePostInput.safeParse(input);
        if (!parsed.success) {
          fail(requestId, {
            code: 'VALIDATION_ERROR',
            message: 'Check the post.',
            fieldErrors: access.fieldErrorsOf(parsed.error, ''),
          });
        }
        const { type, text, topics, quotedPostId, idempotencyKey } = parsed.data;
        const toView = (post: PostRecord) =>
          PostView.parse(toPostView(post, shapingContext(viewerOf(effectiveSession()))));

        // A retry of a request that already went through returns the same post.
        const existing = postById(state.postKeys[idempotencyKey] ?? '');
        if (existing) return toView(existing);

        if (quotedPostId) {
          const quoted = postById(quotedPostId);
          if (!quoted || !isVisible(quoted)) {
            fail(requestId, { code: 'NOT_FOUND', message: 'The quoted post is gone.' });
          }
        }
        const record = PostRecord.parse({
          id: `post-${state.posts.length + 1}`,
          authorId: me.id,
          type,
          text,
          topics: [...new Set(topics)],
          createdAt: clock.now().toISOString(),
          ...(quotedPostId ? { quotedPostId } : {}),
        });
        await saveState({
          ...state,
          posts: [...state.posts, record],
          postKeys: { ...state.postKeys, [idempotencyKey]: record.id },
        });
        return toView(record);
      }),
    setRepost: (input) =>
      respond('data', async (requestId) => {
        const me = requireActiveMember(requestId);
        const { postId, active } = parseOrFail(SetRepostInput, input, requestId);
        const post = postById(postId);
        if (!post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Post not found.' });
        }
        if (post.authorId === me.id) {
          fail(requestId, { code: 'CONFLICT', message: 'An own post cannot be reposted.' });
        }
        const mine = (r: { userId: string; postId: string }) =>
          r.userId === me.id && r.postId === postId;
        // Setting the same value twice is a no-op, so a retried request is safe.
        if (active !== repostsOf(postId).some(mine)) {
          const others = state.reposts.filter((r) => !mine(r));
          await saveState({
            ...state,
            reposts: active
              ? [...others, { userId: me.id, postId, createdAt: clock.now().toISOString() }]
              : others,
          });
        }
        return RepostState.parse({
          postId,
          reposts: repostsOf(postId).length,
          repostedByMe: repostsOf(postId).some(mine),
        });
      }),
    setFollow: (input) =>
      respond('data', async (requestId) => {
        const me = requireActiveMember(requestId);
        const { memberId, active } = parseOrFail(SetFollowInput, input, requestId);
        if (memberId === me.id) {
          fail(requestId, { code: 'CONFLICT', message: 'Nobody follows themselves.' });
        }
        const other = member(memberId);
        if (!isShown(other)) fail(requestId, { code: 'NOT_FOUND', message: 'Member not found.' });
        const pair = { followerId: me.id, followingId: other.id };
        // Setting the same value twice is a no-op, so a retried request is safe.
        if (active !== isFollowing(me.id, other.id)) {
          if (active) {
            const fromSeed = data.follows.some((f) => samePair(f, pair));
            await saveState(
              fromSeed
                ? { ...state, unfollows: state.unfollows.filter((u) => !samePair(u, pair)) }
                : {
                    ...state,
                    follows: [
                      ...state.follows,
                      FollowRecord.parse({ ...pair, createdAt: clock.now().toISOString() }),
                    ],
                  },
            );
          } else {
            await saveState(withoutFollows(state, (f) => samePair(f, pair)));
          }
        }
        return FollowState.parse({
          memberId: other.id,
          following: active,
          followers: followersOf(other.id).length,
        });
      }),
    listFollowers: (input) =>
      respond('data', (requestId) => followPage(requestId, input, followersOf)),
    listFollowing: (input) =>
      respond('data', (requestId) => followPage(requestId, input, followingOf)),
    search: notImplemented('search'),
    createPlan: notImplemented('createPlan'),
    cancelPlan: notImplemented('cancelPlan'),
    closePlan: notImplemented('closePlan'),
    listPlanResponses: notImplemented('listPlanResponses'),
    respondToPlan: notImplemented('respondToPlan'),
    acceptPlanResponse: notImplemented('acceptPlanResponse'),
    declinePlanResponse: notImplemented('declinePlanResponse'),
    withdrawPlanResponse: notImplemented('withdrawPlanResponse'),
    listChats: notImplemented('listChats'),
    getChat: notImplemented('getChat'),
    listMessages: notImplemented('listMessages'),
    sendMessage: notImplemented('sendMessage'),
    retryMessage: notImplemented('retryMessage'),
    markChatRead: notImplemented('markChatRead'),
    listActivity: notImplemented('listActivity'),
    createReport: (input) =>
      respond('data', async (requestId) => {
        // Guests report anonymously; a restricted session cannot report.
        const viewer = requireReader(requestId);
        const reporterId = isMemberViewer(viewer) ? viewer.userId : undefined;
        const parsed = CreateReportInput.safeParse(input);
        if (!parsed.success) {
          fail(requestId, {
            code: 'VALIDATION_ERROR',
            message: 'Check the report.',
            fieldErrors: access.fieldErrorsOf(parsed.error, ''),
          });
        }
        const { target, reason, details, idempotencyKey } = parsed.data;

        const receipt = (record: ReportRecord) =>
          ReportReceipt.parse({
            report: toReportView(record),
            alreadyReported: record.idempotencyKey !== idempotencyKey,
          });

        // A retry of a request that already went through gets the same answer.
        const existingId = state.reportKeys[idempotencyKey];
        const existing = existingId ? allReports().find((r) => r.id === existingId) : undefined;
        if (existing) return receipt(existing);

        const owner = reportTargetOwner(target.type, target.id);
        if (!owner) fail(requestId, { code: 'NOT_FOUND', message: 'Nothing to report here.' });
        if (reporterId && owner === reporterId) {
          fail(requestId, { code: 'CONFLICT', message: 'Own content cannot be reported.' });
        }
        // The same person on the same target under review: the first report stands.
        const open = reporterId
          ? allReports().find(
              (r) =>
                r.reporterId === reporterId &&
                r.targetType === target.type &&
                r.targetId === target.id &&
                r.status !== 'resolved',
            )
          : undefined;
        if (open) {
          await saveState({
            ...state,
            reportKeys: { ...state.reportKeys, [idempotencyKey]: open.id },
          });
          return receipt(open);
        }

        const record = ReportRecord.parse({
          id: `report-${state.reports.length + 1}`,
          ...(reporterId ? { reporterId } : {}),
          targetType: target.type,
          targetId: target.id,
          reason,
          ...(details ? { details } : {}),
          status: 'created',
          idempotencyKey,
          createdAt: clock.now().toISOString(),
        });
        await saveState({
          ...state,
          reports: [...state.reports, record],
          reportKeys: { ...state.reportKeys, [idempotencyKey]: record.id },
        });
        return receipt(record);
      }),
    listMyReports: (input) =>
      respond('data', (requestId) => {
        const me = requireOwnCard(requestId);
        const { cursor, limit } = parseOrFail(ListQuery, input ?? {}, requestId);
        // Newest first; among equal times the later one wins.
        const mine = allReports()
          .filter((r) => r.reporterId === me.id)
          .reverse()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return ReportPage.parse(
          page(mine.map(toReportView), cursor, limit ?? DEFAULT_PAGE_SIZE, requestId),
        );
      }),
    setBlock: (input) =>
      respond('data', async (requestId) => {
        const me = requireOwnCard(requestId);
        const { target, active } = parseOrFail(SetBlockInput, input, requestId);
        const answer = (blocked: boolean) => BlockState.parse({ target, blocked });

        if (target.type === 'block') {
          // «Заблокированные» only lifts; an entry already gone is already lifted.
          if (active) {
            fail(requestId, {
              code: 'VALIDATION_ERROR',
              message: 'A block entry can only be lifted.',
              fieldErrors: { target: 'invalid' },
            });
          }
          await saveState({
            ...state,
            blocks: state.blocks.filter((b) => !(b.id === target.id && b.blockerId === me.id)),
          });
          return answer(false);
        }

        // The person behind the target, whether or not their content is still shown:
        // a retried request finds it hidden by the block it has just made.
        const otherId =
          target.type === 'user'
            ? member(target.id)?.id
            : target.type === 'post'
              ? postById(target.id)?.authorId
              : allComments().find((c) => c.id === target.id)?.authorId;
        if (!otherId || !member(otherId)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Nobody to block here.' });
        }
        if (otherId === me.id) {
          fail(requestId, { code: 'CONFLICT', message: 'Nobody blocks themselves.' });
        }
        const mine = (b: BlockRecord) => b.blockerId === me.id && b.blockedId === otherId;
        const others = state.blocks.filter((b) => !mine(b));
        if (active !== state.blocks.some(mine)) {
          // A Блокировка removes the Подписки both ways; lifting it does not restore them.
          const base = active
            ? withoutFollows(
                state,
                (f) =>
                  samePair(f, { followerId: me.id, followingId: otherId }) ||
                  samePair(f, { followerId: otherId, followingId: me.id }),
              )
            : state;
          await saveState({
            ...base,
            blocks: active
              ? [
                  ...others,
                  BlockRecord.parse({
                    id: `block-${me.id}-${otherId}`,
                    blockerId: me.id,
                    blockedId: otherId,
                    createdAt: clock.now().toISOString(),
                  }),
                ]
              : others,
          });
        }
        return answer(active);
      }),
    listBlocked: (input) =>
      respond('data', (requestId) => {
        const me = requireOwnCard(requestId);
        const viewer = viewerOf(effectiveSession());
        const { cursor, limit } = parseOrFail(ListQuery, input ?? {}, requestId);
        // Newest first; among equal times the later one wins.
        const items = state.blocks
          .filter((b) => b.blockerId === me.id)
          .reverse()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .flatMap((b) => {
            const person = member(b.blockedId);
            return person
              ? [{ blockId: b.id, person: toAuthorView(person, viewer), createdAt: b.createdAt }]
              : [];
          });
        return BlockedPage.parse(page(items, cursor, limit ?? DEFAULT_PAGE_SIZE, requestId));
      }),
    listReports: (input) =>
      respond('data', (requestId) => {
        const moderator = requireModerator(requestId);
        const { status, cursor } = parseOrFail(ReportsQuery, input ?? {}, requestId);
        // Newest first; among equal times the later one wins.
        const items = allReports()
          .filter((r) => !status || r.status === status)
          .filter((r) => reportTargetAuthor(r.targetType, r.targetId)?.id !== moderator.userId)
          .reverse()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return ModerationReportPage.parse(
          page(items.map(toModerationView), cursor, DEFAULT_PAGE_SIZE, requestId),
        );
      }),
    openReport: (input) =>
      respond('data', async (requestId) => {
        const moderator = requireModerator(requestId);
        const { reportId } = parseOrFail(ReportRef, input, requestId);
        const record = moderatedReport(requestId, moderator, reportId);
        if (record.status !== 'created') return toModerationView(record);
        await saveState({
          ...state,
          reportUpdates: { ...state.reportUpdates, [record.id]: { status: 'reviewing' } },
        });
        return toModerationView({ ...record, status: 'reviewing' });
      }),
    resolveReport: (input) =>
      respond('data', async (requestId) => {
        const moderator = requireModerator(requestId);
        const { reportId, resolution } = parseOrFail(ResolveReportInput, input, requestId);
        const record = moderatedReport(requestId, moderator, reportId);
        if (record.status === 'resolved') {
          fail(requestId, { code: 'CONFLICT', message: 'The report is already decided.' });
        }
        const author = reportTargetAuthor(record.targetType, record.targetId);
        const person = author ? member(author.id) : undefined;
        let next: MockState = state;

        if (resolution === 'content_removed') {
          // Removed exactly as its author would delete it.
          const postId =
            record.targetType === 'post'
              ? record.targetId
              : record.targetType === 'plan'
                ? allPosts().find((p) => p.planId === record.targetId)?.id
                : undefined;
          if (postId) {
            next = { ...next, deletedPostIds: [...new Set([...next.deletedPostIds, postId])] };
          } else if (record.targetType === 'comment') {
            next = {
              ...next,
              deletedCommentIds: [...new Set([...next.deletedCommentIds, record.targetId])],
            };
          } else {
            fail(requestId, { code: 'CONFLICT', message: 'There is no content to remove.' });
          }
        }
        if (resolution === 'member_restricted') {
          if (!person || isRestricted(person)) {
            fail(requestId, { code: 'CONFLICT', message: 'Nobody to restrict here.' });
          }
          next = {
            ...next,
            restrictedSubjects: [...new Set([...next.restrictedSubjects, person.aituSubjectId])],
          };
        }

        // One decision closes every open report on the same target.
        const decided = { status: 'resolved' as const, outcome: resolution };
        const updates = { ...next.reportUpdates };
        for (const r of allReports()) {
          const sameTarget = r.targetType === record.targetType && r.targetId === record.targetId;
          if (r.id === record.id || (sameTarget && r.status !== 'resolved')) {
            updates[r.id] = decided;
          }
        }
        await saveState({ ...next, reportUpdates: updates });
        return toModerationView({ ...record, ...decided });
      }),

    renewMembership: (input) =>
      respond(
        'data',
        async (requestId) => {
          const parsed = RenewMembershipInput.safeParse(input);
          if (!parsed.success) {
            fail(requestId, {
              code: 'VALIDATION_ERROR',
              message: 'Exactly one period and an idempotency key are required.',
              fieldErrors: { selection: 'invalid' },
            });
          }
          const { selection, idempotencyKey } = parsed.data;

          // A retried checkout returns the renewal it already made, never a second one.
          const renewedId = state.renewals[idempotencyKey];
          const renewed = renewedId ? member(renewedId) : undefined;
          if (renewed) return toMyProfile(renewed);

          const current = effectiveSession();
          const record = current.userId ? member(current.userId) : undefined;
          if (!record || current.accessState === 'GUEST_PREVIEW') {
            fail(requestId, { code: 'UNAUTHENTICATED', message: 'Log in to renew.' });
          }
          if (current.accessState !== 'ACTIVE_MEMBER_EXPIRED') {
            fail(requestId, { code: 'CONFLICT', message: 'The membership is still active.' });
          }

          const now = clock.now().toISOString();
          const updated: MemberRecord = {
            ...record,
            membership: {
              tier: selection.tier,
              periodMonths: selection.periodMonths,
              startsAt: now,
              endsAt: addMonths(now, selection.periodMonths),
            },
          };
          const expiredMemberships = { ...state.expiredMemberships };
          delete expiredMemberships[record.id];
          // One write: new dates, receipt and idempotency record land together.
          await saveMember(updated, {
            renewals: { ...state.renewals, [idempotencyKey]: record.id },
            payments: {
              ...state.payments,
              [idempotencyKey]: {
                reference: `mock-pay-${Object.keys(state.payments).length + 1}`,
                amountKzt: access.priceOf(selection),
                paidAt: now,
              },
            },
            expiredMemberships,
          });
          await setSession({ ...session, accessState: 'ACTIVE_MEMBER' });
          return toMyProfile(updated);
        },
        (input as Partial<RenewMembershipInput> | undefined)?.selection?.tier === 'paid' ? 1500 : 0,
      ),

    setReaction: (input) =>
      respond('data', async (requestId) => {
        const me = requireActiveMember(requestId);
        const parsed = SetReactionInput.safeParse(input);
        if (!parsed.success) {
          fail(requestId, { code: 'VALIDATION_ERROR', message: parsed.error.message });
        }
        const { postId, active } = parsed.data;
        const post = postById(postId);
        if (!post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Post not found.' });
        }
        const mine = (r: { userId: string; postId: string }) =>
          r.userId === me.id && r.postId === postId;
        const others = state.reactions.filter((r) => !mine(r));
        const has = reactionsOf(postId).some(mine);
        // Setting the same value twice is a no-op, so a retried request is safe.
        if (active !== has) {
          await saveState({
            ...state,
            reactions: active
              ? [...others, { userId: me.id, postId, createdAt: clock.now().toISOString() }]
              : others,
          });
        }
        return ReactionState.parse({
          postId,
          reactions: reactionsOf(postId).length,
          reactedByMe: reactionsOf(postId).some(mine),
        });
      }),

    createComment: (input) =>
      respond('data', async (requestId) => {
        const me = requireActiveMember(requestId);
        const parsed = CreateCommentInput.safeParse(input);
        if (!parsed.success) {
          fail(requestId, {
            code: 'VALIDATION_ERROR',
            message: 'Check the reply text.',
            fieldErrors: access.fieldErrorsOf(parsed.error, ''),
          });
        }
        const { postId, parentId, text, idempotencyKey } = parsed.data;
        const viewer = viewerOf(effectiveSession());
        const toView = (c: CommentRecord): CommentView => ({
          id: c.id,
          postId: c.postId,
          ...(c.parentCommentId ? { parentId: c.parentCommentId } : {}),
          author: toAuthorView(me, viewer),
          text: c.text,
          createdAt: c.createdAt,
          reactions: commentReactionsOf(c.id).length,
          deleted: c.deleted,
          mine: true,
          reactedByMe: false,
        });

        // A retry of a request that already went through returns the same comment.
        const existingId = state.commentKeys[idempotencyKey];
        const existing = existingId ? allComments().find((c) => c.id === existingId) : undefined;
        if (existing) return CommentView.parse(toView(existing));

        const post = postById(postId);
        if (!post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Post not found.' });
        }
        if (parentId) {
          const parent = allComments().find((c) => c.id === parentId);
          const parentAuthor = parent ? member(parent.authorId) : undefined;
          if (!parent || parent.postId !== postId || parent.deleted || !isShown(parentAuthor)) {
            fail(requestId, { code: 'NOT_FOUND', message: 'Comment not found.' });
          }
          // Nothing answers an Ответ: the thread has two levels.
          if (parent.parentCommentId) {
            fail(requestId, {
              code: 'CONFLICT',
              message: 'Replies cannot be answered.',
              fieldErrors: { parentId: 'reply_depth' },
            });
          }
        }
        const record: CommentRecord = {
          id: `c-new-${state.comments.length + 1}`,
          postId,
          authorId: me.id,
          ...(parentId ? { parentCommentId: parentId } : {}),
          text,
          createdAt: clock.now().toISOString(),
          deleted: false,
        };
        await saveState({
          ...state,
          comments: [...state.comments, record],
          commentKeys: { ...state.commentKeys, [idempotencyKey]: record.id },
        });
        return CommentView.parse(toView(record));
      }),

    deleteComment: (input) =>
      respond('data', async (requestId) => {
        const me = requireOwnCard(requestId);
        const { commentId } = parseOrFail(CommentRef, input, requestId);
        const comment = allComments().find((c) => c.id === commentId);
        const post = comment ? postById(comment.postId) : undefined;
        if (!comment || comment.deleted || !post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Comment not found.' });
        }
        if (comment.authorId !== me.id) {
          fail(requestId, { code: 'FORBIDDEN', message: 'Only the author can delete a comment.' });
        }
        // Soft delete: a root keeps its place while its replies are there.
        await saveState({ ...state, deletedCommentIds: [...state.deletedCommentIds, commentId] });
        const viewer = viewerOf(effectiveSession());
        return CommentView.parse({
          id: comment.id,
          postId: comment.postId,
          ...(comment.parentCommentId ? { parentId: comment.parentCommentId } : {}),
          author: toAuthorView(me, viewer),
          text: '',
          createdAt: comment.createdAt,
          reactions: commentReactionsOf(comment.id).length,
          deleted: true,
          mine: true,
        });
      }),

    deletePost: (input) =>
      respond('data', async (requestId) => {
        const me = requireOwnCard(requestId);
        const { postId } = parseOrFail(PostRef, input, requestId);
        const post = postById(postId);
        if (!post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Post not found.' });
        }
        if (post.authorId !== me.id) {
          fail(requestId, { code: 'FORBIDDEN', message: 'Only the author can delete a post.' });
        }
        // A plan's post goes with the plan (cancelled in the plans spec), never on its own.
        if (post.planId) {
          fail(requestId, { code: 'CONFLICT', message: 'Cancel the plan instead.' });
        }
        await saveState({ ...state, deletedPostIds: [...state.deletedPostIds, postId] });
      }),

    setCommentReaction: (input) =>
      respond('data', async (requestId) => {
        const me = requireActiveMember(requestId);
        const { commentId, active } = parseOrFail(SetCommentReactionInput, input, requestId);
        const comment = allComments().find((c) => c.id === commentId);
        const post = comment ? postById(comment.postId) : undefined;
        const author = comment ? member(comment.authorId) : undefined;
        if (!comment || comment.deleted || !post || !isVisible(post) || !isShown(author)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Comment not found.' });
        }
        const mine = (r: { userId: string; commentId: string }) =>
          r.userId === me.id && r.commentId === commentId;
        const has = commentReactionsOf(commentId).some(mine);
        // Setting the same value twice is a no-op, so a retried request is safe.
        if (active !== has) {
          const others = state.commentReactions.filter((r) => !mine(r));
          await saveState({
            ...state,
            commentReactions: active
              ? [...others, { userId: me.id, commentId, createdAt: clock.now().toISOString() }]
              : others,
          });
        }
        return CommentReactionState.parse({
          commentId,
          reactions: commentReactionsOf(commentId).length,
          reactedByMe: commentReactionsOf(commentId).some(mine),
        });
      }),

    moderateMember: (input) =>
      respond('data', async (requestId) => {
        const current = effectiveSession();
        if (current.accessState === 'BLOCKED' || !current.roles.includes('moderator')) {
          fail(requestId, { code: 'FORBIDDEN', message: 'Moderators only.' });
        }
        const parsed = ModerateMemberInput.safeParse(input);
        if (!parsed.success) {
          fail(requestId, { code: 'VALIDATION_ERROR', message: parsed.error.message });
        }
        const target = member(parsed.data.memberId);
        if (!target) fail(requestId, { code: 'NOT_FOUND', message: 'Member not found.' });
        await setRestricted(target.aituSubjectId, parsed.data.decision === 'restrict');
        return ModerationResult.parse({ memberId: target.id, restricted: isRestricted(target) });
      }),

    async getDemoFlags(): Promise<DemoFlags> {
      await ready;
      return { ...state.demoFlags };
    },

    async setDemoFlags(patch) {
      await ready;
      await saveState({ ...state, demoFlags: { ...state.demoFlags, ...patch } });
      return { ...state.demoFlags };
    },

    async resetDemo() {
      await ready;
      await Promise.all([sessionSlot.clear(), stateSlot.clear()]);
      session = guestSession();
      state = defaultMockState();
    },

    async switchCandidate(candidateId) {
      await ready;
      if (!passportCandidates.some((c) => c.id === candidateId)) {
        throw new RepositoryError({ code: 'VALIDATION_ERROR', message: 'Unknown candidate.' });
      }
      // Park the current identity's unfinished flow and bring back the target's own.
      const parked = { ...state.parkedFlows };
      const currentFlow = state.accessFlow;
      if (currentFlow?.candidateId) parked[currentFlow.candidateId] = currentFlow;
      const restored = parked[candidateId] ?? null;
      delete parked[candidateId];
      await saveState({ ...state, accessFlow: restored, parkedFlows: parked });
      await setSession({ accessState: 'GUEST_PREVIEW', roles: [], candidateId });
    },

    async listCandidateStatus() {
      await ready;
      return passportCandidates.map((c) => ({
        candidateId: c.id,
        name: c.name,
        hasCard: hasCard(c.id),
      }));
    },

    async expireMembership() {
      await ready;
      const record = session.userId ? member(session.userId) : undefined;
      if (!record) throw new RepositoryError({ code: 'CONFLICT', message: 'Not a member.' });
      if (isExpired(record)) return;
      await saveMember(
        { ...record, membership: { ...record.membership, endsAt: clock.now().toISOString() } },
        {
          expiredMemberships: {
            ...state.expiredMemberships,
            [record.id]: record.membership.endsAt,
          },
        },
      );
      await setSession({ ...session, accessState: 'ACTIVE_MEMBER_EXPIRED' });
    },

    async restoreMembership() {
      await ready;
      const record = session.userId ? member(session.userId) : undefined;
      if (!record) throw new RepositoryError({ code: 'CONFLICT', message: 'Not a member.' });
      const saved = state.expiredMemberships[record.id];
      const now = clock.now();
      const endsAt =
        saved && new Date(saved) > now
          ? saved
          : addMonths(now.toISOString(), record.membership.periodMonths);
      const expiredMemberships = { ...state.expiredMemberships };
      delete expiredMemberships[record.id];
      await saveMember(
        { ...record, membership: { ...record.membership, endsAt } },
        {
          expiredMemberships,
        },
      );
      await setSession({ ...session, accessState: 'ACTIVE_MEMBER' });
    },

    async setCurrentRestricted(restricted) {
      await ready;
      const subject = currentSubject();
      if (!subject) {
        throw new RepositoryError({
          code: 'CONFLICT',
          message: 'Choose a Passport identity first.',
        });
      }
      await setRestricted(subject, restricted);
    },

    async setModeratorRole(enabled) {
      await ready;
      const roles = session.roles.filter((r) => r !== 'moderator');
      await setSession({ ...session, roles: enabled ? [...roles, 'moderator'] : roles });
    },

    async takeResetNotice() {
      await ready;
      const notice = resetNotice;
      resetNotice = undefined;
      return notice;
    },
  };
}
