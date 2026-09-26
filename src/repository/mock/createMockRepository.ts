import type { Clock } from '@/clock';
import {
  AccessFlowState,
  CommentPage,
  CommentQuery,
  CommentView,
  CompleteOnboardingInput,
  ConfirmPaymentInput,
  MyProfile,
  FeedPage,
  FeedQuery,
  ModerateMemberInput,
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
  RepositoryError,
  Session,
  SetReactionInput,
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
import type { CommentRecord, MemberRecord, PostRecord, SeedData } from './records';
import { loadSeed } from './seed';
import { passportCandidates } from './seed/candidates';
import {
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
  const postsById = new Map(data.posts.map((p) => [p.id, p]));

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

  function counters(postId: string): PostCounters {
    return {
      reactions: reactionsOf(postId).length,
      reposts: [...data.reposts, ...state.reposts].filter((r) => r.postId === postId).length,
      commentsCount: allComments().filter((c) => c.postId === postId && !c.deleted).length,
    };
  }

  /** Ограничение comes from the seed or from a moderation decision during the demo. */
  function isRestricted(record: MemberRecord): boolean {
    return record.restricted || state.restrictedSubjects.includes(record.aituSubjectId);
  }

  function isVisible(post: PostRecord): boolean {
    const author = member(post.authorId);
    return !!author && !isRestricted(author) && !state.deletedPostIds.includes(post.id);
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
      post: (id) => postsById.get(id),
      counters,
      reactedByMe: (postId) => reactionsOf(postId).some((r) => r.userId === viewer.userId),
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
        const post = postsById.get(postId);
        if (!post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Post not found.' });
        }
        return PostView.parse(toPostView(post, shapingContext(viewer)));
      }),

    listComments: (query) =>
      respond('data', (requestId) => {
        const viewer = requireReader(requestId);
        const { postId, sort, cursor, limit } = parseOrFail(CommentQuery, query, requestId);
        const post = postsById.get(postId);
        if (!post || !isVisible(post)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Post not found.' });
        }
        // Comments of restricted people are hidden like their posts; a deleted reply is
        // gone, a deleted root stays only while it still has replies to hold together.
        const visible = allComments().filter((c) => {
          const author = member(c.authorId);
          return (
            c.postId === postId &&
            !!author &&
            !isRestricted(author) &&
            !(c.deleted && c.parentCommentId)
          );
        });
        const threads = buildThreads(visible, sort, (id) => commentReactionsOf(id).length).filter(
          (t) => !t.root.deleted || t.replies.length > 0,
        );
        const full = seesFullView(viewer);
        const toView = (c: CommentRecord): CommentView => ({
          id: c.id,
          postId: c.postId,
          ...(c.parentCommentId ? { parentId: c.parentCommentId } : {}),
          author: toAuthorView(member(c.authorId)!, viewer),
          text: c.deleted ? '' : c.text,
          createdAt: c.createdAt,
          reactions: commentReactionsOf(c.id).length,
          deleted: c.deleted,
          ...(full
            ? {
                mine: c.authorId === viewer.userId,
                reactedByMe: commentReactionsOf(c.id).some((r) => r.userId === viewer.userId),
              }
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
        if (!record || isRestricted(record)) {
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
            posts: data.posts.filter((p) => p.authorId === record.id).length,
            followers: data.follows.filter((f) => f.followingId === record.id).length,
            following: data.follows.filter((f) => f.followerId === record.id).length,
          },
          ...(full
            ? {
                relation: {
                  following: data.follows.some(
                    (f) => f.followerId === viewer.userId && f.followingId === record.id,
                  ),
                  followsMe: data.follows.some(
                    (f) => f.followerId === record.id && f.followingId === viewer.userId,
                  ),
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
        if (!record || isRestricted(record)) {
          fail(requestId, { code: 'NOT_FOUND', message: 'Member not found.' });
        }
        const posts = data.posts
          .filter((p) => p.authorId === memberId)
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
        const post = data.posts.find((p) => p.planId === planId);
        if (!plan || !author || isRestricted(author) || !post) {
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

    createPost: notImplemented('createPost'),
    deletePost: notImplemented('deletePost'),
    createComment: notImplemented('createComment'),
    deleteComment: notImplemented('deleteComment'),
    setRepost: notImplemented('setRepost'),
    setFollow: notImplemented('setFollow'),
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
    createReport: notImplemented('createReport'),
    setBlock: notImplemented('setBlock'),
    listBlocked: notImplemented('listBlocked'),
    listReports: notImplemented('listReports'),
    resolveReport: notImplemented('resolveReport'),

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
        const post = postsById.get(postId);
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
