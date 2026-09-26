import { describe, expect, it } from 'vitest';

import {
  CreateCommentInput,
  CreatePlanInput,
  CreatePostInput,
  LIMITS,
  PlanResponseStatus,
  PlanStatus,
  ProfileStepInput,
} from './index';

const plan = {
  city: 'almaty',
  date: '2026-10-10',
  timeStart: '18:00',
  format: 'coffee',
  durationMinutes: 60,
  goal: 'talk',
  paymentPolicy: 'each_pays',
  description: 'Кофе и разговор.',
  place: 'Кофейня у парка',
  isPublicPlace: true,
  topics: [],
  idempotencyKey: 'plan-key-0001',
} as const;

describe('statuses', () => {
  it('match the spec', () => {
    expect(PlanStatus.options).toEqual(['published', 'matched', 'closed', 'cancelled']);
    expect(PlanResponseStatus.options).toEqual(['pending', 'accepted', 'declined', 'withdrawn']);
  });
});

describe('limits 1000 / 500 / 360 / 160', () => {
  it('are the shared constants', () => {
    expect(LIMITS).toMatchObject({
      postText: 1000,
      planDescription: 500,
      commentText: 360,
      bio: 160,
    });
  });

  it('bound a post', () => {
    const post = { type: 'post', topics: [], idempotencyKey: 'post-key-0001' } as const;
    expect(CreatePostInput.safeParse({ ...post, text: 'а'.repeat(1000) }).success).toBe(true);
    expect(CreatePostInput.safeParse({ ...post, text: 'а'.repeat(1001) }).success).toBe(false);
  });

  it('bound a plan description', () => {
    expect(CreatePlanInput.safeParse({ ...plan, description: 'а'.repeat(500) }).success).toBe(true);
    expect(CreatePlanInput.safeParse({ ...plan, description: 'а'.repeat(501) }).success).toBe(
      false,
    );
  });

  it('bound a comment or reply', () => {
    const comment = { postId: 'p01', idempotencyKey: 'comment-key-1' };
    expect(CreateCommentInput.safeParse({ ...comment, text: 'а'.repeat(360) }).success).toBe(true);
    expect(CreateCommentInput.safeParse({ ...comment, text: 'а'.repeat(361) }).success).toBe(false);
  });

  it('bound the bio', () => {
    const step = { interests: ['coffee'], communicationStyle: 'short_messages' };
    expect(ProfileStepInput.safeParse({ ...step, bio: 'а'.repeat(160) }).success).toBe(true);
    expect(ProfileStepInput.safeParse({ ...step, bio: 'а'.repeat(161) }).success).toBe(false);
  });
});

describe('plans', () => {
  it('are one to one: there is no capacity', () => {
    expect(CreatePlanInput.safeParse({ ...plan, capacity: 4 }).success).toBe(false);
  });

  it('need a confirmed public place with a name', () => {
    expect(CreatePlanInput.safeParse({ ...plan, isPublicPlace: false }).success).toBe(false);
    expect(CreatePlanInput.safeParse({ ...plan, place: ' ' }).success).toBe(false);
  });

  it('end after they start', () => {
    expect(CreatePlanInput.safeParse({ ...plan, timeEnd: '19:30' }).success).toBe(true);
    expect(CreatePlanInput.safeParse({ ...plan, timeEnd: '17:00' }).success).toBe(false);
  });

  it('a quote needs its quoted post', () => {
    const quote = { type: 'quote', text: 'Да', topics: [], idempotencyKey: 'quote-key-01' };
    expect(CreatePostInput.safeParse(quote).success).toBe(false);
    expect(CreatePostInput.safeParse({ ...quote, quotedPostId: 'p01' }).success).toBe(true);
  });
});
