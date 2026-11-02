import { describe, expect, it } from 'vitest';

import { fixedClock, SEED_NOW } from '@/clock';
import type { Session } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { loadSeed } from './seed';

// Seed chats: chat1 m01–m09 (mutual Подписка; m01 has not read chat1-m24 and chat1-m25),
// chat2 m01–the author of a comment on p01. plan1 is m06's.

const seed = loadSeed();
const chat2 = seed.chats.find((c) => c.id === 'chat2')!;
const commentOfChat2 = chat2.context.kind === 'comment' ? chat2.context.commentId : '';
const commenterOfChat2 = chat2.memberIds[1];

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

type Store = ReturnType<typeof createMemoryStore>;
const on = (store: Store, userId?: string, now = SEED_NOW) =>
  createMockRepository({
    clock: fixedClock(now),
    latency: 0,
    store,
    session: userId ? as(userId) : undefined,
  });

let keyCounter = 0;
const key = () => `contexts-key-${(keyCounter += 1).toString().padStart(4, '0')}`;

async function meeting(store: Store) {
  const response = await on(store, 'm04').respondToPlan({ planId: 'plan1', idempotencyKey: key() });
  await on(store, 'm06').acceptPlanResponse({ responseId: response.id });
  const chat = await on(store, 'm04').openChat({ kind: 'plan_response', responseId: response.id });
  return { response, chat };
}

describe('Контексты чата', () => {
  it('a cancelled План keeps the chat, open for text, with «Встреча отменена»', async () => {
    const store = createMemoryStore();
    const { chat } = await meeting(store);
    expect(chat.context).toMatchObject({ kind: 'plan_response', cancelled: false });

    await on(store, 'm06').cancelPlan({ planId: 'plan1' });
    const after = await on(store, 'm04').getChat({ chatId: chat.id });
    expect(after.context).toMatchObject({ kind: 'plan_response', cancelled: true });
    expect(after.readOnly).toBe(false);
    await expect(
      on(store, 'm04').sendMessage({
        chatId: chat.id,
        text: 'Жаль, в другой раз',
        idempotencyKey: key(),
      }),
    ).resolves.toMatchObject({ status: 'sent' });
  });

  it('the chosen one stepping out cancels the Встреча in the chat', async () => {
    const store = createMemoryStore();
    const { chat } = await meeting(store);
    await on(store, 'm04').leaveMeeting({ planId: 'plan1' });
    const after = await on(store, 'm06').getChat({ chatId: chat.id });
    expect(after.context).toMatchObject({ kind: 'plan_response', cancelled: true });
  });

  it('a new reason is added to the same chat, once, newest first', async () => {
    const store = createMemoryStore();
    const { chat } = await meeting(store);
    // m04 and m06 follow each other: the mutual Подписка joins the meeting chat.
    await on(store, 'm04').setFollow({ memberId: 'm06', active: true });
    await on(store, 'm06').setFollow({ memberId: 'm04', active: true });
    const both = await on(store, 'm06').openChat({ kind: 'mutual_follow', memberId: 'm04' });
    expect(both.id).toBe(chat.id);
    expect(both.contexts.map((c) => c.kind)).toEqual(['mutual_follow', 'plan_response']);
    expect(both.context.kind).toBe('mutual_follow');

    const again = await on(store, 'm04').openChat({ kind: 'mutual_follow', memberId: 'm06' });
    expect(again.contexts).toHaveLength(2);
    const list = await on(store, 'm04').listChats({});
    expect(list.items.filter((c) => c.peer.view === 'member' && c.peer.id === 'm06')).toHaveLength(
      1,
    );
  });

  it('reads «Переписка» once the Подписка is no longer mutual', async () => {
    const store = createMemoryStore();
    await on(store, 'm01').setFollow({ memberId: 'm09', active: false });
    const chat = await on(store, 'm01').getChat({ chatId: 'chat1' });
    expect(chat.contexts).toEqual([{ kind: 'conversation' }]);
  });

  it('reads «Переписка» once the Комментарий is deleted', async () => {
    const store = createMemoryStore();
    await on(store, commenterOfChat2).deleteComment({ commentId: commentOfChat2 });
    const chat = await on(store, 'm01').getChat({ chatId: 'chat2' });
    expect(chat.context).toEqual({ kind: 'conversation' });
  });
});

describe('unread messages', () => {
  it('put their chats above read ones, whatever came later', async () => {
    const store = createMemoryStore();
    // chat2 gets the latest message, but chat1 still waits to be read.
    await on(store, 'm01').sendMessage({ chatId: 'chat2', text: 'Привет', idempotencyKey: key() });
    const ids = async () => (await on(store, 'm01').listChats({})).items.map((c) => c.id);
    expect(await ids()).toEqual(['chat1', 'chat2']);
    await on(store, 'm01').markChatRead({ chatId: 'chat1' });
    expect(await ids()).toEqual(['chat2', 'chat1']);
  });

  it('are counted across all chats, and a demo message arrives unread', async () => {
    const store = createMemoryStore();
    const repo = on(store, 'm01');
    expect(await repo.countUnreadMessages()).toEqual({ count: 2 });
    const activityBefore = await repo.listActivity({ category: 'all', limit: 50 });

    expect(await repo.receiveDemoMessage()).toBe(true);
    expect(await repo.countUnreadMessages()).toEqual({ count: 3 });
    const chat1 = await repo.getChat({ chatId: 'chat1' });
    expect(chat1).toMatchObject({ unreadCount: 3, lastMessage: { fromMe: false } });

    // Messages stay in «Сообщения»: «Уведомления» get nothing new.
    const activityAfter = await repo.listActivity({ category: 'all', limit: 50 });
    expect(activityAfter.items.map((i) => i.id)).toEqual(activityBefore.items.map((i) => i.id));
    expect(await on(store, 'm04').receiveDemoMessage()).toBe(false);
  });

  it('are read only up to the message shown, and the mark never moves back', async () => {
    const store = createMemoryStore();
    const repo = on(store, 'm01');
    const upTo24 = await repo.markChatRead({ chatId: 'chat1', upToMessageId: 'chat1-m24' });
    expect(upTo24.unreadCount).toBe(1);
    const back = await repo.markChatRead({ chatId: 'chat1', upToMessageId: 'chat1-m21' });
    expect(back.unreadCount).toBe(1);
    const all = await repo.markChatRead({ chatId: 'chat1', upToMessageId: 'chat1-m25' });
    expect(all.unreadCount).toBe(0);
    await expect(
      repo.markChatRead({ chatId: 'chat1', upToMessageId: 'chat2-m1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
