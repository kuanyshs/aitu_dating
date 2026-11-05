import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import type { Session } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function repositoryOn(session?: Session, store = createMemoryStore()) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

const voice = (key: string) => ({
  mimeType: 'audio/webm' as const,
  durationMs: 4200,
  sizeBytes: 3000,
  dataUrl: 'data:audio/webm;codecs=opus;base64,VOICE',
  idempotencyKey: key,
});

describe('free conversation (v4 §12)', () => {
  it('lets anyone verified write to anyone, without a Подписка, Запрос or Комментарий', async () => {
    const store = createMemoryStore();
    const me = repositoryOn(as('m03'), store);
    const chat = await me.openChat({ kind: 'member', memberId: 'm09' });
    expect(chat.context).toEqual({ kind: 'conversation' });
    for (const [i, text] of ['Привет!', 'Как дела?', 'Ещё одно'].entries()) {
      await me.sendMessage({ chatId: chat.id, text, idempotencyKey: `free-chat-${i}-key` });
    }
    expect((await me.listMessages({ chatId: chat.id })).items).toHaveLength(3);
  });

  it('keeps one chat per pair, whichever way it is opened', async () => {
    const store = createMemoryStore();
    const me = repositoryOn(as('m03'), store);
    const first = await me.openChat({ kind: 'member', memberId: 'm09' });
    const again = await me.openChat({ kind: 'member', memberId: 'm09' });
    expect(again.id).toBe(first.id);
    const theirs = await repositoryOn(as('m09'), store).openChat({
      kind: 'member',
      memberId: 'm03',
    });
    expect(theirs.id).toBe(first.id);
    const chats = await me.listChats({});
    expect(chats.items.filter((c) => c.peer.view === 'member' && c.peer.id === 'm09')).toHaveLength(
      1,
    );
  });

  it('is closed by a Блокировка either way, and to oneself, guests and expired members', async () => {
    const store = createMemoryStore();
    const me = repositoryOn(as('m03'), store);
    const chat = await me.openChat({ kind: 'member', memberId: 'm09' });
    await me.setBlock({ target: { type: 'user', id: 'm09' }, active: true });
    await expect(me.openChat({ kind: 'member', memberId: 'm09' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      me.sendMessage({ chatId: chat.id, text: 'Ещё', idempotencyKey: 'blocked-message-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      repositoryOn(as('m09'), store).openChat({ kind: 'member', memberId: 'm03' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(me.openChat({ kind: 'member', memberId: 'm03' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(
      repositoryOn().openChat({ kind: 'member', memberId: 'm09' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const expired = repositoryOn(as('m05'));
    await expired.expireMembership();
    await expect(expired.openChat({ kind: 'member', memberId: 'm09' })).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
  });
});

describe('voice messages', () => {
  it('are stored once per key and sent in the pair’s chat', async () => {
    const store = createMemoryStore();
    const me = repositoryOn(as('m03'), store);
    const recorded = await me.uploadVoice(voice('voice-key-0001'));
    expect(recorded).toMatchObject({ kind: 'voice', durationMs: 4200 });
    expect(await me.uploadVoice(voice('voice-key-0001'))).toEqual(recorded);

    const chat = await me.openChat({ kind: 'member', memberId: 'm09' });
    const message = await me.sendMessage({
      chatId: chat.id,
      text: '',
      voiceId: recorded.id,
      idempotencyKey: 'voice-message-1',
    });
    expect(message.voice).toEqual(recorded);
    const again = await me.sendMessage({
      chatId: chat.id,
      text: '',
      voiceId: recorded.id,
      idempotencyKey: 'voice-message-1',
    });
    expect(again.id).toBe(message.id);

    const peer = repositoryOn(as('m09'), store);
    const seen = await peer.listMessages({ chatId: chat.id });
    expect(seen.items.at(-1)?.voice?.durationMs).toBe(4200);
  });

  it('last a minute at most, must be the sender’s own and never reach an expired reader', async () => {
    const store = createMemoryStore();
    const me = repositoryOn(as('m03'), store);
    await expect(
      me.uploadVoice({ ...voice('voice-key-long'), durationMs: 61_000 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { durationMs: 'too_long' } });
    await expect(
      me.uploadVoice({ ...voice('voice-key-big'), sizeBytes: 3 * 1024 * 1024 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { sizeBytes: 'too_big' } });

    const theirs = await repositoryOn(as('m09'), store).uploadVoice(voice('voice-key-theirs'));
    const chat = await me.openChat({ kind: 'member', memberId: 'm09' });
    await expect(
      me.sendMessage({
        chatId: chat.id,
        text: '',
        voiceId: theirs.id,
        idempotencyKey: 'stolen-voice',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { voiceId: 'unknown' } });

    const mine = await me.uploadVoice(voice('voice-key-mine'));
    await me.sendMessage({
      chatId: chat.id,
      text: '',
      voiceId: mine.id,
      idempotencyKey: 'mine-voice',
    });
    const peer = repositoryOn(as('m09'), store);
    await peer.expireMembership();
    const seen = await peer.listMessages({ chatId: chat.id });
    expect(seen.items.at(-1)?.voice).toBeUndefined();
  });
});
