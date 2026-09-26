import type {
  AccessFlowState,
  ConfirmPaymentInput,
  MembershipSelection,
  PassportCandidate,
} from './access';
import type { FeedPage, FeedQuery } from './feed';
import type { Session } from './session';

/**
 * Every server capability the app uses. The mock and the future Cloud Code adapter
 * implement the same interface and return the same DTOs and error codes; methods
 * reject with `RepositoryError`. Ticket 09 completes the interface.
 */
export interface AituRepository {
  getSession(): Promise<Session>;
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
}
