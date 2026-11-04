import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  ApiErrorCode,
  CLUB_RULES_VERSION,
  isRepositoryError,
  repositoryContract,
  repositoryMethods,
  type AituRepository,
  type QuestionnaireAnswers,
  type RepositoryMethod,
} from '@/contracts';

import { createMockRepository, type MockRepository } from './createMockRepository';

const answers: QuestionnaireAnswers = {
  city: ['750000000'],
  intent: ['dating'],
  communication: ['messages_first'],
  pace: ['gradual'],
  firstMeeting: ['coffee_talk'],
  boundaries: ['public_place'],
  dateFormat: ['walk'],
};

const key = 'sample-key-0001';

/** One valid input per method; the mapped type fails to compile if a method is missing. */
const samples: { [K in RepositoryMethod]: Parameters<AituRepository[K]>[0] } = {
  getSession: undefined,
  logout: undefined,
  login: undefined,
  listPassportCandidates: undefined,
  getAccessFlow: undefined,
  startAccess: undefined,
  selectPassport: { candidateId: 'passport-2' },
  acceptRules: { rulesVersion: CLUB_RULES_VERSION },
  selectMembership: { tier: 'paid', periodMonths: 3 },
  confirmPayment: { idempotencyKey: key },
  saveProfileStep: { bio: 'Коротко.', interests: ['coffee'], communicationStyle: 'short_messages' },
  saveAnswer: { question: 'city', answer: ['750000000'] },
  completeOnboarding: { answers, idempotencyKey: key },
  getMyProfile: undefined,
  updateMyCard: { bio: 'Новое о себе.', interests: ['books'], communicationStyle: 'calm_dialogue' },
  renewMembership: { selection: { tier: 'paid', periodMonths: 1 }, idempotencyKey: key },
  getHomeFeed: { tab: 'for_you' },
  getPost: { postId: 'p01' },
  createPost: { type: 'post', text: 'Привет', topics: [], idempotencyKey: key },
  deletePost: { postId: 'p01' },
  listComments: { postId: 'p01', sort: 'popular' },
  createComment: { postId: 'p01', text: 'Согласен', idempotencyKey: key },
  deleteComment: { commentId: 'c01' },
  setReaction: { postId: 'p01', reaction: 'like', active: true },
  setCommentReaction: { commentId: 'c-p01-4', active: true },
  setRepost: { postId: 'p01', active: true },
  getProfile: { memberId: 'm01' },
  listProfilePosts: { memberId: 'm01' },
  setFollow: { memberId: 'm01', active: true },
  listFollowers: { memberId: 'm01' },
  listFollowing: { memberId: 'me-passport-1' },
  search: { kind: 'people', text: 'кофе' },
  getPlan: { planId: 'plan1' },
  createPlan: {
    city: '750000000',
    date: '2026-10-05',
    timeStart: '18:00',
    format: 'coffee',
    durationMinutes: 60,
    goal: 'talk',
    paymentPolicy: 'each_pays',
    budget: 'from_3000_to_7000',
    placeArea: 'Центр города',
    description: 'Кофе и разговор.',
    place: 'Кофейня у парка',
    isPublicPlace: true,
    topics: [],
    idempotencyKey: key,
  },
  cancelPlan: { planId: 'plan1' },
  closePlan: { planId: 'plan1' },
  listPlanResponses: { planId: 'plan1' },
  respondToPlan: { planId: 'plan1', idempotencyKey: key },
  acceptPlanResponse: { responseId: 'response-1' },
  declinePlanResponse: { responseId: 'response-1' },
  withdrawPlanResponse: { responseId: 'response-1' },
  leaveMeeting: { planId: 'plan4' },
  listMyPlans: {},
  listMyResponses: {},
  openChat: { kind: 'mutual_follow', memberId: 'm01' },
  listChats: {},
  getChat: { chatId: 'chat-1' },
  listMessages: { chatId: 'chat-1' },
  sendMessage: { chatId: 'chat-1', text: 'Привет', idempotencyKey: key },
  retryMessage: { messageId: 'message-1' },
  markChatRead: { chatId: 'chat-1' },
  countUnreadMessages: undefined,
  listActivity: { category: 'all' },
  markActivitySeen: undefined,
  getFeedFilters: undefined,
  listMyActions: { category: 'all' },
  updateMyPhotos: { photoIds: [] },
  uploadPhoto: {
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    dataUrl: 'data:image/jpeg;base64,AAAA',
    idempotencyKey: key,
  },
  updateFeedFilters: {
    city: ['750000000'],
    interests: ['coffee'],
    topics: [],
    intent: [],
    format: ['walk'],
    goal: [],
    budget: [],
    payment: [],
    soon: ['week'],
    days: [],
  },
  createReport: { target: { type: 'post', id: 'p01' }, reason: 'spam', idempotencyKey: key },
  listMyReports: {},
  setBlock: { target: { type: 'user', id: 'm01' }, active: true },
  listBlocked: {},
  listReports: {},
  openReport: { reportId: 'report4' },
  resolveReport: { reportId: 'report5', resolution: 'dismissed' },
  moderateMember: { memberId: 'm02', decision: 'restrict' },
  listAppeals: {},
  decideAppeal: { appealId: 'appeal-1', decision: 'lift' },
  getMyRestriction: undefined,
  createAppeal: { text: 'Прошу пересмотреть решение.', idempotencyKey: key },
  createSupportRequest: { topic: 'other', text: 'Вопрос по аккаунту.', idempotencyKey: key },
  listMySupportRequests: {},
  getSettings: undefined,
  updateSettings: { notifications: { follows: false } },
};

