import { describe, expect, it } from 'vitest';

import { fixedClock, SEED_NOW } from '@/clock';
import { PlanView, type CreatePlanInput, type Session } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { defaultMockState, MOCK_STATE_VERSION } from './demo';

// The seed clock is 2026-09-26 17:00 in Almaty. plan1 (m06) starts 2026-09-27 11:00,
// plan4 (m09) is a Встреча.

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function on(store = createMemoryStore(), session?: Session, now: string = SEED_NOW) {
  return createMockRepository({ clock: fixedClock(now), latency: 0, store, session });
}

let keyCounter = 0;
const plan = (patch: Partial<CreatePlanInput> = {}): CreatePlanInput => ({
  city: 'almaty',
  date: '2026-09-30',
  timeStart: '18:00',
  format: 'coffee',
  durationMinutes: 60,
  goal: 'talk',
  paymentPolicy: 'each_pays',
  description: 'Кофе и спокойный разговор после работы.',
  place: 'Кофейня у парка',
  isPublicPlace: true,
  topics: ['meetings', 'meetings', 'city'],
  idempotencyKey: `plan-key-${(keyCounter += 1).toString().padStart(4, '0')}`,
  ...patch,
});

describe('creating a plan', () => {
  it('publishes the plan and its post, the place for members only', async () => {
    const store = createMemoryStore();
    const created = PlanView.parse(await on(store, as('m01')).createPlan(plan()));
    expect(created).toMatchObject({
      status: 'published',
      city: 'almaty',
      date: '2026-09-30',
      timeStart: '18:00',
      place: 'Кофейня у парка',
      isPublicPlace: true,
      pendingResponses: 0,
    });
    expect(created.author).toMatchObject({ view: 'member', id: 'm01' });

    const post = await on(store, as('m02')).getPost({ postId: created.postId });
    expect(post).toMatchObject({
      type: 'plan',
      text: 'Кофе и спокойный разговор после работы.',
      topics: ['meetings', 'city'],
      plan: { id: created.id, status: 'published' },
    });
    const feed = await on(store, as('m02')).getHomeFeed({ tab: 'plans', limit: 50 });
    expect(feed.items.map((p) => p.id)).toContain(created.postId);

    const other = await on(store, as('m02')).getPlan({ planId: created.id });
    expect(other.place).toBe('Кофейня у парка');
    expect(other.pendingResponses).toBeUndefined();
    const guest = await on(store).getPlan({ planId: created.id });
    expect(guest.place).toBeUndefined();
    expect(guest.author.view).toBe('safe');
  });

  it('publishes once for a retried request', async () => {
    const store = createMemoryStore();
    const input = plan();
    const first = await on(store, as('m01')).createPlan(input);
    const again = await on(store, as('m01')).createPlan(input);
    expect(again.id).toBe(first.id);
    const posts = await on(store, as('m02')).listProfilePosts({ memberId: 'm01', limit: 50 });
    expect(posts.items.filter((p) => p.type === 'plan')).toHaveLength(1);
  });

  it('needs a public place and a future start within 14 days', async () => {
    const repo = on(createMemoryStore(), as('m01'));
    const rejects = (input: unknown, field: string, reason?: string) =>
      expect(repo.createPlan(input as CreatePlanInput)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        fieldErrors: reason
          ? { [field]: reason }
          : expect.objectContaining({ [field]: expect.any(String) }),
      });
    await rejects({ ...plan(), isPublicPlace: false }, 'isPublicPlace');
    await rejects(plan({ place: '  ' }), 'place', 'required');
    await rejects(plan({ description: 'x'.repeat(501) }), 'description', 'too_long');
    await rejects(plan({ date: '2026-09-25' }), 'date', 'past');
    await rejects(plan({ date: '2026-09-26', timeStart: '16:30' }), 'timeStart', 'past');
    await rejects(plan({ date: '2026-10-10' }), 'date', 'too_far');
    // Later today and the last of the 14 days are fine.
    await expect(
      repo.createPlan(plan({ date: '2026-09-26', timeStart: '17:30' })),
    ).resolves.toMatchObject({ status: 'published' });
    await expect(repo.createPlan(plan({ date: '2026-10-09' }))).resolves.toMatchObject({
      status: 'published',
    });
  });

  it('holds at most 3 open future plans', async () => {
    const store = createMemoryStore();
    const author = on(store, as('m01'));
    const first = await author.createPlan(plan());
    await author.createPlan(plan());
    await author.createPlan(plan());
    await expect(author.createPlan(plan())).rejects.toMatchObject({ code: 'CONFLICT' });

    // A closed plan no longer counts.
    await author.closePlan({ planId: first.id });
    await expect(author.createPlan(plan())).resolves.toMatchObject({ status: 'published' });
  });

  it('does not count a past plan against the limit', async () => {
    const store = createMemoryStore();
    const author = on(store, as('m01'));
    await author.createPlan(plan({ date: '2026-09-26', timeStart: '18:00' }));
    await author.createPlan(plan());
    await author.createPlan(plan());
    // 2026-09-26 18:30 in Almaty: the first plan has started.
    const later = on(store, as('m01'), '2026-09-26T13:30:00Z');
    await expect(later.createPlan(plan())).resolves.toMatchObject({ status: 'published' });
  });

  it('is for active members only', async () => {
    await expect(on().createPlan(plan())).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const expired = on(createMemoryStore(), as('m01'));
    await expired.expireMembership();
    await expect(expired.createPlan(plan())).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
  });
});

