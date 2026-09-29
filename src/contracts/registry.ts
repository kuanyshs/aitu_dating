import { z } from 'zod';

import {
  AccessFlowState,
  ConfirmPaymentInput,
  MembershipSelection,
  PassportCandidate,
} from './access';
import { ActivityPage, ActivityQuery } from './activity';
import {
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
import {
  CommentPage,
  CommentQuery,
  CommentReactionState,
  CommentRef,
  CommentView,
  CreateCommentInput,
  SetCommentReactionInput,
} from './comment';
import { Id } from './common';
import { FeedPage, FeedQuery } from './feed';
import { RenewMembershipInput } from './membership';
import {
  ModerateMemberInput,
  ModerationResult,
  ModerationReportPage,
  ModerationReportView,
  ReportRef,
  ReportsQuery,
  ResolveReportInput,
} from './moderation';
import {
  CompleteOnboardingInput,
  MyProfile,
  ProfileStepInput,
  SaveAnswerInput,
} from './onboarding';
import {
  CreatePlanInput,
  PlanRef,
  PlanResponsePage,
  PlanResponseRef,
  PlanResponsesQuery,
  PlanResponseView,
  PlanView,
  RespondToPlanInput,
} from './plan';
import { CreatePostInput, PostRef, PostView, RepostState, SetRepostInput } from './post';
import {
  FollowListQuery,
  FollowState,
  MemberPage,
  MemberRef,
  ProfilePostsQuery,
  ProfileView,
  SetFollowInput,
} from './profile';
import { ReactionState, SetReactionInput } from './reaction';
import type { AituRepository } from './repository';
import {
  BlockedPage,
  BlockState,
  CreateReportInput,
  ReportPage,
  ReportReceipt,
  SetBlockInput,
} from './safety';
import { SearchPage, SearchQuery } from './search';
import { Session } from './session';
import { UpdateSettingsInput, UserSettings } from './settings';

type MethodSchema = { input: z.ZodType; output: z.ZodType };

const none = z.undefined();

/**
 * The frozen contract as data: every repository method with its input and output
 * schema. The backend implements exactly this; OpenAPI is generated from it later.
 * `satisfies` keeps it in step with `AituRepository` — a method cannot be missing.
 */
export const repositoryContract = {
  getSession: { input: none, output: Session },
  logout: { input: none, output: Session },
  login: { input: none, output: Session },

  listPassportCandidates: { input: none, output: z.array(PassportCandidate) },
  getAccessFlow: { input: none, output: AccessFlowState.nullable() },
  startAccess: { input: none, output: AccessFlowState },
  selectPassport: { input: z.strictObject({ candidateId: Id }), output: AccessFlowState },
  acceptRules: { input: z.strictObject({ rulesVersion: z.string() }), output: AccessFlowState },
  selectMembership: { input: MembershipSelection, output: AccessFlowState },
  confirmPayment: { input: ConfirmPaymentInput, output: AccessFlowState },

  saveProfileStep: { input: ProfileStepInput, output: AccessFlowState },
  saveAnswer: { input: SaveAnswerInput, output: AccessFlowState },
  completeOnboarding: { input: CompleteOnboardingInput, output: MyProfile },
  getMyProfile: { input: none, output: MyProfile },
  updateMyCard: { input: ProfileStepInput, output: MyProfile },
  renewMembership: { input: RenewMembershipInput, output: MyProfile },

  getHomeFeed: { input: FeedQuery, output: FeedPage },
  getPost: { input: PostRef, output: PostView },
  createPost: { input: CreatePostInput, output: PostView },
  deletePost: { input: PostRef, output: z.undefined() },
  listComments: { input: CommentQuery, output: CommentPage },
  createComment: { input: CreateCommentInput, output: CommentView },
  deleteComment: { input: CommentRef, output: CommentView },
  setReaction: { input: SetReactionInput, output: ReactionState },
  setCommentReaction: { input: SetCommentReactionInput, output: CommentReactionState },
  setRepost: { input: SetRepostInput, output: RepostState },

  getProfile: { input: MemberRef, output: ProfileView },
  listProfilePosts: { input: ProfilePostsQuery, output: FeedPage },
  setFollow: { input: SetFollowInput, output: FollowState },
  listFollowers: { input: FollowListQuery, output: MemberPage },
  listFollowing: { input: FollowListQuery, output: MemberPage },
  search: { input: SearchQuery, output: SearchPage },

  getPlan: { input: PlanRef, output: PlanView },
  createPlan: { input: CreatePlanInput, output: PlanView },
  cancelPlan: { input: PlanRef, output: PlanView },
  closePlan: { input: PlanRef, output: PlanView },
  listPlanResponses: { input: PlanResponsesQuery, output: PlanResponsePage },
  respondToPlan: { input: RespondToPlanInput, output: PlanResponseView },
  acceptPlanResponse: { input: PlanResponseRef, output: PlanResponseView },
  declinePlanResponse: { input: PlanResponseRef, output: PlanResponseView },
  withdrawPlanResponse: { input: PlanResponseRef, output: PlanResponseView },

  listChats: { input: ListQuery, output: ChatPage },
  getChat: { input: ChatRef, output: ChatSummary },
  listMessages: { input: MessagesQuery, output: MessagePage },
  sendMessage: { input: SendMessageInput, output: MessageView },
  retryMessage: { input: MessageRef, output: MessageView },
  markChatRead: { input: ChatRef, output: ChatSummary },
  listActivity: { input: ActivityQuery, output: ActivityPage },

  createReport: { input: CreateReportInput, output: ReportReceipt },
  listMyReports: { input: ListQuery, output: ReportPage },
  setBlock: { input: SetBlockInput, output: BlockState },
  listBlocked: { input: ListQuery, output: BlockedPage },

  listReports: { input: ReportsQuery, output: ModerationReportPage },
  openReport: { input: ReportRef, output: ModerationReportView },
  resolveReport: { input: ResolveReportInput, output: ModerationReportView },
  moderateMember: { input: ModerateMemberInput, output: ModerationResult },

  getSettings: { input: none, output: UserSettings },
  updateSettings: { input: UpdateSettingsInput, output: UserSettings },
} satisfies Record<keyof AituRepository, MethodSchema>;

export type RepositoryMethod = keyof typeof repositoryContract;
export const repositoryMethods = Object.keys(repositoryContract) as RepositoryMethod[];
