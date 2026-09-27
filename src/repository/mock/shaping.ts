import type { AuthorView, PlanSummary, PostView, Session } from '@/contracts';

import type { MemberRecord, PlanRecord, PostRecord } from './records';

/** Who is asking; decides how much of other people the response may contain. */
export type Viewer = {
  accessState: Session['accessState'];
  userId?: string;
};

export function seesFullView(viewer: Viewer): boolean {
  return viewer.accessState === 'ACTIVE_MEMBER';
}

/** Active or expired: someone with a card of their own, who may manage their own content. */
export function isMemberViewer(viewer: Viewer): boolean {
  return (
    !!viewer.userId &&
    (viewer.accessState === 'ACTIVE_MEMBER' || viewer.accessState === 'ACTIVE_MEMBER_EXPIRED')
  );
}

/**
 * The single place a person record becomes a DTO. Guests and expired members get
 * the safe view with the shared neutral avatar; nothing identifying leaves here.
 */
export function toAuthorView(member: MemberRecord, viewer: Viewer): AuthorView {
  if (!seesFullView(viewer)) {
    return {
      view: 'safe',
      gender: member.gender,
      age: member.age,
      city: member.city,
      avatar: { kind: 'neutral' },
    };
  }
  return {
    view: 'member',
    id: member.id,
    name: member.name,
    verified: member.verified,
    gender: member.gender,
    age: member.age,
    city: member.city,
    avatar: { kind: 'synthetic', key: member.photoKey },
  };
}

/** Guest-safe plan facts for the feed card; the exact place stays in plan detail. */
export function toPlanSummary(plan: PlanRecord): PlanSummary {
  return {
    id: plan.id,
    city: plan.city,
    date: plan.date,
    timeStart: plan.timeStart,
    ...(plan.timeEnd ? { timeEnd: plan.timeEnd } : {}),
    format: plan.format,
    durationMinutes: plan.durationMinutes,
    goal: plan.goal,
    paymentPolicy: plan.paymentPolicy,
    isPublicPlace: plan.isPublicPlace,
    status: plan.status,
  };
}

export type PostCounters = { reactions: number; reposts: number; commentsCount: number };

export type ShapingContext = {
  viewer: Viewer;
  member(id: string): MemberRecord | undefined;
  plan(id: string): PlanRecord | undefined;
  post(id: string): PostRecord | undefined;
  counters(postId: string): PostCounters;
  reactedByMe?(postId: string): boolean;
  repostedByMe?(postId: string): boolean;
  isVisible(post: PostRecord): boolean;
};

export function toPostView(post: PostRecord, ctx: ShapingContext): PostView {
  const author = ctx.member(post.authorId);
  if (!author) throw new Error(`Post ${post.id} has no author`);

  const plan = post.planId ? ctx.plan(post.planId) : undefined;
  const quotedRecord = post.quotedPostId ? ctx.post(post.quotedPostId) : undefined;
  const quotedAuthor = quotedRecord ? ctx.member(quotedRecord.authorId) : undefined;

  return {
    id: post.id,
    type: post.type,
    text: post.text,
    topics: post.topics,
    author: toAuthorView(author, ctx.viewer),
    createdAt: post.createdAt,
    ...ctx.counters(post.id),
    ...(seesFullView(ctx.viewer) && ctx.reactedByMe
      ? { reactedByMe: ctx.reactedByMe(post.id) }
      : {}),
    ...(seesFullView(ctx.viewer) && ctx.repostedByMe
      ? { repostedByMe: ctx.repostedByMe(post.id) }
      : {}),
    ...(isMemberViewer(ctx.viewer) ? { mine: post.authorId === ctx.viewer.userId } : {}),
    ...(post.mediaKey ? { media: { kind: 'synthetic' as const, key: post.mediaKey } } : {}),
    ...(plan ? { plan: toPlanSummary(plan) } : {}),
    ...(quotedRecord && quotedAuthor && ctx.isVisible(quotedRecord)
      ? {
          quoted: {
            id: quotedRecord.id,
            text: quotedRecord.text,
            author: toAuthorView(quotedAuthor, ctx.viewer),
          },
        }
      : post.quotedPostId
        ? // The quote stays; only its original is gone.
          { quotedUnavailable: true as const }
        : {}),
  };
}
