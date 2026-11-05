import { PREVIEW_SIZE } from '@/contracts';

import { fitWithin } from './photoFile';

/** A smaller JPEG copy of the picked file, as a data URL the repository stores. */
export async function resizePhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * The blurred stand-in sent to those who may not see the picture: PREVIEW_SIZE pixels on the
 * long side, so there is nothing to recover from it.
 */
export async function tinyPreview(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = PREVIEW_SIZE / Math.max(bitmap.width, bitmap.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.6);
}
