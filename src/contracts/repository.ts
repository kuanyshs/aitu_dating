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
  MarkChatReadInput,
  UnreadCount,
  ListQuery,
  MessagePage,
  MessageRef,
  MessagesQuery,
  OpenChatInput,
  MessageView,
  SendMessageInput,
  ShareMeetingInput,
  ShareRecipientsQuery,
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
import type { FeedFilters, FeedPage, FeedQuery } from './feed';
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
  UpdatePhotosInput,
} from './onboarding';
import type { MyActionsPage, MyActionsQuery } from './myActions';
import type { PhotoRef, UploadPhotoInput } from './photo';
import type { UploadVoiceInput, VoiceRef } from './voice';
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
import type {
  AppealsQuery,
  AppealView,
  CreateAppealInput,
  CreateSupportRequestInput,
  DecideAppealInput,
  ModerationAppealPage,
  ModerationAppealView,
  MyRestriction,
  SupportRequestPage,
  SupportRequestView,
} from './restriction';
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
  /** Sets the own profile Фото: order, removal, the first one main. */
  updateMyPhotos(input: UpdatePhotosInput): Promise<MyProfile>;

  /** Продление for an expired member: new dates, same card, no Анкета. */
  renewMembership(input: RenewMembershipInput): Promise<MyProfile>;

  // Feed, posts and comments.
  getHomeFeed(query: FeedQuery): Promise<FeedPage>;
  /** A member's Фильтры ленты; their own Анкета answers until they change them. */
  getFeedFilters(): Promise<FeedFilters>;
  updateFeedFilters(filters: FeedFilters): Promise<FeedFilters>;
  /** «Мои действия»: what the member did, newest first; their own card only. */
  listMyActions(input: MyActionsQuery): Promise<MyActionsPage>;
  /** Stores a Фото for the current active member; a retried key returns the same one. */
  uploadPhoto(input: UploadPhotoInput): Promise<PhotoRef>;
  /** Stores a recorded voice message for a chat; a retry with the same key returns it. */
  uploadVoice(input: UploadVoiceInput): Promise<VoiceRef>;
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
  /** The chosen participant steps out of a Встреча; a future План opens again. */
  leaveMeeting(input: PlanRef): Promise<PlanView>;
  /** The member's own plans, cancelled and past ones too. */
  listMyPlans(query: ListQuery): Promise<PlanPage>;
  /** The member's standing Отклики with their plans, newest first. */
  listMyResponses(query: ListQuery): Promise<MyResponsePage>;

  // Контекстные чаты and Активность.
  /** Opens the one chat with that person, or the existing one; it keeps its first context. */
  openChat(input: OpenChatInput): Promise<ChatSummary>;
  /** People a Встреча can be sent to: shown, writable, never oneself. */
  listShareRecipients(query: ShareRecipientsQuery): Promise<MemberPage>;
  /** Sends a Встреча as a card into the pair's one chat; a retry with the same key is it. */
  shareMeeting(input: ShareMeetingInput): Promise<MessageView>;
  listChats(query: ListQuery): Promise<ChatPage>;
  getChat(input: ChatRef): Promise<ChatSummary>;
  listMessages(query: MessagesQuery): Promise<MessagePage>;
  sendMessage(input: SendMessageInput): Promise<MessageView>;
  /** Resends a `failed` message with its original idempotency key. */
  retryMessage(input: MessageRef): Promise<MessageView>;
  /** Reads a chat up to the message shown on screen; opening «Сообщения» reads nothing. */
  markChatRead(input: MarkChatReadInput): Promise<ChatSummary>;
  /** Unread messages across all chats, for the «Сообщения» tab and its header. */
  countUnreadMessages(): Promise<UnreadCount>;
  listActivity(query: ActivityQuery): Promise<ActivityPage>;
  /** Marks everything in «Активность» so far as seen. */
  markActivitySeen(): Promise<ActivitySeen>;

  // Safety.
  createReport(input: CreateReportInput): Promise<ReportReceipt>;
  /** «Мои жалобы»: the member's own reports, newest first, with status and outcome. */
  listMyReports(query: ListQuery): Promise<ReportPage>;
  setBlock(input: SetBlockInput): Promise<BlockState>;
  listBlocked(query: ListQuery): Promise<BlockedPage>;

  // Ограничение, Апелляция and Поддержка.
  /** The current person's Ограничение while it lasts, otherwise null. */
  getMyRestriction(): Promise<MyRestriction | null>;
  /** The one Апелляция on the current Ограничение; a retry returns the same one. */
  createAppeal(input: CreateAppealInput): Promise<AppealView>;
  /** Anyone with an Aitu Passport identity, the restricted included. */
  createSupportRequest(input: CreateSupportRequestInput): Promise<SupportRequestView>;
  /** «Мои обращения», newest first. */
  listMySupportRequests(query: ListQuery): Promise<SupportRequestPage>;

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
  /** Waiting Апелляции first by age; decided ones newest first. */
  listAppeals(query: AppealsQuery): Promise<ModerationAppealPage>;
  /** «Снять ограничение» or «Оставить в силе»; a decided one is a CONFLICT. */
  decideAppeal(input: DecideAppealInput): Promise<ModerationAppealView>;

  // Settings.
  getSettings(): Promise<UserSettings>;
  updateSettings(input: UpdateSettingsInput): Promise<UserSettings>;
}
