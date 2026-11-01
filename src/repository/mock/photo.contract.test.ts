import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { PHOTO_MAX_BYTES, type Session, type UploadPhotoInput } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function repositoryOn(session?: Session, store = createMemoryStore()) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

const photo = (patch: Partial<UploadPhotoInput> = {}): UploadPhotoInput => ({
  mimeType: 'image/jpeg',
  sizeBytes: 2_000_000,
  dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
  idempotencyKey: 'photo-key-0001',
  ...patch,
});

describe('uploading a Фото', () => {
  it('stores a JPG, PNG or WEBP of up to 10 MB and returns it', async () => {
    const repo = repositoryOn(as('m01'));
    const stored = await repo.uploadPhoto(photo());
    expect(stored).toMatchObject({ kind: 'photo', url: photo().dataUrl });
    for (const mimeType of ['image/png', 'image/webp'] as const) {
      await expect(
        repo.uploadPhoto(photo({ mimeType, idempotencyKey: `photo-${mimeType}` })),
      ).resolves.toMatchObject({ kind: 'photo' });
    }
  });

  it('refuses another format and a file over 10 MB', async () => {
    const repo = repositoryOn(as('m01'));
    await expect(repo.uploadPhoto(photo({ mimeType: 'image/gif' as never }))).rejects.toMatchObject(
      { code: 'VALIDATION_ERROR', fieldErrors: { mimeType: 'type' } },
    );
    await expect(repo.uploadPhoto(photo({ sizeBytes: PHOTO_MAX_BYTES + 1 }))).rejects.toMatchObject(
      { code: 'VALIDATION_ERROR', fieldErrors: { sizeBytes: 'too_big' } },
    );
    await expect(repo.uploadPhoto(photo({ sizeBytes: PHOTO_MAX_BYTES }))).resolves.toBeTruthy();
  });

  it('is for members only', async () => {
    await expect(repositoryOn().uploadPhoto(photo())).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('returns the same Фото for a retried key, also after a network error', async () => {
    const repo = repositoryOn(as('m01'));
    await repo.setDemoFlags({ networkErrorOnce: true });
    await expect(repo.uploadPhoto(photo())).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const first = await repo.uploadPhoto(photo());
    const again = await repo.uploadPhoto(photo());
    expect(again.id).toBe(first.id);
  });

  it('keeps the picture apart from the state, survives a restart and leaves on reset', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(as('m01'), store);
    const stored = await repo.uploadPhoto(photo());
    const key = `${storageKeys.photoPrefix}${stored.id}`;
    expect(await store.getItem(key)).toBe(photo().dataUrl);
    expect(await store.getItem(storageKeys.state)).not.toContain('base64');

    const restarted = repositoryOn(as('m01'), store);
    expect((await restarted.uploadPhoto(photo())).url).toBe(photo().dataUrl);

    await restarted.resetDemo();
    expect(await store.getItem(key)).toBeNull();
  });
});
