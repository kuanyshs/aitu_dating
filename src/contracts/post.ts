import { z } from 'zod';

import {
  meetingDurations,
  meetingFormats,
  meetingGoals,
  paymentPolicies,
  topics,
} from '@/catalogs';

import { Id, IsoDate, IsoDateTime } from './common';
import { LIMITS } from './limits';
import { AuthorView, CityKey } from './people';

export const PostType = z.enum(['post', 'question', 'quote', 'plan']);
export type PostType = z.infer<typeof PostType>;

export const TopicKey = z.enum(topics);

export const PlanStatus = z.enum(['published', 'matched', 'closed', 'cancelled']);
export type PlanStatus = z.infer<typeof PlanStatus>;

/** Guest-safe summary of a one-to-one plan shown inside its feed post. */
export const PlanSummary = z.strictObject({
  id: Id,
  city: CityKey,
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
  isPublicPlace: z.boolean(),
  status: PlanStatus,
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

export const PostView = z.strictObject({
  id: Id,
  type: PostType,
  text: z.string().max(LIMITS.postText),
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
  plan: PlanSummary.optional(),
  quoted: QuotedPost.optional(),
});
export type PostView = z.infer<typeof PostView>;

/** A new Пост. Plans are created with `createPlan`, which also publishes their post. */
export const CreatePostInput = z
  .strictObject({
    type: z.enum(['post', 'question', 'quote']),
    text: z.string().trim().min(1, 'required').max(LIMITS.postText, 'too_long'),
    topics: z.array(TopicKey).max(4, 'too_many'),
    quotedPostId: Id.optional(),
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
