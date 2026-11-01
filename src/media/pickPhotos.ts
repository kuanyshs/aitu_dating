import { PHOTO_TYPES } from '@/contracts';

/**
 * Opens the browser's file picker for pictures. The product is a mobile web app, so the
 * system picker (camera or gallery) is all it needs. Resolves with nothing on cancel.
 */
export function pickPhotos(max: number): Promise<File[]> {
  if (typeof document === 'undefined' || max < 1) return Promise.resolve([]);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = PHOTO_TYPES.join(',');
    input.multiple = max > 1;
    input.style.display = 'none';
    const done = (files: File[]) => {
      input.remove();
      resolve(files.slice(0, max));
    };
    input.addEventListener('change', () => done(Array.from(input.files ?? [])));
    input.addEventListener('cancel', () => done([]));
    document.body.appendChild(input);
    input.click();
  });
}
