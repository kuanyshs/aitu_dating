import { PHOTO_MAX_BYTES, PHOTO_TYPES, type PhotoType } from '@/contracts';

export type PhotoFileProblem = 'type' | 'too_big';

/** Why a picked file cannot be a Фото, or nothing when it can. */
export function checkPhotoFile(file: { type: string; size: number }): PhotoFileProblem | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > PHOTO_MAX_BYTES) return 'too_big';
  return null;
}

export const isPhotoType = (type: string): type is PhotoType =>
  (PHOTO_TYPES as readonly string[]).includes(type);

/** Longest side of the copy that is uploaded and shown. */
export const PHOTO_MAX_SIDE = 1280;

/** Size of the copy so that its longest side fits `max`, never enlarged. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
