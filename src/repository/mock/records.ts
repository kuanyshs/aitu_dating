import { z } from 'zod';

import {
  communicationStyles,
  datingIntents,
  interests,
  meetingDurations,
  meetingFormats,
  meetingGoals,
  membershipTiers,
  paymentPolicies,
  questionnaire,
} from '@/catalogs';
import {
  ChatContext,
  CityKey,
  GenderKey,
  Id,
  IsoDate,
  IsoDateTime,
  PlanResponseStatus,
  StoredPlanStatus,
  PostType,
  TopicKey,
} from '@/contracts';

// Internal storage records of the mock backend. Unlike DTOs they hold everything
// (names, photo keys, questionnaire answers); shaping decides what leaves the repository.

export const QuestionnaireAnswers = z.strictObject({
  city: z.enum(questionnaire.city),
  intent: z.enum(questionnaire.intent),
  communication: z.enum(questionnaire.communication),
  pace: z.enum(questionnaire.pace),
  firstMeeting: z.enum(questionnaire.firstMeeting),
  boundaries: z.enum(questionnaire.boundaries),
  dateFormat: z.enum(questionnaire.dateFormat),
});

export const ProfileCardRecord = z.strictObject({
  bio: z.string().min(1).max(160),
  intent: z.enum(datingIntents),
  interests: z.array(z.enum(interests)).min(1).max(5),
  communicationStyle: z.enum(communicationStyles),
  questionnaire: QuestionnaireAnswers,
  publishedAt: IsoDateTime,
});

export const MembershipRecord = z.strictObject({
  tier: z.enum(membershipTiers),
  periodMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
});

export const MemberRecord = z.strictObject({
  id: Id,
  aituSubjectId: z.string().min(1),
  name: z.string().min(1),
  gender: GenderKey,
  age: z.number().int().min(18),
  city: CityKey,
  photoKey: z.string().min(1),
  verified: z.boolean(),
  card: ProfileCardRecord,
  membership: MembershipRecord,
  /** Moderation decision (Ограничение): the member's content is hidden from everyone. */
  restricted: z.boolean(),
});
export type MemberRecord = z.infer<typeof MemberRecord>;

export const PlanRecord = z.strictObject({
  id: Id,
  authorId: Id,
  city: CityKey,
  date: IsoDate,
  timeStart: z.string().regex(/^\d{2}:\d{2}$/),
  timeEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  durationMinutes: z.union(meetingDurations.map((d) => z.literal(d))),
  format: z.enum(meetingFormats),
  place: z.string().min(1),
  isPublicPlace: z.boolean(),
  goal: z.enum(meetingGoals),
  paymentPolicy: z.enum(paymentPolicies),
  description: z.string().max(500),
  status: StoredPlanStatus,
  createdAt: IsoDateTime,
});
export type PlanRecord = z.infer<typeof PlanRecord>;

/** An Отклик on a План. */
export const PlanResponseRecord = z.strictObject({
  id: Id,
  planId: Id,
  authorId: Id,
  message: z.string().max(360).optional(),
  status: PlanResponseStatus,
  idempotencyKey: z.string().optional(),
  createdAt: IsoDateTime,
});
export type PlanResponseRecord = z.infer<typeof PlanResponseRecord>;

export const PostRecord = z.strictObject({
  id: Id,
  authorId: Id,
  type: PostType,
  text: z.string().min(1).max(1000),
  topics: z.array(TopicKey),
  createdAt: IsoDateTime,
  mediaKey: z.string().optional(),
  planId: Id.optional(),
  quotedPostId: Id.optional(),
});
export type PostRecord = z.infer<typeof PostRecord>;

export const CommentRecord = z.strictObject({
  id: Id,
  postId: Id,
  authorId: Id,
  /** Set only on a reply (Ответ); it always points at a root comment. */
  parentCommentId: Id.optional(),
  text: z.string().min(1).max(360),
  createdAt: IsoDateTime,
  deleted: z.boolean(),
});
export type CommentRecord = z.infer<typeof CommentRecord>;

export const FollowRecord = z.strictObject({
  followerId: Id,
  followingId: Id,
  createdAt: IsoDateTime,
});
export type FollowRecord = z.infer<typeof FollowRecord>;

export const ReactionRecord = z.strictObject({
  userId: Id,
  postId: Id,
  createdAt: IsoDateTime,
});

/** A like on a Комментарий or an Ответ. */
export const CommentReactionRecord = z.strictObject({
  userId: Id,
  commentId: Id,
  createdAt: IsoDateTime,
});
export type CommentReactionRecord = z.infer<typeof CommentReactionRecord>;

export const RepostRecord = z.strictObject({
  userId: Id,
  postId: Id,
  createdAt: IsoDateTime,
});

export const ReportRecord = z.strictObject({
  id: Id,
  /** Absent for a guest: their report is anonymous. */
  reporterId: Id.optional(),
  targetType: z.enum(['user', 'post', 'comment', 'plan', 'message']),
  targetId: Id,
  reason: z.enum(['safety', 'harassment', 'spam', 'privacy', 'other']),
  details: z.string().optional(),
  status: z.enum(['created', 'reviewing', 'resolved']),
  outcome: z.enum(['dismissed', 'content_removed', 'member_restricted']).optional(),
  /** The key of the request that created it (demo reports only). */
  idempotencyKey: z.string().optional(),
  createdAt: IsoDateTime,
});
export type ReportRecord = z.infer<typeof ReportRecord>;

/** Блокировка: `blockerId` hid `blockedId`; the effect is the same both ways. */
export const BlockRecord = z.strictObject({
  id: Id,
  blockerId: Id,
  blockedId: Id,
  createdAt: IsoDateTime,
});
export type BlockRecord = z.infer<typeof BlockRecord>;

/** A Контекстный чат between two members, with the context it started from. */
export const ChatRecord = z.strictObject({
  id: Id,
  memberIds: z.tuple([Id, Id]),
  context: ChatContext,
  createdAt: IsoDateTime,
});
export type ChatRecord = z.infer<typeof ChatRecord>;

export const MessageRecord = z.strictObject({
  id: Id,
  chatId: Id,
  authorId: Id,
  text: z.string().min(1).max(1000),
  createdAt: IsoDateTime,
  /** «Прочитано» is derived from the other side's read mark, never stored. */
  status: z.enum(['sent', 'failed']),
  idempotencyKey: z.string().optional(),
});
export type MessageRecord = z.infer<typeof MessageRecord>;

/** How far a member has read a chat. */
export const ChatReadRecord = z.strictObject({
  chatId: Id,
  userId: Id,
  readAt: IsoDateTime,
});
export type ChatReadRecord = z.infer<typeof ChatReadRecord>;

export const SeedData = z.strictObject({
  members: z.array(MemberRecord),
  posts: z.array(PostRecord),
  plans: z.array(PlanRecord),
  comments: z.array(CommentRecord),
  follows: z.array(FollowRecord),
  reactions: z.array(ReactionRecord),
  commentReactions: z.array(CommentReactionRecord),
  reposts: z.array(RepostRecord),
  reports: z.array(ReportRecord),
  chats: z.array(ChatRecord),
  messages: z.array(MessageRecord),
  chatReads: z.array(ChatReadRecord),
});
export type SeedData = z.infer<typeof SeedData>;
