import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import type { MessageView, Session } from '@/contracts';
import { createMemoryStore, type KeyValueStore } from '@/storage';

import { createMockRepository } from './createMockRepository';

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});
const on = (store: KeyValueStore, userId: string) =>
  createMockRepository({ clock: fixedClock(), latency: 0, store, session: as(userId) });

/** The newest card of plan1 in the chat between `userId` and the plan's author m06. */
async function card(store: KeyValueStore, userId: string, peer = 'm06'): Promise<MessageView> {
  const repo = on(store, userId);
  const chats = await repo.listChats({});
  const chat = chats.items.find((c) => c.peer.view === 'member' && c.peer.id === peer)!;
  const messages = await repo.listMessages({ chatId: chat.id });
  return messages.items.filter((m) => m.meeting?.planId === 'plan1').at(-1)!;
}

describe('a Запрос puts the Встреча in the pair’s chat (v4 §18)', () => {
  it('with its words, the details without the exact place, and a live status', async () => {
    const store = createMemoryStore();
    const sent = await on(store, 'm02').respondToPlan({
      planId: 'plan1',
      message: 'Я бы с радостью!',
      idempotencyKey: 'card-response-1',
    });

    const mine = await card(store, 'm02');
    expect(mine).toMatchObject({
      fromMe: true,
      text: 'Я бы с радостью!',
      meeting: { kind: 'request', planId: 'plan1', state: 'requested' },
    });
    expect(mine.meeting?.plan).toMatchObject({ id: 'plan1', format: 'coffee' });
    expect(JSON.stringify(mine.meeting)).not.toContain('"place"');
    expect((await card(store, 'm06', 'm02')).meeting?.state).toBe('requested');

    // One standing Запрос: sending again returns it and adds no second card.
    await on(store, 'm02').respondToPlan({ planId: 'plan1', idempotencyKey: 'card-response-2' });
    const repo = on(store, 'm02');
    const chat = (await repo.listChats({})).items.find(
      (c) => c.peer.view === 'member' && c.peer.id === 'm06',
    )!;
    const cards = (await repo.listMessages({ chatId: chat.id })).items.filter((m) => m.meeting);
    expect(cards).toHaveLength(1);

    await on(store, 'm03').respondToPlan({ planId: 'plan1', idempotencyKey: 'card-response-3' });
    await on(store, 'm06').acceptPlanResponse({ responseId: sent.id });
    expect((await card(store, 'm02')).meeting?.state).toBe('matched');
    expect((await card(store, 'm03')).meeting?.state).toBe('declined');
  });

  it('reads «Запрос отозван», «Встреча отменена» and «Встреча удалена» as things change', async () => {
    const store = createMemoryStore();
    const first = await on(store, 'm02').respondToPlan({
      planId: 'plan1',
      idempotencyKey: 'card-withdraw-1',
    });
    await on(store, 'm02').withdrawPlanResponse({ responseId: first.id });
    expect((await card(store, 'm02')).meeting?.state).toBe('withdrawn');

    await on(store, 'm02').respondToPlan({ planId: 'plan1', idempotencyKey: 'card-withdraw-2' });
    expect((await card(store, 'm02')).meeting?.state).toBe('requested');
    await on(store, 'm06').cancelPlan({ planId: 'plan1' });
    expect((await card(store, 'm02')).meeting?.state).toBe('cancelled');

    await on(store, 'm06').deletePost({ postId: 'p-plan1' });
    const gone = await card(store, 'm02');
    expect(gone.meeting).toEqual({ kind: 'request', planId: 'plan1', state: 'deleted' });
  });

  it('shows the Фото to active members only', async () => {
    const store = createMemoryStore();
    const author = on(store, 'm06');
    const photo = await author.uploadPhoto({
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      dataUrl: 'data:image/jpeg;base64,PLANPHOTO',
      idempotencyKey: 'card-plan-photo',
    });
    const plan = await author.createPlan({
      city: '750000000',
      date: '2026-09-28',
      timeStart: '18:00',
      format: 'walk',
      durationMinutes: 60,
      goal: 'talk',
      paymentPolicy: 'each_pays',
      budget: 'up_to_3000',
      placeArea: 'Парк',
      description: 'Прогулка.',
      place: 'Вход в парк',
      isPublicPlace: true,
      topics: [],
      photoId: photo.id,
      idempotencyKey: 'card-plan-with-photo',
    });
    const sender = on(store, 'm02');
    await sender.respondToPlan({ planId: plan.id, idempotencyKey: 'card-photo-1' });
    const chat = (await sender.listChats({})).items.find(
      (c) => c.peer.view === 'member' && c.peer.id === 'm06',
    )!;
    const cardOf = async () =>
      (await on(store, 'm02').listMessages({ chatId: chat.id })).items.find(
        (m) => m.meeting?.planId === plan.id,
      )!;
    expect((await cardOf()).meeting?.photo?.id).toBe(photo.id);
    await on(store, 'm02').expireMembership();
    expect((await cardOf()).meeting?.photo).toBeUndefined();
  });
});