describe('closing and cancelling', () => {
  it('lets only the author close the plan; the status shows everywhere', async () => {
    const store = createMemoryStore();
    await expect(on(store, as('m02')).closePlan({ planId: 'plan1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const closed = await on(store, as('m06')).closePlan({ planId: 'plan1' });
    expect(closed.status).toBe('closed');
    // Closing twice is a no-op.
    expect((await on(store, as('m06')).closePlan({ planId: 'plan1' })).status).toBe('closed');

    const reader = on(store, as('m02'));
    expect((await reader.getPlan({ planId: 'plan1' })).status).toBe('closed');
    expect((await reader.getPost({ postId: 'p-plan1' })).plan?.status).toBe('closed');
  });

  it('cancels from any status, a Встреча too, and cannot close a cancelled plan', async () => {
    const store = createMemoryStore();
    const cancelled = await on(store, as('m09')).cancelPlan({ planId: 'plan4' });
    expect(cancelled.status).toBe('cancelled');
    expect((await on(store, as('m09')).cancelPlan({ planId: 'plan4' })).status).toBe('cancelled');
    await expect(on(store, as('m09')).closePlan({ planId: 'plan4' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    const feed = await on(store, as('m02')).getHomeFeed({ tab: 'plans', limit: 50 });
    expect(feed.items.map((p) => p.id)).not.toContain('p-plan4');
  });

  it('declines waiting Отклики on cancelling, keeps them on closing', async () => {
    const response = (id: string, planId: string) => ({
      id,
      planId,
      authorId: 'm02',
      status: 'pending' as const,
      createdAt: SEED_NOW,
    });
    const store = createMemoryStore({
      [storageKeys.state]: JSON.stringify({
        version: MOCK_STATE_VERSION,
        data: {
          ...defaultMockState(),
          planResponses: [response('r1', 'plan1'), response('r2', 'plan2')],
        },
      }),
    });
    expect((await on(store, as('m06')).getPlan({ planId: 'plan1' })).pendingResponses).toBe(1);
    await on(store, as('m06')).closePlan({ planId: 'plan1' });
    expect((await on(store, as('m06')).getPlan({ planId: 'plan1' })).pendingResponses).toBe(1);

    await on(store, as('m06')).cancelPlan({ planId: 'plan1' });
    expect((await on(store, as('m06')).getPlan({ planId: 'plan1' })).pendingResponses).toBe(0);
    // Other plans keep their Отклики.
    expect((await on(store, as('m03')).getPlan({ planId: 'plan2' })).pendingResponses).toBe(1);
  });

  it('lets an expired author manage their plan', async () => {
    const store = createMemoryStore();
    const author = on(store, as('m06'));
    await author.expireMembership();
    expect((await author.closePlan({ planId: 'plan1' })).status).toBe('closed');
  });
});

describe('«Прошёл»', () => {
  // 2026-09-27 11:00 in Almaty: plan1 starts.
  const started = '2026-09-27T06:00:00Z';

  it('is computed from the clock and leaves the plans feed', async () => {
    const store = createMemoryStore();
    expect((await on(store, as('m02')).getPlan({ planId: 'plan1' })).status).toBe('published');
    const reader = on(store, as('m02'), started);
    expect((await reader.getPlan({ planId: 'plan1' })).status).toBe('past');
    expect((await reader.getPost({ postId: 'p-plan1' })).plan?.status).toBe('past');
    const feed = await reader.getHomeFeed({ tab: 'plans', limit: 50 });
    expect(feed.items.map((p) => p.id)).not.toContain('p-plan1');
  });

  it('applies to a closed plan too; a past plan is neither closed nor cancelled', async () => {
    const store = createMemoryStore();
    await on(store, as('m06')).closePlan({ planId: 'plan1' });
    const author = on(store, as('m06'), started);
    expect((await author.getPlan({ planId: 'plan1' })).status).toBe('past');
    await expect(author.closePlan({ planId: 'plan1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(author.cancelPlan({ planId: 'plan1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

describe('persistence', () => {
  it('plans and their statuses survive a restart', async () => {
    const store = createMemoryStore();
    const created = await on(store, as('m01')).createPlan(plan());
    await on(store, as('m06')).cancelPlan({ planId: 'plan1' });
    const after = on(store, as('m02'));
    expect((await after.getPlan({ planId: created.id })).status).toBe('published');
    expect((await after.getPlan({ planId: 'plan1' })).status).toBe('cancelled');
  });

  it('keeps v14 state without a reset', async () => {
    const {
      plans: _plans,
      planKeys: _keys,
      planUpdates: _updates,
      planResponses: _responses,
      ...v14
    } = defaultMockState();
    const store = createMemoryStore({
      [storageKeys.state]: JSON.stringify({ version: 14, data: v14 }),
    });
    const repo = on(store, as('m01'));
    await expect(repo.createPlan(plan())).resolves.toMatchObject({ status: 'published' });
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
