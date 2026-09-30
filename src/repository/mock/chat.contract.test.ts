import { describe, expect, it } from 'vitest';

import { fixedClock, SEED_NOW } from '@/clock';
import { ChatPage, ChatSummary, MessagePage, type Session } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { defaultMockState } from './demo';
import { loadSeed } from './seed';

// Seed chats: chat1 m01–m09 (mutual Подписка; m01 has not read m09's last two),
// chat2 m01–the author of a comment on p01, chat3 m02–m06.

const seed = loadSeed();
const commenterOfChat2 = seed.chats.find((c) => c.id === 'chat2')!.memberIds[1];

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

type Store = ReturnType<typeof createMemoryStore>;
function on(store: Store, userId?: string, now = SEED_NOW) {
  return createMockRepository({
    clock: fixedClock(now),
    latency: 0,
    store,
    session: userId ? as(userId) : undefined,
  });
}

let keyCounter = 0;
const key = () => `message-key-${(keyCounter += 1).toString().padStart(4, '0')}`;
const ids = (page: { items: { id: string }[] }) => page.items.map((i) => i.id);

describe('the chat list', () => {
  it('shows own chats, latest message first, with unread counts', async () => {
    const store = createMemoryStore();
    const list = ChatPage.parse(await on(store, 'm01').listChats({}));
    expect(ids(list)).toEqual(['chat1', 'chat2']);
    const chat1 = list.items[0]!;
    expect(chat1).toMatchObject({
      context: { kind: 'mutual_follow' },
      unreadCount: 2,
      readOnly: false,
    });
    expect(chat1.peer).toMatchObject({ view: 'member', id: 'm09' });
    expect(chat1.lastMessage).toMatchObject({ fromMe: false, status: 'sent' });
    expect(list.items[1]).toMatchObject({
      context: { kind: 'comment', postId: 'p01' },
      unreadCount: 0,
    });
    expect(ids(await on(store, 'm04').listChats({}))).toEqual([]);
  });

  it('reads a chat: the count clears and the other side sees «прочитано»', async () => {
    const store = createMemoryStore();
    const before = await on(store, 'm09').listMessages({ chatId: 'chat1' });
    expect(before.items.at(-1)).toMatchObject({ fromMe: true, status: 'sent' });
    expect(before.items.find((m) => m.id === 'chat1-m21')).toMatchObject({
      fromMe: true,
      status: 'read',
    });

    const read = await on(store, 'm01').markChatRead({ chatId: 'chat1' });
    expect(read.unreadCount).toBe(0);
    const after = await on(store, 'm09').listMessages({ chatId: 'chat1' });
    expect(after.items.at(-1)?.status).toBe('read');
  });

  it('pages back in time, older messages first inside a page', async () => {
    const repo = on(createMemoryStore(), 'm01');
    const first = MessagePage.parse(await repo.listMessages({ chatId: 'chat1', limit: 2 }));
    expect(ids(first)).toEqual(['chat1-m24', 'chat1-m25']);
    const second = await repo.listMessages({
      chatId: 'chat1',
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(ids(second)).toEqual(['chat1-m22', 'chat1-m23']);
  });

  it('is for members; a stranger to the chat does not find it', async () => {
    const store = createMemoryStore();
    await expect(on(store).listChats({})).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(on(store, 'm04').getChat({ chatId: 'chat1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('opening a chat', () => {
  it('returns the existing chat of the pair with its first context', async () => {
    const store = createMemoryStore();
    const chat = ChatSummary.parse(
      await on(store, 'm01').openChat({ kind: 'mutual_follow', memberId: 'm09' }),
    );
    expect(chat).toMatchObject({ id: 'chat1', context: { kind: 'mutual_follow' } });

    const comment = seed.comments.find(
      (c) => c.authorId === 'm09' && !c.deleted && seed.posts.some((p) => p.id === c.postId),
    );
    if (comment) {
      const again = await on(store, 'm01').openChat({ kind: 'comment', commentId: comment.id });
      expect(again.id).toBe('chat1');
      expect(again.context.kind).toBe('mutual_follow');
    }
  });

  it('opens a new chat from someone else’s comment, once', async () => {
    const store = createMemoryStore();
    const comment = seed.comments.find(
      (c) => c.postId === 'p02' && !c.deleted && !['m04', 'm11'].includes(c.authorId),
    )!;
    const opened = await on(store, 'm04').openChat({ kind: 'comment', commentId: comment.id });
    expect(opened).toMatchObject({
      context: { kind: 'comment', postId: 'p02', commentId: comment.id },
      unreadCount: 0,
    });
    expect(opened.lastMessage).toBeUndefined();
    const again = await on(store, 'm04').openChat({ kind: 'comment', commentId: comment.id });
    expect(again.id).toBe(opened.id);
    // The other side finds it too.
    expect(ids(await on(store, comment.authorId).listChats({ limit: 50 }))).toContain(opened.id);
  });

  it('refuses one’s own comment and a one-way Подписка', async () => {
    const store = createMemoryStore();
    const own = seed.comments.find((c) => c.authorId === 'm04' && !c.deleted)!;
    await expect(
      on(store, 'm04').openChat({ kind: 'comment', commentId: own.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    // m12 follows m01, not back.
    await expect(
      on(store, 'm01').openChat({ kind: 'mutual_follow', memberId: 'm12' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('opens from an accepted Отклик for its two people only', async () => {
    const store = createMemoryStore();
    const response = await on(store, 'm04').respondToPlan({
      planId: 'plan1',
      idempotencyKey: key(),
    });
    await expect(
      on(store, 'm04').openChat({ kind: 'plan_response', responseId: response.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await on(store, 'm06').acceptPlanResponse({ responseId: response.id });
    const fromAuthor = await on(store, 'm06').openChat({
      kind: 'plan_response',
      responseId: response.id,
    });
    expect(fromAuthor.context).toEqual({
      kind: 'plan_response',
      planId: 'plan1',
      responseId: response.id,
    });
    const fromResponder = await on(store, 'm04').openChat({
      kind: 'plan_response',
      responseId: response.id,
    });
    expect(fromResponder.id).toBe(fromAuthor.id);
    await expect(
      on(store, 'm05').openChat({ kind: 'plan_response', responseId: response.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('is for active members only', async () => {
    await expect(
      on(createMemoryStore()).openChat({ kind: 'mutual_follow', memberId: 'm09' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const expired = on(createMemoryStore(), 'm01');
    await expired.expireMembership();
    await expect(
      expired.openChat({ kind: 'mutual_follow', memberId: 'm09' }),
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_EXPIRED' });
  });
});

describe('Блокировка', () => {
  it('hides the chat from both sides', async () => {
    const store = createMemoryStore();
    await on(store, 'm01').setBlock({ target: { type: 'user', id: 'm09' }, active: true });
    expect(ids(await on(store, 'm01').listChats({}))).toEqual(['chat2']);
    expect(ids(await on(store, 'm09').listChats({}))).toEqual([]);
    await expect(on(store, 'm09').getChat({ chatId: 'chat1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      on(store, 'm01').openChat({ kind: 'mutual_follow', memberId: 'm09' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('sending', () => {
  it('sends once per key and becomes the last message', async () => {
    const store = createMemoryStore();
    const input = { chatId: 'chat2', text: '  Давай в субботу?  ', idempotencyKey: key() };
    const sent = await on(store, 'm01').sendMessage(input);
    expect(sent).toMatchObject({ fromMe: true, text: 'Давай в субботу?', status: 'sent' });
    expect((await on(store, 'm01').sendMessage(input)).id).toBe(sent.id);
    const chat = await on(store, 'm01').getChat({ chatId: 'chat2' });
    expect(chat.lastMessage?.id).toBe(sent.id);
    // The other side has one unread now.
    expect((await on(store, commenterOfChat2).getChat({ chatId: 'chat2' })).unreadCount).toBe(1);
    await expect(
      on(store, 'm01').sendMessage({
        chatId: 'chat2',
        text: 'x'.repeat(1001),
        idempotencyKey: key(),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { text: 'too_long' } });
  });

  it('keeps a failed message to retry, and the retry sends it', async () => {
    const store = createMemoryStore();
    await on(store, 'm01').setDemoFlags({ failedMessageOnce: true });
    const failed = await on(store, 'm01').sendMessage({
      chatId: 'chat1',
      text: 'Не дошло',
      idempotencyKey: key(),
    });
    expect(failed.status).toBe('failed');
    // The other side never sees it as unread.
    expect((await on(store, 'm09').getChat({ chatId: 'chat1' })).unreadCount).toBe(0);

    const retried = await on(store, 'm01').retryMessage({ messageId: failed.id });
    expect(retried).toMatchObject({ id: failed.id, status: 'sent' });
    // The flag worked once.
    const next = await on(store, 'm01').sendMessage({
      chatId: 'chat1',
      text: 'А это дошло',
      idempotencyKey: key(),
    });
    expect(next.status).toBe('sent');
  });

  it('lets an expired member read but not write', async () => {
    const store = createMemoryStore();
    const repo = on(store, 'm01');
    await repo.expireMembership();
    const list = await on(store, 'm01').listChats({});
    expect(list.items.every((c) => c.readOnly)).toBe(true);
    await expect(
      on(store, 'm01').sendMessage({ chatId: 'chat1', text: 'Привет', idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_EXPIRED' });
  });
});

describe('persistence', () => {
  it('chats, messages and read marks survive a restart', async () => {
    const store = createMemoryStore();
    await on(store, 'm01').sendMessage({
      chatId: 'chat1',
      text: 'Сохранится',
      idempotencyKey: key(),
    });
    await on(store, 'm01').markChatRead({ chatId: 'chat1' });
    const chat = await on(store, 'm01').getChat({ chatId: 'chat1' });
    expect(chat).toMatchObject({ unreadCount: 0, lastMessage: { text: 'Сохранится' } });
  });

  it('keeps v15 state without a reset', async () => {
    const {
      chats: _chats,
      messages: _messages,
      chatReads: _reads,
      activitySeenAt: _seen,
      ...v15
    } = defaultMockState();
    const store = createMemoryStore({
      [storageKeys.state]: JSON.stringify({ version: 15, data: v15 }),
    });
    const repo = on(store, 'm01');
    expect(ids(await repo.listChats({}))).toEqual(['chat1', 'chat2']);
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
