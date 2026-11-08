import { z } from 'zod';

import {
  AppealStatus,
  ChatContext,
  ReportReason,
  RestrictionTerm,
  SupportTopic,
  AccessFlowStep,
  FeedFilters,
  fromLegacyFeedFilters,
  keepKnownFeedFilters,
  StoredPlanStatus,
  UserSettings,
  MembershipSelection,
  PartialAnswers,
  PaymentReceipt,
  PHOTO_TYPES,
  VOICE_TYPES,
  ProfileStepInput,
} from '@/contracts';

import {
  BlockRecord,
  ChatRecord,
  CommentReactionRecord,
  CommentRecord,
  FollowRecord,
  MemberRecord,
  MessageRecord,
  PlanRecord,
  PlanResponseRecord,
  PostRecord,
  ReactionRecord,
  ReportRecord,
  RepostRecord,
} from './records';

/**
 * Mock-only switches for demos and QA. They live next to the mock backend, not in the
 * product contract: a real backend has no «fail the next request» button.
 */
export const DemoFlags = z.strictObject({
  /** The next data request fails with NETWORK_ERROR, then the flag clears itself. */
  networkErrorOnce: z.boolean(),
  /** Every data request fails with NETWORK_ERROR until switched off. */
  offline: z.boolean(),
  /** The next message send fails (used by the chats ticket). */
  failedMessageOnce: z.boolean(),
});
export type DemoFlags = z.infer<typeof DemoFlags>;

export const defaultDemoFlags = (): DemoFlags => ({
  networkErrorOnce: false,
  offline: false,
  failedMessageOnce: false,
});

/** Server-side record of the visitor's progress through the access flow. */
export const AccessFlowRecord = z.strictObject({
  step: AccessFlowStep,
  candidateId: z.string().optional(),
  rulesAcceptedVersion: z.string().optional(),
  membership: MembershipSelection.optional(),
  payment: PaymentReceipt.optional(),
  profile: ProfileStepInput.optional(),
  answers: PartialAnswers.optional(),
});
export type AccessFlowRecord = z.infer<typeof AccessFlowRecord>;

