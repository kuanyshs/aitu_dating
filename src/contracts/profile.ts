import { z } from 'zod';

import { communicationStyles } from '@/catalogs';

import { Id, Page } from './common';
import { LIMITS } from './limits';
import { FeedContent } from './feed';
import { PartialAnswers } from './onboarding';
import { AuthorView } from './people';
import { PhotoRef } from './photo';

/**
 * What an active member may see of another member's Карточка and Анкета. Never sent to
 * guests. The income answers are left out: they serve search only.
 */
export const PublicCard = z.strictObject({
  bio: z.string().max(LIMITS.bio),
  communicationStyle: z.enum(communicationStyles),
  answers: PartialAnswers,
});
export type PublicCard = z.infer<typeof PublicCard>;

export const ProfileRelation = z.strictObject({
  following: z.boolean(),
  followsMe: z.boolean(),
  blocked: z.boolean(),
});
export type ProfileRelation = z.infer<typeof ProfileRelation>;

/** Another person's profile. Guests and expired members get the safe view only. */
export const ProfileView = z.strictObject({
  person: AuthorView,
  card: PublicCard.optional(),
  /** Profile Фото, the main one first; full view only. */
  photos: z.array(PhotoRef).optional(),
  stats: z.strictObject({
    posts: z.number().int().min(0),
    followers: z.number().int().min(0),
    /** How many people they follow: their own profile only. */
    following: z.number().int().min(0).optional(),
  }),
  relation: ProfileRelation.optional(),
});
export type ProfileView = z.infer<typeof ProfileView>;

export const MemberRef = z.strictObject({ memberId: Id });
export type MemberRef = z.infer<typeof MemberRef>;

export const ProfilePostsQuery = z.strictObject({
  memberId: Id,
  /** «Все», «Посты» or «Встречи»; `all` when omitted. */
  content: FeedContent.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type ProfilePostsQuery = z.infer<typeof ProfilePostsQuery>;

/** «Подписчики» or «Подписки» of a member, a page at a time, newest first. */
export const FollowListQuery = z.strictObject({
  memberId: Id,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type FollowListQuery = z.infer<typeof FollowListQuery>;

/**
 * Подписка on or off; returns the new state. Only an active member follows; oneself is a
 * CONFLICT, someone restricted or in a Блокировка with the viewer is NOT_FOUND. A
 * Блокировка removes the Подписки both ways, and lifting it does not bring them back.
 */
export const SetFollowInput = z.strictObject({ memberId: Id, active: z.boolean() });
export type SetFollowInput = z.infer<typeof SetFollowInput>;

export const FollowState = z.strictObject({
  memberId: Id,
  following: z.boolean(),
  followers: z.number().int().min(0),
});
export type FollowState = z.infer<typeof FollowState>;

export const MemberPage = Page(AuthorView);
export type MemberPage = z.infer<typeof MemberPage>;
