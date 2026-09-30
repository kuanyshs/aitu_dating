import type {
  AccessFlowState,
  ConfirmPaymentInput,
  MembershipSelection,
  PassportCandidate,
} from './access';
import type { ActivityPage, ActivityQuery, ActivitySeen } from './activity';
import type {
  ChatPage,
  ChatRef,
  ChatSummary,
  ListQuery,
  MessagePage,
  MessageRef,
  MessagesQuery,
  OpenChatInput,
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
  ModerationReportPage,
  ModerationReportView,
  ReportRef,
  ReportsQuery,
  ResolveReportInput,
} from './moderation';
import type {
  CompleteOnboardingInput,
  MyProfile,
  ProfileStepInput,
  SaveAnswerInput,
  UpdateCardInput,
} from './onboarding';
import type {
  CreatePlanInput,
  MyResponsePage,
  PlanPage,
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
  FollowListQuery,
  MemberPage,
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
  updateMyCard(input: UpdateCardInput): Promise<MyProfile>;

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
  /** «Подписчики» and «Подписки» of a member: active members only, newest first. */
  listFollowers(query: FollowListQuery): Promise<MemberPage>;
  listFollowing(query: FollowListQuery): Promise<MemberPage>;
  search(query: SearchQuery): Promise<SearchPage>;

  // Plans and Отклики. Plan: published → closed | matched, cancelled at any time;
  // an open or closed plan reads as past once its start time has come.
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
  /** The member's own plans, cancelled and past ones too. */
  listMyPlans(query: ListQuery): Promise<PlanPage>;
  /** The member's standing Отклики with their plans, newest first. */
  listMyResponses(query: ListQuery): Promise<MyResponsePage>;

  // Контекстные чаты and Активность.
  /** Opens the one chat with that person, or the existing one; it keeps its first context. */
  openChat(input: OpenChatInput): Promise<ChatSummary>;
  listChats(query: ListQuery): Promise<ChatPage>;
  getChat(input: ChatRef): Promise<ChatSummary>;
  listMessages(query: MessagesQuery): Promise<MessagePage>;
  sendMessage(input: SendMessageInput): Promise<MessageView>;
  /** Resends a `failed` message with its original idempotency key. */
  retryMessage(input: MessageRef): Promise<MessageView>;
  markChatRead(input: ChatRef): Promise<ChatSummary>;
  listActivity(query: ActivityQuery): Promise<ActivityPage>;
  /** Marks everything in «Активность» so far as seen. */
  markActivitySeen(): Promise<ActivitySeen>;

  // Safety.
  createReport(input: CreateReportInput): Promise<ReportReceipt>;
  /** «Мои жалобы»: the member's own reports, newest first, with status and outcome. */
  listMyReports(query: ListQuery): Promise<ReportPage>;
  setBlock(input: SetBlockInput): Promise<BlockState>;
  listBlocked(query: ListQuery): Promise<BlockedPage>;

  // Moderation. Only sessions with the `moderator` role; everyone else gets FORBIDDEN.
  /** Newest first; reports about the moderator's own content are not theirs to decide. */
  listReports(query: ReportsQuery): Promise<ModerationReportPage>;
  /** Opening a new report takes it into review («На рассмотрении»). */
  openReport(input: ReportRef): Promise<ModerationReportView>;
  /**
   * Decides a report and, with the same outcome, every other open report on its target.
   * An already resolved report, removing a person's «content», or restricting someone
   * already restricted is a CONFLICT.
   */
  resolveReport(input: ResolveReportInput): Promise<ModerationReportView>;
  moderateMember(input: ModerateMemberInput): Promise<ModerationResult>;

  // Settings.
  getSettings(): Promise<UserSettings>;
  updateSettings(input: UpdateSettingsInput): Promise<UserSettings>;
}
