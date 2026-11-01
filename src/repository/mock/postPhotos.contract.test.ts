import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import type { Session } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function repositoryOn(session?: Session, store = createMemoryStore()) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

const upload = (repo: MockRepository, n: number) =>
  repo.uploadPhoto({
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    dataUrl: `data:image/jpeg;base64,POST${n}`,
    idempotencyKey: `post-photo-${n}`,
  });

describe('Фото in a post', () => {
  it('are published in order, up to two, and shown to active members', async () => {
    const store = createMemoryStore();
    const author = repositoryOn(as('m01'), store);
    const a = await upload(author, 1);
    const b = await upload(author, 2);
    const post = await author.createPost({
      type: 'post',
      text: 'Две фотографии с прогулки',
      topics: [],
      photoIds: [b.id, a.id],
      idempotencyKey: 'post-with-photos',
    });
    expect(post.photos?.map((p) => p.id)).toEqual([b.id, a.id]);

    const reader = repositoryOn(as('m03'), store);
    expect((await reader.getPost({ postId: post.id })).photos).toHaveLength(2);

    const c = await upload(author, 3);
    await expect(
      author.createPost({
        type: 'post',
        text: 'Три',
        topics: [],
        photoIds: [a.id, b.id, c.id],
        idempotencyKey: 'post-three-photos',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { photoIds: 'too_many' } });
  });

  it('must be the author’s own', async () => {
    const store = createMemoryStore();
    const other = await upload(repositoryOn(as('m02'), store), 1);
    await expect(
      repositoryOn(as('m01'), store).createPost({
        type: 'post',
        text: 'Чужое фото',
        topics: [],
        photoIds: [other.id],
        idempotencyKey: 'post-foreign-photo',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { photoIds: 'unknown' } });
  });

  it('never reach a guest', async () => {
    const store = createMemoryStore();
    const author = repositoryOn(as('m01'), store);
    const a = await upload(author, 1);
    const post = await author.createPost({
      type: 'post',
      text: 'Фото только для участников',
      topics: [],
      photoIds: [a.id],
      idempotencyKey: 'post-guest-photo',
    });
    const seen = await repositoryOn(undefined, store).getPost({ postId: post.id });
    expect(seen).not.toHaveProperty('photos');
    expect(JSON.stringify(seen)).not.toContain('POST1');
  });
});