/** Persisted mutable state of the mock backend. Later tickets add created records here. */
export const MockState = z.strictObject({
  demoFlags: DemoFlags,
  accessFlow: AccessFlowRecord.nullable(),
  /** Completed mock checkouts by idempotency key, so a retried request is not charged twice. */
  payments: z.record(z.string(), PaymentReceipt),
  /** Members who joined during the demo (the seed community is read-only). */
  members: z.array(MemberRecord),
  /** Completed onboardings by idempotency key → member id, so a retry publishes once. */
  onboardings: z.record(z.string(), z.string()),
  /** Unfinished access flows of other Passport identities, kept while switching. */
  parkedFlows: z.record(z.string(), AccessFlowRecord),
  /** Reactions made during the demo, on top of the seed ones. */
  reactions: z.array(ReactionRecord),
  /** Completed renewals by idempotency key → member id, so a retry renews once. */
  renewals: z.record(z.string(), z.string()),
  /** Membership end dates saved by «Истечь membership», so «Восстановить» brings them back. */
  expiredMemberships: z.record(z.string(), z.string()),
  /** Aitu subject ids under Ограничение, decided by moderation. */
  restrictedSubjects: z.array(z.string()),
  /** Why and for how long each Aitu subject was last restricted (kept after it ends). */
  restrictionDetails: z.record(
    z.string(),
    z.strictObject({
      id: z.string(),
      reason: ReportReason,
      term: RestrictionTerm,
      decidedAt: z.string(),
      endsAt: z.string().optional(),
    }),
  ),
  /** Апелляции, one per Ограничение. */
  appeals: z.array(
    z.strictObject({
      id: z.string(),
      restrictionId: z.string(),
      subjectId: z.string(),
      text: z.string(),
      status: AppealStatus,
      createdAt: z.string(),
      decidedAt: z.string().optional(),
      idempotencyKey: z.string(),
    }),
  ),
  /** Обращения в поддержку by Aitu subject. */
  supportRequests: z.array(
    z.strictObject({
      id: z.string(),
      subjectId: z.string(),
      topic: SupportTopic,
      text: z.string(),
      createdAt: z.string(),
      idempotencyKey: z.string(),
    }),
  ),
  /** Messages moderation removed: gone from the chat for both. */
  deletedMessageIds: z.array(z.string()),
  /** Server-side settings per member. */
  settings: z.record(z.string(), UserSettings),
  /** Comments and replies written during the demo. */
  comments: z.array(CommentRecord),
  /** Soft deletions by their authors, on top of the seed. */
  deletedCommentIds: z.array(z.string()),
  deletedPostIds: z.array(z.string()),
  commentReactions: z.array(CommentReactionRecord),
  reposts: z.array(RepostRecord),
  /** Created comments by idempotency key → comment id, so a retry publishes once. */
  commentKeys: z.record(z.string(), z.string()),
  /** Posts published during the demo, on top of the seed. */
  posts: z.array(PostRecord),
  /** Created posts by idempotency key → post id, so a retry publishes once. */
  postKeys: z.record(z.string(), z.string()),
  /** Жалобы sent during the demo, on top of the seed. */
  reports: z.array(ReportRecord),
  /** Created reports by idempotency key → report id, so a retry reports once. */
  reportKeys: z.record(z.string(), z.string()),
  /** Блокировки between members; the seed has none. */
  blocks: z.array(BlockRecord),
  /** Подписки made during the demo, on top of the seed. */
  follows: z.array(FollowRecord),
  /** Seed Подписки undone during the demo (unfollowed, or removed by a Блокировка). */
  unfollows: z.array(z.strictObject({ followerId: z.string(), followingId: z.string() })),
  /** Moderation's progress on reports, seed ones too: status and outcome by report id. */
  reportUpdates: z.record(
    z.string(),
    z.strictObject({
      status: z.enum(['created', 'reviewing', 'resolved']),
      outcome: z.enum(['dismissed', 'content_removed', 'member_restricted']).optional(),
    }),
  ),
  /** Plans created during the demo, on top of the seed. */
  plans: z.array(PlanRecord),
  /** Created plans by idempotency key → plan id, so a retry publishes once. */
  planKeys: z.record(z.string(), z.string()),
  /** Status changes by plan id, seed plans too: closed, matched, cancelled. */
  /** When the author changed it, for «Встреча отменена» and «Автор встречи закрыл набор». */
  planUpdates: z.record(
    z.string(),
    z.strictObject({ status: StoredPlanStatus, at: z.string().optional() }),
  ),
  /** Отклики sent during the demo. */
  planResponses: z.array(PlanResponseRecord),
  /** Chats opened during the demo, on top of the seed. */
  chats: z.array(ChatRecord),
  /** Messages written during the demo. */
  messages: z.array(MessageRecord),
  /** Контексты added to a chat after its first one, oldest first, by chat id. */
  chatContexts: z.record(z.string(), z.array(ChatContext)),
  /** Read marks by `chatId:userId`, seed chats too. */
  chatReads: z.record(z.string(), z.string()),
  /** When each member last opened «Уведомления». */
  activitySeenAt: z.record(z.string(), z.string()),
  /** The filter a member applied; until then nothing is chosen. */
  feedFilters: z.record(z.string(), FeedFilters),
  /** Who opened each План (its author aside), for «Популярное». */
  planOpens: z.record(z.string(), z.array(z.string())),
  /** Uploaded Фото: who owns each one. The pictures themselves live under their own keys. */
  photos: z.record(
    z.string(),
    z.strictObject({
      ownerId: z.string(),
      mimeType: z.enum(PHOTO_TYPES),
      createdAt: z.string(),
      /** Made by a generative model, by the original file's metadata. */
      ai: z.literal(true).optional(),
      /** A blurred stand-in is stored apart, under the picture's key plus «.preview». */
      preview: z.literal(true).optional(),
    }),
  ),
  photoKeys: z.record(z.string(), z.string()),
  /** Recorded voice messages: who owns each one and how long it is. */
  voices: z.record(
    z.string(),
    z.strictObject({
      ownerId: z.string(),
      mimeType: z.enum(VOICE_TYPES),
      durationMs: z.number().int().positive(),
      createdAt: z.string(),
    }),
  ),
  voiceKeys: z.record(z.string(), z.string()),
});
export type MockState = z.infer<typeof MockState>;

