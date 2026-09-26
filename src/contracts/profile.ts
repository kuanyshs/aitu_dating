import { z } from 'zod';

import { communicationStyles, datingIntents, interests } from '@/catalogs';

import { Id, Page } from './common';
import { LIMITS } from './limits';
import { AuthorView } from './people';

/** What an active member may see of another member's Карточка. Never sent to guests. */
export const PublicCard = z.strictObject({
  bio: z.string().max(LIMITS.bio),
  intent: z.enum(datingIntents),
  interests: z.array(z.enum(interests)),
  communicationStyle: z.enum(communicationStyles),
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
  stats: z.strictObject({
    posts: z.number().int().min(0),
    followers: z.number().int().min(0),
    following: z.number().int().min(0),
  }),
  relation: ProfileRelation.optional(),
});
export type ProfileView = z.infer<typeof ProfileView>;

export const MemberRef = z.strictObject({ memberId: Id });
export type MemberRef = z.infer<typeof MemberRef>;

export const ProfilePostsQuery = z.strictObject({
  memberId: Id,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type ProfilePostsQuery = z.infer<typeof ProfilePostsQuery>;

/** Подписка on or off; returns the new state. */
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
