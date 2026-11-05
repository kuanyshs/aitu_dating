import { z } from 'zod';

import { Id } from './common';

/** Formats a browser records in; the parameters after «;» are dropped before upload. */
export const VOICE_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'] as const;
export type VoiceType = (typeof VOICE_TYPES)[number];

/** One voice message lasts a minute at most, and its file stays small. */
export const VOICE_MAX_MS = 60_000;
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;

export const UploadVoiceInput = z.strictObject({
  mimeType: z.enum(VOICE_TYPES, 'type'),
  durationMs: z.number().int().positive().max(VOICE_MAX_MS, 'too_long'),
  sizeBytes: z.number().int().positive().max(VOICE_MAX_BYTES, 'too_big'),
  dataUrl: z.string().regex(/^data:audio\/[a-z0-9.+-]+(;[^,;]+=[^,;]+)*;base64,/, 'type'),
  idempotencyKey: z.string().min(8),
});
export type UploadVoiceInput = z.infer<typeof UploadVoiceInput>;

/** A recorded voice message as a DTO; like a Фото, for active members and its sender. */
export const VoiceRef = z.strictObject({
  kind: z.literal('voice'),
  id: Id,
  url: z.string().min(1),
  durationMs: z.number().int().positive().max(VOICE_MAX_MS),
});
export type VoiceRef = z.infer<typeof VoiceRef>;