export const MOCK_STATE_VERSION = 26;

export const mockStateMigrations = [
  // v1 held only demo flags; v2 adds the access flow and mock payments.
  (v1: unknown) => ({ ...(v1 as object), accessFlow: null, payments: {} }),
  // v3 adds members created by onboarding.
  (v2: unknown) => ({ ...(v2 as object), members: [], onboardings: {} }),
  // v4 keeps unfinished flows per Passport identity.
  (v3: unknown) => ({ ...(v3 as object), parkedFlows: {} }),
  // v5 adds reactions, renewals and demo-expired memberships.
  (v4: unknown) => ({ ...(v4 as object), reactions: [], renewals: {}, expiredMemberships: {} }),
  // v6 adds moderation restrictions.
  (v5: unknown) => ({ ...(v5 as object), restrictedSubjects: [] }),
  // v7 adds member settings.
  (v6: unknown) => ({ ...(v6 as object), settings: {} }),
  // v8 adds what the post screen writes: comments, deletions, comment likes, reposts.
  (v7: unknown) => ({
    ...(v7 as object),
    comments: [],
    deletedCommentIds: [],
    deletedPostIds: [],
    commentReactions: [],
    reposts: [],
  }),
  // v9 remembers comment idempotency keys.
  (v8: unknown) => ({ ...(v8 as object), commentKeys: {} }),
  // v10 adds posts published in the editor and their idempotency keys.
  (v9: unknown) => ({ ...(v9 as object), posts: [], postKeys: {} }),
  // v11 adds reports sent during the demo and their idempotency keys.
  (v10: unknown) => ({ ...(v10 as object), reports: [], reportKeys: {} }),
  // v12 adds Блокировки.
  (v11: unknown) => ({ ...(v11 as object), blocks: [] }),
  // v13 adds moderation decisions on reports.
  (v12: unknown) => ({ ...(v12 as object), reportUpdates: {} }),
  // v14 adds Подписки made and undone during the demo.
  (v13: unknown) => ({ ...(v13 as object), follows: [], unfollows: [] }),
  // v15 adds plans, their status changes and Отклики.
  (v14: unknown) => ({
    ...(v14 as object),
    plans: [],
    planKeys: {},
    planUpdates: {},
    planResponses: [],
  }),
  // v16 adds chats, messages, read marks and when «Активность» was last seen.
  (v15: unknown) => ({
    ...(v15 as object),
    chats: [],
    messages: [],
    chatReads: {},
    activitySeenAt: {},
  }),
  // v17 adds members' Фильтры ленты and who opened each План.
  (v16: unknown) => ({ ...(v16 as object), feedFilters: {}, planOpens: {} }),
  // v18 drops the free tier: every Membership and every chosen period is paid.
  (v17: unknown) => JSON.parse(JSON.stringify(v17).replaceAll('"free_verified"', '"paid"')),
  // v19 adds uploaded Фото and their idempotency keys.
  (v18: unknown) => ({ ...(v18 as object), photos: {}, photoKeys: {} }),
  // v20 lets one chat gather several Контексты.
  (v19: unknown) => ({ ...(v19 as object), chatContexts: {} }),
  // v21 gives each Ограничение a reason and a term (an earlier one is until lifted), and
  // adds Апелляции, Обращения в поддержку and messages removed by moderation.
  (v20: unknown) => {
    const prev = v20 as { restrictedSubjects?: string[] };
    const restrictionDetails = Object.fromEntries(
      (prev.restrictedSubjects ?? []).map((subject, i) => [
        subject,
        {
          id: `restriction-legacy-${i + 1}`,
          reason: 'other',
          term: 'permanent',
          decidedAt: '2026-09-26T12:00:00.000Z',
        },
      ]),
    );
    return {
      ...(v20 as object),
      restrictionDetails,
      appeals: [],
      supportRequests: [],
      deletedMessageIds: [],
    };
  },
  // v22: the five cities become KATO codes («Другой город» is not named any more), and the
  // Анкета answers become lists; the Намерение lives only in the Анкета.
  (v21: unknown) => toSettlementsAndLists(v21),
  // v23: one filter for «Поиск» and «Мои подписки»; saved ones keep cities and Намерения.
  (v22: unknown) => {
    const old = v22 as { feedFilters?: Record<string, unknown> };
    return {
      ...old,
      feedFilters: Object.fromEntries(
        Object.entries(old.feedFilters ?? {}).map(([id, f]) => [id, fromLegacyFeedFilters(f)]),
      ),
    };
  },
  // v24: a Вопрос is an ordinary post, and a post keeps its first Фото only.
  (v23: unknown) => {
    const old = v23 as { posts?: Record<string, unknown>[] };
    return {
      ...old,
      posts: (old.posts ?? []).map((post) => ({
        ...post,
        type: post.type === 'question' ? 'post' : post.type,
        ...(Array.isArray(post.photoIds) ? { photoIds: post.photoIds.slice(0, 1) } : {}),
      })),
    };
  },
  // v25: voice messages in chats.
  (v24: unknown) => ({ ...(v24 as object), voices: {}, voiceKeys: {} }),
  // v26: the Анкета «Вопросы о тебе». Only the places carry over: the other questions and
  // the card's interests are new, so the member is asked to answer them again.
  (v25: unknown) => {
    const old = v25 as {
      members?: Record<string, unknown>[];
      accessFlow?: Record<string, unknown> | null;
      parkedFlows?: Record<string, Record<string, unknown>>;
      feedFilters?: Record<string, unknown>;
    };
    return {
      ...old,
      // Saved filters keep what their new catalogs still know.
      feedFilters: Object.fromEntries(
        Object.entries(old.feedFilters ?? {}).map(([id, f]) => [id, keepKnownFeedFilters(f)]),
      ),
      members: (old.members ?? []).map(toV26Member),
      accessFlow: old.accessFlow ? toV26Flow(old.accessFlow) : null,
      parkedFlows: Object.fromEntries(
        Object.entries(old.parkedFlows ?? {}).map(([id, flow]) => [id, toV26Flow(flow)]),
      ),
    };
  },
];

