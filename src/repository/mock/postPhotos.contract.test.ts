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
  it('is one per post and shown to active members', async () => {
    const store = createMemoryStore();
    const author = repositoryOn(as('m01'), store);
    const a = await upload(author, 1);
    const b = await upload(author, 2);
    const post = await author.createPost({
      type: 'post',
      text: 'Фотография с прогулки',
      topics: [],
      photoIds: [b.id],
      idempotencyKey: 'post-with-photos',
    });
    expect(post.photos?.map((p) => p.id)).toEqual([b.id]);

    const reader = repositoryOn(as('m03'), store);
    expect((await reader.getPost({ postId: post.id })).photos).toHaveLength(1);

    await expect(
      author.createPost({
        type: 'post',
        text: 'Две',
        topics: [],
        photoIds: [a.id, b.id],
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

describe('«Сгенерировано с ИИ»', () => {
  it('follows the origin read from the file, never the text', async () => {
    const store = createMemoryStore();
    const author = repositoryOn(as('m01'), store);
    const ai = await author.uploadPhoto({
      mimeType: 'image/png',
      sizeBytes: 2000,
      dataUrl: 'data:image/jpeg;base64,AIPIC',
      origin: 'ai',
      idempotencyKey: 'ai-photo-1',
    });
    const plain = await upload(author, 9);
    expect(ai.ai).toBe(true);
    expect(plain.ai).toBeUndefined();

    const post = await author.createPost({
      type: 'post',
      text: 'Сгенерировано с ИИ — просто слова в тексте',
      topics: [],
      photoIds: [plain.id],
      idempotencyKey: 'post-plain-photo',
    });
    expect(post.photos?.[0]?.ai).toBeUndefined();
    const aiPost = await author.createPost({
      type: 'post',
      text: 'Картинка из генератора',
      topics: [],
      photoIds: [ai.id],
      idempotencyKey: 'post-ai-photo',
    });
    const reader = repositoryOn(as('m03'), store);
    expect((await reader.getPost({ postId: aiPost.id })).photos?.[0]).toMatchObject({ ai: true });
  });
});

describe('Фото of a Встреча', () => {
  const plan = {
    city: '750000000',
    date: '2026-09-28',
    timeStart: '18:00',
    format: 'coffee',
    durationMinutes: 60,
    goal: 'talk',
    paymentPolicy: 'each_pays',
    budget: 'up_to_3000',
    placeArea: 'Центр',
    description: 'Кофе и разговор.',
    place: 'Кофейня у парка',
    isPublicPlace: true,
  } as const;

  it('is one, the author’s own, shown to active members and never to a guest', async () => {
    const store = createMemoryStore();
    const author = repositoryOn(as('m01'), store);
    const a = await upload(author, 21);
    const created = await author.createPlan({
      ...plan,
      topics: [],
      photoId: a.id,
      idempotencyKey: 'plan-with-photo',
    });
    expect(created.photo?.id).toBe(a.id);
    const reader = repositoryOn(as('m03'), store);
    expect((await reader.getPlan({ planId: created.id })).photo?.id).toBe(a.id);
    expect((await repositoryOn(undefined, store).getPlan({ planId: created.id })).photo).toBe(
      undefined,
    );

    const foreign = await upload(repositoryOn(as('m02'), store), 22);
    await expect(
      author.createPlan({
        ...plan,
        topics: [],
        photoId: foreign.id,
        idempotencyKey: 'plan-foreign-photo',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { photoId: 'unknown' } });
  });
});
