import { z } from 'zod';

import { meetingDurations, meetingFormats, meetingGoals, paymentPolicies } from '@/catalogs';

import { Id, IsoDate, IsoDateTime, Page } from './common';
import { LIMITS } from './limits';
import { AuthorView, CityKey } from './people';
import { PlanSummary, TopicKey } from './post';

/**
 * A План in full. One to one, no capacity. `place` is the exact spot and reaches active
 * members only; guests and expired members see the city and the public-place flag.
 */
export const PlanView = PlanSummary.extend({
  postId: Id,
  author: AuthorView,
  description: z.string().max(LIMITS.planDescription),
  place: z.string().min(1).optional(),
  createdAt: IsoDateTime,
  /** Owner only: how many Отклики are waiting. */
  pendingResponses: z.number().int().min(0).optional(),
  /** The viewer's own Отклик, if any. */
  myResponseId: Id.optional(),
});
export type PlanView = z.infer<typeof PlanView>;

/** Plans are made for today and the next 13 days. */
export const PLAN_HORIZON_DAYS = 14;
/** How many open future plans an author may hold at a time. */
export const OPEN_PLANS_MAX = 3;

const Time = z.string().regex(/^\d{2}:\d{2}$/);

export const CreatePlanInput = z
  .strictObject({
    city: CityKey,
    date: IsoDate,
    timeStart: Time,
    timeEnd: Time.optional(),
    format: z.enum(meetingFormats),
    durationMinutes: z.union(meetingDurations.map((d) => z.literal(d))),
    goal: z.enum(meetingGoals),
    paymentPolicy: z.enum(paymentPolicies),
    description: z.string().trim().min(1, 'required').max(LIMITS.planDescription, 'too_long'),
    place: z.string().trim().min(1, 'required'),
    /** The creator must confirm the place is public. */
    isPublicPlace: z.literal(true),
    topics: z.array(TopicKey).max(4),
    idempotencyKey: z.string().min(8),
  })
  .refine((p) => !p.timeEnd || p.timeEnd > p.timeStart, {
    message: 'The end time must be after the start time',
    path: ['timeEnd'],
  });
export type CreatePlanInput = z.infer<typeof CreatePlanInput>;

export const PlanRef = z.strictObject({ planId: Id });
export type PlanRef = z.infer<typeof PlanRef>;

/** Отклик: pending → accepted | declined | withdrawn. At most one accepted per plan. */
export const PlanResponseStatus = z.enum(['pending', 'accepted', 'declined', 'withdrawn']);
export type PlanResponseStatus = z.infer<typeof PlanResponseStatus>;

export const PlanResponseView = z.strictObject({
  id: Id,
  planId: Id,
  author: AuthorView,
  message: z.string().max(LIMITS.commentText).optional(),
  status: PlanResponseStatus,
  createdAt: IsoDateTime,
});
export type PlanResponseView = z.infer<typeof PlanResponseView>;

export const PlanResponsePage = Page(PlanResponseView);
export type PlanResponsePage = z.infer<typeof PlanResponsePage>;

export const PlanResponsesQuery = z.strictObject({
  planId: Id,
  cursor: z.string().optional(),
});
export type PlanResponsesQuery = z.infer<typeof PlanResponsesQuery>;

export const RespondToPlanInput = z.strictObject({
  planId: Id,
  message: z.string().trim().max(LIMITS.commentText, 'too_long').optional(),
  idempotencyKey: z.string().min(8),
});
export type RespondToPlanInput = z.infer<typeof RespondToPlanInput>;

export const PlanResponseRef = z.strictObject({ responseId: Id });
export type PlanResponseRef = z.infer<typeof PlanResponseRef>;
