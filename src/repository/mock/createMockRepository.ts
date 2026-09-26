import type { Clock } from '@/clock';
import {
  AccessFlowState,
  CompleteOnboardingInput,
  ConfirmPaymentInput,
  MyProfile,
  FeedPage,
  FeedQuery,
  PassportCandidate,
  RepositoryError,
  Session,
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
import { selectFeed } from './feed';
import type { MemberRecord, PostRecord, SeedData } from './records';
import { loadSeed } from './seed';
import { passportCandidates } from './seed/candidates';
import { toPostView, type PostCounters, type ShapingContext, type Viewer } from './shaping';

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
  /** Seed community plus members who joined during the demo. */
  function member(id: string): MemberRecord | undefined {
    return seedMembersById.get(id) ?? state.members.find((m) => m.id === id);
  }
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

  function counters(postId: string): PostCounters {
    return {
      reactions: data.reactions.filter((r) => r.postId === postId).length,
      reposts: data.reposts.filter((r) => r.postId === postId).length,
      commentsCount: data.comments.filter((c) => c.postId === postId && !c.deleted).length,
    };
  }

  function isVisible(post: PostRecord): boolean {
    const author = member(post.authorId);
    return !!author && !author.restricted;
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
    const expired = new Date(record.membership.endsAt) <= clock.now();
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

  /** The stored session plus what the client may derive from it. */
  function publicSession(): Session {
    const canLogin = session.accessState === 'GUEST_PREVIEW' && hasCard(session.candidateId);
    return Session.parse({ ...session, ...(canLogin ? { canLogin: true } : {}) });
  }

  function addMonths(iso: string, months: number): string {
    const date = new Date(iso);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString();
  }

  function viewerOf(current: Session): Viewer {
    return { accessState: current.accessState, userId: current.userId };
  }

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
        const expired = new Date(record.membership.endsAt) <= clock.now();
        return setSession({
          accessState: expired ? 'ACTIVE_MEMBER_EXPIRED' : 'ACTIVE_MEMBER',
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

        const ctx: ShapingContext = {
          viewer,
          member: (id) => member(id),
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

    async takeResetNotice() {
      await ready;
      const notice = resetNotice;
      resetNotice = undefined;
      return notice;
    },
  };
}