/** Behaviour that ships with the foundation; everything else arrives in later specs. */
const implemented = new Set<RepositoryMethod>([
  'getSession',
  'logout',
  'login',
  'listPassportCandidates',
  'getAccessFlow',
  'startAccess',
  'selectPassport',
  'acceptRules',
  'selectMembership',
  'confirmPayment',
  'saveProfileStep',
  'saveAnswer',
  'completeOnboarding',
  'getMyProfile',
  'updateMyCard',
  'renewMembership',
  'getHomeFeed',
  'getPost',
  'listComments',
  'setReaction',
  'setCommentReaction',
  'setRepost',
  'createPost',
  'createComment',
  'deleteComment',
  'deletePost',
  'getProfile',
  'listProfilePosts',
  'setFollow',
  'listFollowers',
  'listFollowing',
  'search',
  'getPlan',
  'createPlan',
  'cancelPlan',
  'closePlan',
  'listPlanResponses',
  'respondToPlan',
  'acceptPlanResponse',
  'declinePlanResponse',
  'withdrawPlanResponse',
  'leaveMeeting',
  'listMyPlans',
  'listMyResponses',
  'openChat',
  'listChats',
  'getChat',
  'listMessages',
  'sendMessage',
  'retryMessage',
  'markChatRead',
  'countUnreadMessages',
  'listActivity',
  'markActivitySeen',
  'getFeedFilters',
  'updateFeedFilters',
  'uploadPhoto',
  'updateMyPhotos',
  'listMyActions',
  'createReport',
  'listMyReports',
  'setBlock',
  'listBlocked',
  'listReports',
  'openReport',
  'resolveReport',
  'moderateMember',
  'listAppeals',
  'decideAppeal',
  'getMyRestriction',
  'createAppeal',
  'createSupportRequest',
  'listMySupportRequests',
  'getSettings',
  'updateSettings',
]);

/** Reads that must answer with data for an active member with the moderator role. */
const answersWithData = new Set<RepositoryMethod>([
  'getSession',
  'listPassportCandidates',
  'getMyProfile',
  'updateMyCard',
  'getHomeFeed',
  'getPost',
  'listComments',
  'setReaction',
  'setCommentReaction',
  'setRepost',
  'createPost',
  'createComment',
  'getProfile',
  'listProfilePosts',
  'setFollow',
  'listFollowers',
  'listFollowing',
  'search',
  'getPlan',
  'createPlan',
  'respondToPlan',
  'listMyPlans',
  'listMyResponses',
  'listChats',
  'countUnreadMessages',
  'listActivity',
  'markActivitySeen',
  'getFeedFilters',
  'updateFeedFilters',
  'uploadPhoto',
  'createReport',
  'listMyReports',
  'setBlock',
  'listBlocked',
  'listReports',
  'openReport',
  'resolveReport',
  'moderateMember',
  'listAppeals',
  'getMyRestriction',
  'createSupportRequest',
  'listMySupportRequests',
  'getSettings',
  'updateSettings',
]);

async function activeModerator(): Promise<MockRepository> {
  const repo = createMockRepository({ clock: fixedClock(), latency: 0 });
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-1' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'paid', periodMonths: 12 });
  await repo.confirmPayment({ idempotencyKey: 'join-checkout' });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    interests: ['coffee'],
    communicationStyle: 'short_messages',
  });
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-registry' });
  await repo.setModeratorRole(true);
  return repo;
}

describe('frozen contract', () => {
  it('lists every repository method the mock implements', async () => {
    const repo = await activeModerator();
    for (const method of repositoryMethods) {
      expect(typeof (repo as unknown as Record<string, unknown>)[method]).toBe('function');
    }
  });

  it.each(repositoryMethods)('%s: the sample input matches the input schema', (method) => {
    const result = repositoryContract[method].input.safeParse(samples[method]);
    expect(result.error).toBeUndefined();
  });

  it.each(repositoryMethods)(
    '%s: answers with data by the output schema or a typed error',
    async (method) => {
      const repo = await activeModerator();
      const call = repo[method] as (input: unknown) => Promise<unknown>;
      let outcome: { ok: true; value: unknown } | { ok: false; error: unknown };
      try {
        outcome = { ok: true, value: await call(samples[method]) };
      } catch (error) {
        outcome = { ok: false, error };
      }

      if (outcome.ok) {
        const parsed = repositoryContract[method].output.safeParse(outcome.value);
        expect(parsed.error).toBeUndefined();
        expect(implemented.has(method)).toBe(true);
        return;
      }
      expect(isRepositoryError(outcome.error)).toBe(true);
      if (!isRepositoryError(outcome.error)) return;
      expect(ApiErrorCode.options).toContain(outcome.error.code);
      expect(outcome.error.requestId).toBeTruthy();
      if (implemented.has(method)) {
        expect(outcome.error.code).not.toBe('NOT_IMPLEMENTED');
        expect(answersWithData.has(method)).toBe(false);
      } else {
        expect(outcome.error.code).toBe('NOT_IMPLEMENTED');
      }
    },
  );
});
