import { describe, expect, it } from 'vitest';

import { fixedClock, SEED_NOW } from '@/clock';
import {
  MyResponsePage,
  PlanPage,
  PlanResponsePage,
  PlanResponseView,
  type CreatePlanInput,
  type Session,
} from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';

// plan1 (m06) starts 2026-09-27 11:00 in Almaty; plan4 (m09) is a Встреча. Every call
// gets a fresh instance: each one reads the stored state once.

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function on(store: ReturnType<typeof createMemoryStore>, userId?: string, now = SEED_NOW) {
  return createMockRepository({
    clock: fixedClock(now),
    latency: 0,
    store,
    session: userId ? as(userId) : undefined,
  });
}

let keyCounter = 0;
const key = () => `response-key-${(keyCounter += 1).toString().padStart(4, '0')}`;

const respond = (
  store: ReturnType<typeof createMemoryStore>,
  userId: string,
  planId = 'plan1',
  message?: string,
) => on(store, userId).respondToPlan({ planId, idempotencyKey: key(), message });

describe('sending an Отклик', () => {
  it('waits for the author, with or without a message', async () => {
    const store = createMemoryStore();
    const sent = PlanResponseView.parse(await respond(store, 'm02', 'plan1', '  Привет!  '));
    expect(sent).toMatchObject({ planId: 'plan1', status: 'pending', message: 'Привет!' });
    expect(sent.author).toMatchObject({ view: 'member', id: 'm02' });
    const bare = await respond(store, 'm03');
    expect(bare.message).toBeUndefined();

    expect((await on(store, 'm02').getPlan({ planId: 'plan1' })).myResponse).toEqual({
      id: sent.id,
      status: 'pending',
    });
    expect((await on(store, 'm06').getPlan({ planId: 'plan1' })).pendingResponses).toBe(2);
    expect((await on(store, 'm04').getPlan({ planId: 'plan1' })).myResponse).toBeUndefined();
  });

  it('keeps one standing Отклик per person and plan', async () => {
    const store = createMemoryStore();
    const input = { planId: 'plan1', idempotencyKey: key() };
    const first = await on(store, 'm02').respondToPlan(input);
    expect((await on(store, 'm02').respondToPlan(input)).id).toBe(first.id);
    expect((await respond(store, 'm02', 'plan1', 'Ещё раз')).id).toBe(first.id);
    expect((await on(store, 'm06').listPlanResponses({ planId: 'plan1' })).items).toHaveLength(1);
  });

  it('is not for the author, nor for a closed, matched or past plan', async () => {
    const store = createMemoryStore();
    await expect(respond(store, 'm06')).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(respond(store, 'm02', 'plan4')).rejects.toMatchObject({ code: 'CONFLICT' });
    await on(store, 'm03').closePlan({ planId: 'plan2' });
    await expect(respond(store, 'm02', 'plan2')).rejects.toMatchObject({ code: 'CONFLICT' });
    // 2026-09-27 11:00 in Almaty: plan1 has started.
    const late = on(store, 'm02', '2026-09-27T06:00:00Z');
    await expect(
      late.respondToPlan({ planId: 'plan1', idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('is for active members only, with a message up to 360 characters', async () => {
    const store = createMemoryStore();
    await expect(
      on(store).respondToPlan({ planId: 'plan1', idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const expired = on(createMemoryStore(), 'm02');
    await expired.expireMembership();
    await expect(
      expired.respondToPlan({ planId: 'plan1', idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_EXPIRED' });
    await expect(respond(store, 'm02', 'plan1', 'x'.repeat(361))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { message: 'too_long' },
    });
  });
});

describe('withdrawing', () => {
  it('lets the sender withdraw a waiting Отклик and send a new one', async () => {
    const store = createMemoryStore();
    const first = await respond(store, 'm02');
    await expect(
      on(store, 'm03').withdrawPlanResponse({ responseId: first.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const withdrawn = await on(store, 'm02').withdrawPlanResponse({ responseId: first.id });
    expect(withdrawn.status).toBe('withdrawn');
    // Twice is a no-op.
    expect((await on(store, 'm02').withdrawPlanResponse({ responseId: first.id })).status).toBe(
      'withdrawn',
    );
    expect((await on(store, 'm02').getPlan({ planId: 'plan1' })).myResponse).toBeUndefined();
    expect((await on(store, 'm06').getPlan({ planId: 'plan1' })).pendingResponses).toBe(0);

    const again = await respond(store, 'm02');
    expect(again.id).not.toBe(first.id);
    expect(again.status).toBe('pending');
  });

  it('cannot take back an Отклик the author has decided on', async () => {
    const store = createMemoryStore();
    const sent = await respond(store, 'm02');
    await on(store, 'm06').declinePlanResponse({ responseId: sent.id });
    await expect(
      on(store, 'm02').withdrawPlanResponse({ responseId: sent.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('the author decides', () => {
  it('accepts one: the plan becomes a Встреча, the others are declined', async () => {
    const store = createMemoryStore();
    const chosen = await respond(store, 'm02');
    const other = await respond(store, 'm03');
    const withdrawn = await respond(store, 'm04');
    await on(store, 'm04').withdrawPlanResponse({ responseId: withdrawn.id });

    await expect(
      on(store, 'm02').acceptPlanResponse({ responseId: chosen.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const accepted = await on(store, 'm06').acceptPlanResponse({ responseId: chosen.id });
    expect(accepted.status).toBe('accepted');
    // Accepting the same one again is a no-op; another one is not possible.
    expect((await on(store, 'm06').acceptPlanResponse({ responseId: chosen.id })).status).toBe(
      'accepted',
    );
    await expect(
      on(store, 'm06').acceptPlanResponse({ responseId: other.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect((await on(store, 'm06').getPlan({ planId: 'plan1' })).status).toBe('matched');
    expect((await on(store, 'm02').getPlan({ planId: 'plan1' })).myResponse?.status).toBe(
      'accepted',
    );
    expect((await on(store, 'm03').getPlan({ planId: 'plan1' })).myResponse?.status).toBe(
      'declined',
    );
    await expect(respond(store, 'm05')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await on(store, 'm02').getPost({ postId: 'p-plan1' })).plan?.status).toBe('matched');
  });

  it('accepts on a closed plan too, not on a cancelled one', async () => {
    const store = createMemoryStore();
    const first = await respond(store, 'm02');
    await on(store, 'm06').closePlan({ planId: 'plan1' });
    expect((await on(store, 'm06').acceptPlanResponse({ responseId: first.id })).status).toBe(
      'accepted',
    );

    const other = await respond(store, 'm02', 'plan2');
    await on(store, 'm03').cancelPlan({ planId: 'plan2' });
    await expect(
      on(store, 'm03').acceptPlanResponse({ responseId: other.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await on(store, 'm02').getPlan({ planId: 'plan2' })).myResponse?.status).toBe(
      'declined',
    );
  });

  it('declines without touching the others', async () => {
    const store = createMemoryStore();
    const one = await respond(store, 'm02');
    const two = await respond(store, 'm03');
    expect((await on(store, 'm06').declinePlanResponse({ responseId: one.id })).status).toBe(
      'declined',
    );
    expect((await on(store, 'm06').declinePlanResponse({ responseId: one.id })).status).toBe(
      'declined',
    );
    expect((await on(store, 'm06').getPlan({ planId: 'plan1' })).status).toBe('published');
    const list = await on(store, 'm06').listPlanResponses({ planId: 'plan1' });
    expect(list.items.map((r) => [r.id, r.status])).toEqual([
      [two.id, 'pending'],
      [one.id, 'declined'],
    ]);
  });
});

describe('listing Отклики on a plan', () => {
  it('shows the author waiting ones first, newest on top, page by page', async () => {
    const store = createMemoryStore();
    const ids: string[] = [];
    for (const [index, userId] of ['m02', 'm03', 'm04', 'm05'].entries()) {
      const later = new Date(new Date(SEED_NOW).getTime() + index * 60_000).toISOString();
      ids.push(
        (await on(store, userId, later).respondToPlan({ planId: 'plan1', idempotencyKey: key() }))
          .id,
      );
    }
    await on(store, 'm06').declinePlanResponse({ responseId: ids[3]! });

    const first = PlanResponsePage.parse(
      await on(store, 'm06').listPlanResponses({ planId: 'plan1', limit: 2 }),
    );
    expect(first.items.map((r) => r.id)).toEqual([ids[2], ids[1]]);
    const second = await on(store, 'm06').listPlanResponses({
      planId: 'plan1',
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.items.map((r) => r.id)).toEqual([ids[0], ids[3]]);
    expect(second.hasMore).toBe(false);
  });

  it('is for the author only', async () => {
    const store = createMemoryStore();
    await expect(on(store, 'm02').listPlanResponses({ planId: 'plan1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('Блокировка', () => {
  it('hides the plan from both sides and the Отклик from the author', async () => {
    const store = createMemoryStore();
    const sent = await respond(store, 'm02');
    await on(store, 'm06').setBlock({ target: { type: 'user', id: 'm02' }, active: true });

    await expect(on(store, 'm02').getPlan({ planId: 'plan1' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(respond(store, 'm02')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      on(store, 'm06').acceptPlanResponse({ responseId: sent.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await on(store, 'm06').listPlanResponses({ planId: 'plan1' })).items).toEqual([]);
    expect((await on(store, 'm06').getPlan({ planId: 'plan1' })).pendingResponses).toBe(0);
    expect((await on(store, 'm02').listMyResponses({})).items).toEqual([]);
  });
});

describe('«Мои планы» and «Мои отклики»', () => {
  const plan = (date: string, timeStart = '18:00'): CreatePlanInput => ({
    city: 'almaty',
    date,
    timeStart,
    format: 'coffee',
    durationMinutes: 60,
    goal: 'talk',
    paymentPolicy: 'each_pays',
    description: `План на ${date}`,
    place: 'Кофейня у парка',
    isPublicPlace: true,
    topics: [],
    idempotencyKey: key(),
  });

  it('lists own plans: upcoming nearest first, then the rest latest first', async () => {
    const store = createMemoryStore();
    const author = on(store, 'm01');
    const today = await author.createPlan(plan('2026-09-26', '18:00'));
    const later = await author.createPlan(plan('2026-10-02'));
    const soon = await author.createPlan(plan('2026-09-28'));
    await on(store, 'm01').cancelPlan({ planId: later.id });

    // 2026-09-26 19:00 in Almaty: today's plan has started.
    const reader = on(store, 'm01', '2026-09-26T14:00:00Z');
    const first = PlanPage.parse(await reader.listMyPlans({ limit: 2 }));
    expect(first.items.map((p) => [p.id, p.status])).toEqual([
      [soon.id, 'published'],
      [later.id, 'cancelled'],
    ]);
    const second = await on(store, 'm01', '2026-09-26T14:00:00Z').listMyPlans({
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.items.map((p) => [p.id, p.status])).toEqual([[today.id, 'past']]);
    expect(first.items[0]?.pendingResponses).toBe(0);
  });

  it('lists own standing Отклики with their plans, newest first', async () => {
    const store = createMemoryStore();
    await respond(store, 'm02', 'plan1');
    const later = new Date(new Date(SEED_NOW).getTime() + 60_000).toISOString();
    const second = await on(store, 'm02', later).respondToPlan({
      planId: 'plan2',
      idempotencyKey: key(),
    });
    const gone = await respond(store, 'm02', 'plan3');
    await on(store, 'm02').withdrawPlanResponse({ responseId: gone.id });

    const page = MyResponsePage.parse(await on(store, 'm02').listMyResponses({}));
    expect(page.items.map((i) => [i.response.id, i.plan.id])).toEqual([
      [second.id, 'plan2'],
      [expect.any(String), 'plan1'],
    ]);
    expect(page.items[0]?.plan.myResponse?.status).toBe('pending');
    expect(page.items[0]?.plan.place).toBeTruthy();
  });

  it('is for members, expired ones too', async () => {
    await expect(on(createMemoryStore()).listMyPlans({})).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const expired = on(createMemoryStore(), 'm06');
    await expired.expireMembership();
    expect((await expired.listMyPlans({})).items.map((p) => p.id)).toEqual(['plan1']);
    expect((await expired.listMyResponses({})).items).toEqual([]);
  });
});

describe('persistence', () => {
  it('Отклики and decisions survive a restart', async () => {
    const store = createMemoryStore();
    const sent = await respond(store, 'm02');
    await on(store, 'm06').acceptPlanResponse({ responseId: sent.id });
    const after = on(store, 'm02');
    expect((await after.getPlan({ planId: 'plan1' })).myResponse).toEqual({
      id: sent.id,
      status: 'accepted',
    });
  });
});
