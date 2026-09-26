import type {
  AccessFlowState,
  ConfirmPaymentInput,
  MembershipSelection,
  PassportCandidate,
} from './access';
import type { FeedPage, FeedQuery } from './feed';
import type { RenewMembershipInput } from './membership';
import type { ModerateMemberInput, ModerationResult } from './moderation';
import type {
  CompleteOnboardingInput,
  MyProfile,
  ProfileStepInput,
  SaveAnswerInput,
} from './onboarding';
import type { ReactionState, SetReactionInput } from './reaction';
import type { Session } from './session';

/**
 * Every server capability the app uses. The mock and the future Cloud Code adapter
 * implement the same interface and return the same DTOs and error codes; methods
 * reject with `RepositoryError`. Ticket 09 completes the interface.
 */
export interface AituRepository {
  getSession(): Promise<Session>;
  /** «Выйти в preview»: guest mode; card, membership and posts stay. */
  logout(): Promise<Session>;
  /** «Войти»: back to the identity's own mode (active or expired) without the Анкета. */
  login(): Promise<Session>;
  getHomeFeed(query: FeedQuery): Promise<FeedPage>;

  // Access flow. Each step checks its prerequisites and rejects with CONFLICT when a
  // step is skipped; the server, not the client, decides the resulting state.
  listPassportCandidates(): Promise<PassportCandidate[]>;
  getAccessFlow(): Promise<AccessFlowState | null>;
  startAccess(): Promise<AccessFlowState>;
  selectPassport(input: { candidateId: string }): Promise<AccessFlowState>;
  acceptRules(input: { rulesVersion: string }): Promise<AccessFlowState>;
  selectMembership(input: MembershipSelection): Promise<AccessFlowState>;
  /** Mock checkout; a repeated call with the same key returns the same receipt. */
  confirmPayment(input: ConfirmPaymentInput): Promise<AccessFlowState>;

  // Onboarding. Field errors use `profile.<field>` and `answers.<question>` keys so the
  // client can send the person to the exact step and field.
  saveProfileStep(input: ProfileStepInput): Promise<AccessFlowState>;
  saveAnswer(input: SaveAnswerInput): Promise<AccessFlowState>;
  /** Publishes the Карточка together with the last answer, all or nothing. */
  completeOnboarding(input: CompleteOnboardingInput): Promise<MyProfile>;
  getMyProfile(): Promise<MyProfile>;

  /** Продление for an expired member: new dates, same card, no Анкета. */
  renewMembership(input: RenewMembershipInput): Promise<MyProfile>;

  // Social actions. Guests get UNAUTHENTICATED, expired members MEMBERSHIP_EXPIRED.
  setReaction(input: SetReactionInput): Promise<ReactionState>;

  // Moderation. Only sessions with the `moderator` role; everyone else gets FORBIDDEN.
  moderateMember(input: ModerateMemberInput): Promise<ModerationResult>;
}
