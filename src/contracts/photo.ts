import { z } from 'zod';

import { Id } from './common';

/** Picture formats a member may upload. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

/** The original file may be up to 10 MB; the client sends a smaller copy. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** How many Фото fit in each place. */
export const PHOTO_LIMITS = { profile: 4, post: 1, plan: 1, message: 1 } as const;

export const UploadPhotoInput = z.strictObject({
  /** Format and size of the file the member picked, checked before anything is stored. */
  mimeType: z.enum(PHOTO_TYPES, 'type'),
  sizeBytes: z.number().int().positive().max(PHOTO_MAX_BYTES, 'too_big'),
  /** The resized copy that is stored and shown. */
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, 'type'),
  /**
   * What the original file's metadata says about where it came from, read by the app before
   * the copy is made; `ai` puts «Сгенерировано с ИИ» under it. Never chosen by the author.
   */
  origin: z.enum(['upload', 'ai']).optional(),
  idempotencyKey: z.string().min(8),
});
export type UploadPhotoInput = z.infer<typeof UploadPhotoInput>;

/** A Фото as a DTO; only active members ever receive one. */
export const PhotoRef = z.strictObject({
  kind: z.literal('photo'),
  id: Id,
  url: z.string().min(1),
  /** Made by a generative model: shown with «Сгенерировано с ИИ». */
  ai: z.literal(true).optional(),
});
export type PhotoRef = z.infer<typeof PhotoRef>;
