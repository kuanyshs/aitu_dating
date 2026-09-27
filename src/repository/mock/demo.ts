import { z } from 'zod';

import {
  AccessFlowStep,
  UserSettings,
  MembershipSelection,
  PartialAnswers,
  PaymentReceipt,
  ProfileStepInput,
} from '@/contracts';

import {
  CommentReactionRecord,
  CommentRecord,
  MemberRecord,
  PostRecord,
  ReactionRecord,
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
});
export type MockState = z.infer<typeof MockState>;

export const MOCK_STATE_VERSION = 10;

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
];

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
  settings: {},
  comments: [],
  deletedCommentIds: [],
  deletedPostIds: [],
  commentReactions: [],
  reposts: [],
  commentKeys: {},
  posts: [],
  postKeys: {},
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
