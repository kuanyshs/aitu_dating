import { describe, expect, it } from 'vitest';

import { PHOTO_MAX_BYTES } from '@/contracts';

import { checkPhotoFile, fitWithin } from './photoFile';

describe('a picked file', () => {
  it('may be a JPG, PNG or WEBP of up to 10 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(checkPhotoFile({ type, size: PHOTO_MAX_BYTES })).toBeNull();
    }
  });

  it('is refused for another format or a larger size', () => {
    expect(checkPhotoFile({ type: 'image/gif', size: 10 })).toBe('type');
    expect(checkPhotoFile({ type: 'image/heic', size: 10 })).toBe('type');
    expect(checkPhotoFile({ type: 'image/jpeg', size: PHOTO_MAX_BYTES + 1 })).toBe('too_big');
  });
});

describe('the uploaded copy', () => {
  it('fits the longest side in 1280 px and is never enlarged', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
