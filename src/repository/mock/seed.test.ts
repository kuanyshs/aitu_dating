import { describe, expect, it } from 'vitest';

import { SEED_NOW } from '@/clock';

import { loadSeed } from './seed';

const seed = loadSeed();

describe('seed data', () => {
  it('has the volumes the spec requires', () => {
    expect(seed.members).toHaveLength(12);
    expect(seed.posts).toHaveLength(20);
    expect(seed.plans).toHaveLength(6);
    expect(seed.comments).toHaveLength(55);
    expect(seed.reports).toHaveLength(5);
  });

  it('covers the required edge cases', () => {
    expect(seed.members.some((m) => m.restricted)).toBe(true);
    expect(seed.members.some((m) => m.membership.tier === 'free_verified')).toBe(true);
    expect(seed.members.some((m) => m.membership.tier === 'paid')).toBe(true);
    expect(seed.members.some((m) => m.membership.endsAt < SEED_NOW)).toBe(true);
    expect(seed.posts.some((p) => p.mediaKey)).toBe(true);
    expect(seed.posts.some((p) => p.type === 'quote')).toBe(true);
    expect(seed.posts.some((p) => p.type === 'question')).toBe(true);
    expect(seed.posts.some((p) => p.text.length > 500)).toBe(true);
    expect(seed.posts.some((p) => p.text.length < 10)).toBe(true);
    expect(new Set(seed.plans.map((p) => p.paymentPolicy)).size).toBe(3);
    expect(seed.comments.some((c) => c.parentCommentId)).toBe(true);
  });

  it('keeps every reference valid', () => {
    const memberIds = new Set(seed.members.map((m) => m.id));
    const postIds = new Set(seed.posts.map((p) => p.id));
    const planIds = new Set(seed.plans.map((p) => p.id));
    const commentsById = new Map(seed.comments.map((c) => [c.id, c]));

    for (const post of seed.posts) {
      expect(memberIds.has(post.authorId)).toBe(true);
      if (post.quotedPostId) expect(postIds.has(post.quotedPostId)).toBe(true);
    }
    for (const plan of seed.plans) {
      expect(memberIds.has(plan.authorId)).toBe(true);
      const planPosts = seed.posts.filter((p) => p.planId === plan.id);
      expect(planPosts).toHaveLength(1);
      expect(planPosts[0]?.type).toBe('plan');
      expect(planPosts[0]?.authorId).toBe(plan.authorId);
    }
    for (const post of seed.posts.filter((p) => p.type === 'plan')) {
      expect(planIds.has(post.planId ?? '')).toBe(true);
    }
    for (const comment of seed.comments) {
      expect(memberIds.has(comment.authorId)).toBe(true);
      expect(postIds.has(comment.postId)).toBe(true);
      if (comment.parentCommentId) {
        const parent = commentsById.get(comment.parentCommentId);
        expect(parent?.parentCommentId, 'replies only answer root comments').toBeUndefined();
        expect(parent?.postId).toBe(comment.postId);
      }
    }
    for (const r of [...seed.reactions, ...seed.reposts]) {
      expect(memberIds.has(r.userId)).toBe(true);
      expect(postIds.has(r.postId)).toBe(true);
    }
  });

  it('likes comments that exist, once per member, never their own', () => {
    const commentsById = new Map(seed.comments.map((c) => [c.id, c]));
    const memberIds = new Set(seed.members.map((m) => m.id));
    const keys = seed.commentReactions.map((r) => `${r.userId}:${r.commentId}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of seed.commentReactions) {
      const comment = commentsById.get(r.commentId);
      expect(comment).toBeDefined();
      expect(memberIds.has(r.userId)).toBe(true);
      expect(r.userId).not.toBe(comment?.authorId);
    }
  });

  it('has deleted comments with and without replies', () => {
    const deleted = seed.comments.filter((c) => c.deleted);
    const hasReplies = (id: string) => seed.comments.some((c) => c.parentCommentId === id);
    expect(deleted.some((c) => !c.parentCommentId && hasReplies(c.id))).toBe(true);
    expect(deleted.some((c) => !c.parentCommentId && !hasReplies(c.id))).toBe(true);
    expect(deleted.some((c) => c.parentCommentId)).toBe(true);
  });

  it('dates every comment and comment like at or before the seed clock', () => {
    for (const c of [...seed.comments, ...seed.commentReactions]) {
      expect(c.createdAt <= new Date(SEED_NOW).toISOString()).toBe(true);
    }
  });

  it('schedules every plan after the seed clock', () => {
    for (const plan of seed.plans) expect(plan.date > SEED_NOW.slice(0, 10)).toBe(true);
  });

  it('never mentions a member by name in post or comment text', () => {
    const texts = [...seed.posts.map((p) => p.text), ...seed.comments.map((c) => c.text)];
    for (const member of seed.members) {
      for (const text of texts) expect(text).not.toContain(member.name);
    }
  });

  it('allows at most one reaction and one repost per member and post', () => {
    const keys = seed.reactions.map((r) => `${r.userId}:${r.postId}`);
    expect(new Set(keys).size).toBe(keys.length);
    const repostKeys = seed.reposts.map((r) => `${r.userId}:${r.postId}`);
    expect(new Set(repostKeys).size).toBe(repostKeys.length);
  });
});
