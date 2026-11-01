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
    dataUrl: `data:image/jpeg;base64,CHAT${n}`,
    idempotencyKey: `chat-photo-${n}`,
  });

// Seed chat1 is between m01 and m09.
describe('a Фото in a chat message', () => {
  it('goes with or without words, and the other side sees it', async () => {
    const store = createMemoryStore();
    const sender = repositoryOn(as('m01'), store);
    const photo = await upload(sender, 1);
    const alone = await sender.sendMessage({
      chatId: 'chat1',
      text: '',
      photoId: photo.id,
      idempotencyKey: 'chat-photo-alone',
    });
    expect(alone).toMatchObject({ text: '', photo: { id: photo.id } });
    const both = await sender.sendMessage({
      chatId: 'chat1',
      text: 'Вид с крыши',
      photoId: photo.id,
      idempotencyKey: 'chat-photo-words',
    });
    expect(both).toMatchObject({ text: 'Вид с крыши', photo: { id: photo.id } });

    const page = await repositoryOn(as('m09'), store).listMessages({ chatId: 'chat1' });
    expect(page.items.filter((m) => m.photo?.id === photo.id)).toHaveLength(2);
  });

  it('needs words or a Фото, and only the sender’s own Фото', async () => {
    const store = createMemoryStore();
    const sender = repositoryOn(as('m01'), store);
    await expect(
      sender.sendMessage({ chatId: 'chat1', text: '  ', idempotencyKey: 'chat-empty-1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { text: 'required' } });
    const foreign = await upload(repositoryOn(as('m09'), store), 2);
    await expect(
      sender.sendMessage({
        chatId: 'chat1',
        text: 'Чужое',
        photoId: foreign.id,
        idempotencyKey: 'chat-foreign-1',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { photoId: 'unknown' } });
  });

  it('stays with a failed message, and the retry sends one message with it', async () => {
    const store = createMemoryStore();
    const sender = repositoryOn(as('m01'), store);
    const photo = await upload(sender, 3);
    await sender.setDemoFlags({ failedMessageOnce: true });
    const failed = await sender.sendMessage({
      chatId: 'chat1',
      text: 'Со второй попытки',
      photoId: photo.id,
      idempotencyKey: 'chat-photo-retry',
    });
    expect(failed).toMatchObject({ status: 'failed', photo: { id: photo.id } });
    const sent = await sender.retryMessage({ messageId: failed.id });
    expect(sent).toMatchObject({ id: failed.id, status: 'sent', photo: { id: photo.id } });
    const page = await sender.listMessages({ chatId: 'chat1' });
    expect(page.items.filter((m) => m.text === 'Со второй попытки')).toHaveLength(1);
  });

  it('is not shown to an expired member reading the chat', async () => {
    const store = createMemoryStore();
    const sender = repositoryOn(as('m01'), store);
    const photo = await upload(sender, 4);
    await sender.sendMessage({
      chatId: 'chat1',
      text: 'Только для участников',
      photoId: photo.id,
      idempotencyKey: 'chat-photo-expired',
    });
    const reader = repositoryOn(as('m09'), store);
    await reader.expireMembership();
    const page = await reader.listMessages({ chatId: 'chat1' });
    const message = page.items.find((m) => m.text === 'Только для участников');
    expect(message).toBeDefined();
    expect(message).not.toHaveProperty('photo');
  });
});
