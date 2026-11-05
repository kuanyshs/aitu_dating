import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import type { Session } from '@/contracts';
import { createMemoryStore, type KeyValueStore } from '@/storage';

import { createMockRepository } from './createMockRepository';

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});
const on = (store: KeyValueStore, userId: string) =>
  createMockRepository({ clock: fixedClock(), latency: 0, store, session: as(userId) });

describe('«Поделиться в Aitu Dating» (v4 §20, §23)', () => {
  it('finds recipients by name or place, never oneself or anyone in a Блокировка', async () => {
    const store = createMemoryStore();
    const me = on(store, 'm03');
    const everyone = await me.listShareRecipients({ limit: 50 });
    const ids = everyone.items.map((p) => (p.view === 'member' ? p.id : ''));
    expect(ids).not.toContain('m03');
    expect(ids).not.toContain('m11'); // restricted

    await me.setBlock({ target: { type: 'user', id: 'm10' }, active: true });
    const after = await me.listShareRecipients({ limit: 50 });
    expect(after.items.map((p) => (p.view === 'member' ? p.id : ''))).not.toContain('m10');

    const inAstana = await me.listShareRecipients({ text: 'астана', limit: 50 });
    expect(inAstana.items.length).toBeGreaterThan(0);
    for (const p of inAstana.items) expect(p.view === 'member' && p.city).toBe('710000000');
  });

  it('sends the Встреча into the pair’s one chat, once per key, with a live status', async () => {
    const store = createMemoryStore();
    const me = on(store, 'm03');
    const sent = await me.shareMeeting({
      planId: 'plan1',
      memberId: 'm10',
      message: 'Посмотри, интересно?',
      idempotencyKey: 'share-key-0001',
    });
    expect(sent).toMatchObject({
      fromMe: true,
      text: 'Посмотри, интересно?',
      meeting: { kind: 'share', planId: 'plan1', state: 'open' },
    });
    expect(JSON.stringify(sent.meeting)).not.toContain('"place"');
    const again = await me.shareMeeting({
      planId: 'plan1',
      memberId: 'm10',
      idempotencyKey: 'share-key-0001',
    });
    expect(again.id).toBe(sent.id);

    // From the open chat: the same chat, a new message only for a new key.
    const fromChat = await me.shareMeeting({
      planId: 'plan1',
      chatId: sent.chatId,
      idempotencyKey: 'share-key-0002',
    });
    expect(fromChat.chatId).toBe(sent.chatId);
    const chats = await me.listChats({});
    expect(chats.items.filter((c) => c.peer.view === 'member' && c.peer.id === 'm10')).toHaveLength(
      1,
    );

    await on(store, 'm06').closePlan({ planId: 'plan1' });
    const seen = await on(store, 'm10').listMessages({ chatId: sent.chatId });
    expect(seen.items.map((m) => m.meeting?.state)).toEqual(['closed', 'closed']);
    await on(store, 'm06').cancelPlan({ planId: 'plan1' });
    await expect(
      on(store, 'm03').shareMeeting({
        planId: 'plan1',
        memberId: 'm09',
        idempotencyKey: 'share-key-0003',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuses oneself, a Блокировка and those who may not write', async () => {
    const store = createMemoryStore();
    const me = on(store, 'm03');
    await expect(
      me.shareMeeting({ planId: 'plan1', memberId: 'm03', idempotencyKey: 'share-self-01' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', fieldErrors: { memberId: 'self' } });
    await me.setBlock({ target: { type: 'user', id: 'm10' }, active: true });
    await expect(
      me.shareMeeting({ planId: 'plan1', memberId: 'm10', idempotencyKey: 'share-block-01' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      createMockRepository({ clock: fixedClock(), latency: 0 }).shareMeeting({
        planId: 'plan1',
        memberId: 'm10',
        idempotencyKey: 'share-guest-01',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
