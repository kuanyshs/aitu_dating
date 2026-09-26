import { z } from 'zod';

import {
  meetingDurations,
  meetingFormats,
  meetingGoals,
  paymentPolicies,
  topics,
} from '@/catalogs';

import { Id, IsoDate, IsoDateTime } from './common';
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
  text: z.string().max(1000),
  topics: z.array(TopicKey),
  author: AuthorView,
  createdAt: IsoDateTime,
  reactions: z.number().int().min(0),
  reposts: z.number().int().min(0),
  commentsCount: z.number().int().min(0),
  /** Present for active members only: whether the viewer has liked the post. */
  reactedByMe: z.boolean().optional(),
  media: MediaRef.optional(),
  plan: PlanSummary.optional(),
  quoted: QuotedPost.optional(),
});
export type PostView = z.infer<typeof PostView>;