/** Answers before v26 keep only their Населённые пункты. */
function toV26Answers(answers: unknown): { city?: string[] } {
  const city = (answers as { city?: unknown })?.city;
  return Array.isArray(city) && city.length ? { city: city.slice(0, 3) as string[] } : {};
}

function toV26Member(member: Record<string, unknown>): Record<string, unknown> {
  const { interests: _interests, ...card } = member.card as Record<string, unknown>;
  return {
    ...member,
    ...(member.gender === 'non_binary' ? { gender: 'woman' } : {}),
    card: { ...card, questionnaire: toV26Answers(card.questionnaire) },
  };
}

function toV26Flow(flow: Record<string, unknown>): Record<string, unknown> {
  const profile = flow.profile as Record<string, unknown> | undefined;
  const { interests: _interests, ...rest } = profile ?? {};
  return {
    ...flow,
    ...(profile ? { profile: rest } : {}),
    ...(flow.answers ? { answers: toV26Answers(flow.answers) } : {}),
  };
}

const legacyCities: Record<string, string | undefined> = {
  almaty: '750000000',
  astana: '710000000',
  karaganda: '351010000',
  shymkent: '790000000',
  other: undefined,
};

const answerKeys = ['intent', 'communication', 'pace', 'firstMeeting', 'boundaries', 'dateFormat'];

function migrateAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers };
  if (typeof out.city === 'string') {
    const code = legacyCities[out.city];
    out.city = code ? [code] : [];
  }
  for (const key of answerKeys) if (typeof out[key] === 'string') out[key] = [out[key]];
  return out;
}

function toSettlementsAndLists(node: unknown, key?: string): unknown {
  if (Array.isArray(node)) {
    // A list of city keys (Фильтры ленты, or answers already turned into lists).
    if (key === 'city') {
      return node
        .map((c) => (typeof c === 'string' && c in legacyCities ? legacyCities[c] : c))
        .filter(Boolean);
    }
    return node.map((item) => toSettlementsAndLists(item));
  }
  if (!node || typeof node !== 'object') return node;
  // Answers first, so their single city becomes a list before the walk below.
  const source = { ...(node as Record<string, unknown>) };
  for (const k of ['questionnaire', 'answers']) {
    const v = source[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      source[k] = migrateAnswers(v as Record<string, unknown>);
    }
  }
  const obj = Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, toSettlementsAndLists(v, k)]),
  ) as Record<string, unknown>;
  if (typeof obj.city === 'string' && obj.city in legacyCities) {
    const code = legacyCities[obj.city];
    if (code) obj.city = code;
    else delete obj.city;
  }
  if (obj.questionnaire && typeof obj.intent === 'string') delete obj.intent;
  return obj;
}

export const defaultMockState = (): MockState => ({
  demoFlags: defaultDemoFlags(),
  accessFlow: null,
  payments: {},
  members: [],
  onboardings: {},
  parkedFlows: {},
  reactions: [],
  renewals: {},
  expiredMemberships: {},
  restrictedSubjects: [],
  restrictionDetails: {},
  appeals: [],
  supportRequests: [],
  deletedMessageIds: [],
  settings: {},
  comments: [],
  deletedCommentIds: [],
  deletedPostIds: [],
  commentReactions: [],
  reposts: [],
  commentKeys: {},
  posts: [],
  postKeys: {},
  reports: [],
  reportKeys: {},
  blocks: [],
  reportUpdates: {},
  follows: [],
  unfollows: [],
  plans: [],
  planKeys: {},
  planUpdates: {},
  planResponses: [],
  chats: [],
  messages: [],
  chatContexts: {},
  chatReads: {},
  activitySeenAt: {},
  feedFilters: {},
  planOpens: {},
  photos: {},
  voices: {},
  voiceKeys: {},
  photoKeys: {},
});

export type ResetNotice = 'corrupt' | 'unsupported_version' | 'invalid';

export interface DemoControls {
  getDemoFlags(): Promise<DemoFlags>;
  setDemoFlags(patch: Partial<DemoFlags>): Promise<DemoFlags>;
  /** Back to GUEST_PREVIEW and pristine seed data; clears everything the demo created. */
  resetDemo(): Promise<void>;
  /** Makes another Passport identity current, in guest mode; nobody's data is touched. */
  switchCandidate(candidateId: string): Promise<void>;
  /** Which Passport identities already have a published card. */
  listCandidateStatus(): Promise<{ candidateId: string; name: string; hasCard: boolean }[]>;
  /** Ends the current member's membership now; the card stays. */
  expireMembership(): Promise<void>;
  /**
   * «Входящее сообщение»: the other side of the member's latest chat writes, as if it came
   * while the app is open. False when the member has no chat to receive it in.
   */
  receiveDemoMessage(): Promise<boolean>;
  /** Undoes «Истечь membership»: the saved end date, or a fresh period if it has passed. */
  restoreMembership(): Promise<void>;
  /**
   * Moderation decides on the current Passport identity (as a moderator elsewhere
   * would): the session becomes BLOCKED until lifted, then returns to its own mode.
   */
  setCurrentRestricted(restricted: boolean): Promise<void>;
  /** Grants or removes the `moderator` role on the current session. */
  setModeratorRole(enabled: boolean): Promise<void>;
  /** Why persisted state was reset on startup, reported once so the UI can explain it. */
  takeResetNotice(): Promise<ResetNotice | undefined>;
}
