import type {
  AccessFlowState,
  ConfirmPaymentInput,
  MembershipSelection,
  PassportCandidate,
} from './access';
import type { ActivityPage, ActivityQuery } from './activity';
import type {
  ChatPage,
  ChatRef,
  ChatSummary,
  ListQuery,
  MessagePage,
  MessageRef,
  MessagesQuery,
  MessageView,
  SendMessageInput,
} from './chat';
import type {
  CommentPage,
  CommentQuery,
  CommentRef,
  CommentReactionState,
  CommentView,
  CreateCommentInput,
  SetCommentReactionInput,
} from './comment';
import type { FeedPage, FeedQuery } from './feed';
import type { RenewMembershipInput } from './membership';
import type {
  ModerateMemberInput,
  ModerationResult,
  ReportsQuery,
  ResolveReportInput,
} from './moderation';
import type {
  CompleteOnboardingInput,
  MyProfile,
  ProfileStepInput,
  SaveAnswerInput,
} from './onboarding';
import type {
  CreatePlanInput,
  PlanRef,
  PlanResponsePage,
  PlanResponseRef,
  PlanResponsesQuery,
  PlanResponseView,
  PlanView,
  RespondToPlanInput,
} from './plan';
import type { CreatePostInput, PostRef, PostView, RepostState, SetRepostInput } from './post';
import type {
  FollowState,
  MemberRef,
  ProfilePostsQuery,
  ProfileView,
  SetFollowInput,
} from './profile';
import type { ReactionState, SetReactionInput } from './reaction';
import type {
  BlockedPage,
  BlockState,
  CreateReportInput,
  ReportPage,
  ReportReceipt,
  ReportView,
  SetBlockInput,
} from './safety';
import type { SearchPage, SearchQuery } from './search';
import type { Session } from './session';
import type { UpdateSettingsInput, UserSettings } from './settings';

/**
 * Every server capability of the product, frozen before backend integration. The mock
 * and the future Cloud Code adapter implement the same interface and return the same
 * DTOs and error codes; methods reject with `RepositoryError`. `registry.ts` pairs each
 * method with its input and output schema.
 *
 * Common rules: guests get UNAUTHENTICATED for anything social, expired members
 * MEMBERSHIP_EXPIRED, restricted sessions FORBIDDEN. Creates, payments and messages take
 * an idempotency key; a retry with the same key never makes a duplicate.
 */
export interface AituRepository {
  // Session.
  getSession(): Promise<Session>;
  /** «Выйти в preview»: guest mode; card, membership and posts stay. */
  logout(): Promise<Session>;
  /** «Войти»: back to the identity's own mode (active or expired) without the Анкета. */
  login(): Promise<Session>;

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
  /** Edits the own card; allowed for active and expired members. */
  updateMyCard(input: ProfileStepInput): Promise<MyProfile>;

  /** Продление for an expired member: new dates, same card, no Анкета. */
  renewMembership(input: RenewMembershipInput): Promise<MyProfile>;

  // Feed, posts and comments.
  getHomeFeed(query: FeedQuery): Promise<FeedPage>;
  getPost(input: PostRef): Promise<PostView>;
  createPost(input: CreatePostInput): Promise<PostView>;
  /** Soft delete of the viewer's own post. */
  deletePost(input: PostRef): Promise<void>;
  listComments(query: CommentQuery): Promise<CommentPage>;
  createComment(input: CreateCommentInput): Promise<CommentView>;
  /** Soft delete: «Комментарий удалён», replies stay. */
  deleteComment(input: CommentRef): Promise<CommentView>;
  setReaction(input: SetReactionInput): Promise<ReactionState>;
  setCommentReaction(input: SetCommentReactionInput): Promise<CommentReactionState>;
  setRepost(input: SetRepostInput): Promise<RepostState>;

  // People.
  getProfile(input: MemberRef): Promise<ProfileView>;
  listProfilePosts(query: ProfilePostsQuery): Promise<FeedPage>;
  setFollow(input: SetFollowInput): Promise<FollowState>;
  search(query: SearchQuery): Promise<SearchPage>;

  // Plans and Отклики. Plan: published → matched → closed, cancelled at any time.
  getPlan(input: PlanRef): Promise<PlanView>;
  /** Creates the plan and its Post(type=plan) together. */
  createPlan(input: CreatePlanInput): Promise<PlanView>;
  cancelPlan(input: PlanRef): Promise<PlanView>;
  closePlan(input: PlanRef): Promise<PlanView>;
  listPlanResponses(query: PlanResponsesQuery): Promise<PlanResponsePage>;
  respondToPlan(input: RespondToPlanInput): Promise<PlanResponseView>;
  /** Accepting one Отклик matches the plan and declines the others. */
  acceptPlanResponse(input: PlanResponseRef): Promise<PlanResponseView>;
  declinePlanResponse(input: PlanResponseRef): Promise<PlanResponseView>;
  withdrawPlanResponse(input: PlanResponseRef): Promise<PlanResponseView>;

  // Контекстные чаты and Активность.
  listChats(query: ListQuery): Promise<ChatPage>;
  getChat(input: ChatRef): Promise<ChatSummary>;
  listMessages(query: MessagesQuery): Promise<MessagePage>;
  sendMessage(input: SendMessageInput): Promise<MessageView>;
  /** Resends a `failed` message with its original idempotency key. */
  retryMessage(input: MessageRef): Promise<MessageView>;
  markChatRead(input: ChatRef): Promise<ChatSummary>;
  listActivity(query: ActivityQuery): Promise<ActivityPage>;

  // Safety.
  createReport(input: CreateReportInput): Promise<ReportReceipt>;
  /** «Мои жалобы»: the member's own reports, newest first, with status and outcome. */
  listMyReports(query: ListQuery): Promise<ReportPage>;
  setBlock(input: SetBlockInput): Promise<BlockState>;
  listBlocked(query: ListQuery): Promise<BlockedPage>;

  // Moderation. Only sessions with the `moderator` role; everyone else gets FORBIDDEN.
  listReports(query: ReportsQuery): Promise<ReportPage>;
  resolveReport(input: ResolveReportInput): Promise<ReportView>;
  moderateMember(input: ModerateMemberInput): Promise<ModerationResult>;

  // Settings.
  getSettings(): Promise<UserSettings>;
  updateSettings(input: UpdateSettingsInput): Promise<UserSettings>;
}
