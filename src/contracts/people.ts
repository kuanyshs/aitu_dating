import { z } from 'zod';

import { cities, genders } from '@/catalogs';

import { Id } from './common';

export const CityKey = z.enum(cities);
export const GenderKey = z.enum(genders);

/**
 * How an avatar is drawn. The mock has no photos: members get a deterministic
 * synthetic avatar, guests always get the shared neutral one. A photo variant with a
 * URL can be added by the backend later.
 */
export const AvatarRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('neutral') }),
  z.object({ kind: z.literal('synthetic'), key: z.string().min(1) }),
]);
export type AvatarRef = z.infer<typeof AvatarRef>;

/**
 * Безопасный вид: the only shape of another person a guest or an expired member
 * receives. No id, name, username, photo, interests or intent — strict, so extra
 * fields fail validation instead of leaking.
 */
export const SafeAuthorView = z.strictObject({
  view: z.literal('safe'),
  gender: GenderKey,
  age: z.number().int().min(18),
  city: CityKey,
  avatar: z.strictObject({ kind: z.literal('neutral') }),
});
export type SafeAuthorView = z.infer<typeof SafeAuthorView>;

/** Полный вид: what an active member sees of another member. */
export const MemberAuthorView = z.strictObject({
  view: z.literal('member'),
  id: Id,
  name: z.string().min(1),
  verified: z.boolean(),
  gender: GenderKey,
  age: z.number().int().min(18),
  city: CityKey,
  avatar: AvatarRef,
});
export type MemberAuthorView = z.infer<typeof MemberAuthorView>;

export const AuthorView = z.discriminatedUnion('view', [SafeAuthorView, MemberAuthorView]);
export type AuthorView = z.infer<typeof AuthorView>;
