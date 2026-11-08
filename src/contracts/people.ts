import { z } from 'zod';

import { genders, isNationalityCode, isPlaceCode, isSettlementCode } from '@/catalogs';

import { Id } from './common';

/** A Населённый пункт: its KATO code in the settlements directory. */
export const SettlementCode = z.string().refine(isSettlementCode, 'unknown');
export type SettlementCode = z.infer<typeof SettlementCode>;
export const GenderKey = z.enum(genders);

/** «Где живёт»: a KATO settlement or another country (ISO 3166-1 alpha-2). */
export const PlaceCode = z.string().refine(isPlaceCode, 'unknown');
export type PlaceCode = z.infer<typeof PlaceCode>;

/** A Национальность of the BNS list. */
export const NationalityCode = z.string().refine(isNationalityCode, 'unknown');

/**
 * How an avatar is drawn. The mock has no photos: members get a deterministic
 * synthetic avatar, guests always get the shared neutral one. A photo variant with a
 * URL can be added by the backend later.
 */
export const AvatarRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('neutral') }),
  z.object({ kind: z.literal('synthetic'), key: z.string().min(1) }),
  /** The member's main Фото; full view only. */
  z.object({ kind: z.literal('photo'), url: z.string().min(1) }),
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
  /** Absent when the person chose not to name it. */
  city: SettlementCode.optional(),
  avatar: z.strictObject({ kind: z.literal('neutral') }),
});
export type SafeAuthorView = z.infer<typeof SafeAuthorView>;

/** Полный вид: what an active member sees of another member. */
export const MemberAuthorView = z.strictObject({
  view: z.literal('member'),
  id: Id,
  name: z.string().min(1),
  /** Present only when its owner shows it in the profile. */
  surname: z.string().min(1).optional(),
  verified: z.boolean(),
  gender: GenderKey,
  age: z.number().int().min(18),
  city: SettlementCode.optional(),
  avatar: AvatarRef,
});
export type MemberAuthorView = z.infer<typeof MemberAuthorView>;

export const AuthorView = z.discriminatedUnion('view', [SafeAuthorView, MemberAuthorView]);
export type AuthorView = z.infer<typeof AuthorView>;
