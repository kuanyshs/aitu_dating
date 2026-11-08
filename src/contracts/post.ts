import { z } from 'zod';

import {
  interests,
  meetingDurations,
  meetingFormats,
  meetingGoals,
  paymentPolicies,
  planBudgets,
  topics,
} from '@/catalogs';

import { Id, IsoDate, IsoDateTime } from './common';
import { LIMITS } from './limits';
import { AuthorView, SettlementCode } from './people';
import { PHOTO_LIMITS, PhotoRef } from './photo';

/** A Вопрос is no longer a type of its own: older ones read as ordinary posts. */
export const PostType = z.enum(['post', 'quote', 'plan']);
export type PostType = z.infer<typeof PostType>;

export const TopicKey = z.enum(topics);

/**
 * published (open for Отклики), matched (Встреча), closed («Набор закрыт»), cancelled
 * (Отменён) are stored; past (Прошёл) is computed: an open or closed plan whose start
 * time has come.
 */
/** `deleted`: the author removed the Встреча; it lives on only in their lists and old chats. */
export const PlanStatus = z.enum([
  'published',
  'matched',
  'closed',
  'cancelled',
  'past',
  'deleted',
]);
export type PlanStatus = z.infer<typeof PlanStatus>;

/** The statuses a plan is stored with; «Прошёл» is never stored. */
export const StoredPlanStatus = PlanStatus.exclude(['past']);
export type StoredPlanStatus = z.infer<typeof StoredPlanStatus>;

/** Guest-safe summary of a one-to-one plan shown inside its feed post. */
export const PlanSummary = z.strictObject({
  id: Id,
  city: SettlementCode,
  date: IsoDate,
  timeStart: z.string().regex(/^\d{2}:\d{2}$/),
  timeEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  format: z.enum(meetingFormats),
  durationMinutes: z.union(meetingDurations.map((d) => z.literal(d))),
  goal: z.enum(meetingGoals),
  paymentPolicy: z.enum(paymentPolicies),
  budget: z.enum(planBudgets),
  /** Where roughly: a general description of the place, for everyone who sees the plan. */
  placeArea: z.string().min(1),
  isPublicPlace: z.boolean(),
  status: PlanStatus,
  /** Owner only: how many Отклики are waiting. */
  pendingResponses: z.number().int().min(0).optional(),
});
export type PlanSummary = z.infer<typeof PlanSummary>;

export const MediaRef = z.strictObject({ kind: z.literal('synthetic'), key: z.string().min(1) });
export type MediaRef = z.infer<typeof MediaRef>;

export const QuotedPost = z.strictObject({
  id: Id,
  text: z.string(),
  author: AuthorView,
});
export type QuotedPost = z.infer<typeof QuotedPost>;

/**
 * Why «Поиск» picked a post for an active member: a shared interest, the same Намерение or
 * the same place. At most two are given.
 */
export const FeedReason = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('interest'), interest: z.enum(interests) }),
  z.strictObject({
    kind: z.literal('answer'),
    /** «Тоже ищет» or «Живёт там же». */
    question: z.enum(['intent', 'city']),
    option: z.string(),
  }),
]);
export type FeedReason = z.infer<typeof FeedReason>;

export const PostView = z.strictObject({
  id: Id,
  type: PostType,
  text: z.string().max(LIMITS.storedPostText),
  topics: z.array(TopicKey),
  author: AuthorView,
  createdAt: IsoDateTime,
  reactions: z.number().int().min(0),
  reposts: z.number().int().min(0),
  commentsCount: z.number().int().min(0),
  /** Present for active members only: whether the viewer has liked the post. */
  reactedByMe: z.boolean().optional(),
  /** Present for active members only: whether the viewer has reposted the post. */
  repostedByMe: z.boolean().optional(),
  /** Present for members, expired ones too: the viewer wrote this post and may delete it. */
  mine: z.boolean().optional(),
  media: MediaRef.optional(),
  /** Up to two Фото of a post; active members (and the author) only. */
  photos: z.array(PhotoRef).max(PHOTO_LIMITS.post).optional(),
  plan: PlanSummary.optional(),
  quoted: QuotedPost.optional(),
  /** A Цитата whose quoted Пост was deleted or hidden: shown as «Публикация недоступна». */
  quotedUnavailable: z.literal(true).optional(),
  /** «Для тебя» for an active member only: up to two reasons the post was picked. */
  reasons: z.array(FeedReason).max(2).optional(),
});
export type PostView = z.infer<typeof PostView>;

/** A new Пост. Plans are created with `createPlan`, which also publishes their post. */
export const CreatePostInput = z
  .strictObject({
    type: z.enum(['post', 'quote']),
    text: z.string().trim().min(1, 'required').max(LIMITS.postText, 'too_long'),
    topics: z.array(TopicKey).max(LIMITS.topics, 'too_many'),
    quotedPostId: Id.optional(),
    /** One of the author's uploaded Фото. */
    photoIds: z
      .array(Id)
      .max(PHOTO_LIMITS.post, 'too_many')
      .refine((ids) => new Set(ids).size === ids.length, 'duplicate')
      .optional(),
    idempotencyKey: z.string().min(8),
  })
  .refine((p) => (p.type === 'quote') === !!p.quotedPostId, {
    message: 'A quote needs exactly one quoted post',
    path: ['quotedPostId'],
  });
export type CreatePostInput = z.infer<typeof CreatePostInput>;

export const PostRef = z.strictObject({ postId: Id });
export type PostRef = z.infer<typeof PostRef>;

export const SetRepostInput = z.strictObject({ postId: Id, active: z.boolean() });
export type SetRepostInput = z.infer<typeof SetRepostInput>;

export const RepostState = z.strictObject({
  postId: Id,
  reposts: z.number().int().min(0),
  repostedByMe: z.boolean(),
});
export type RepostState = z.infer<typeof RepostState>;
