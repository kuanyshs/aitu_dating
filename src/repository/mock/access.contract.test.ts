import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { CLUB_RULES_VERSION, type AituRepository } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';

const clock = fixedClock();

function repositoryOn(store = createMemoryStore()) {
  return createMockRepository({ clock, latency: 0, store });
}

async function toMembershipStep(repo: AituRepository) {
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-1' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
}

describe('passport candidates', () => {
  it('lists the three mock identities from the gap-resolution document', async () => {
    const candidates = await repositoryOn().listPassportCandidates();
    expect(candidates.map((c) => [c.name, c.city, c.aituSubjectId])).toEqual([
      ['Айдана', 'almaty', 'aitu-subject-almaty-102'],
      ['Тимур', 'astana', 'aitu-subject-astana-207'],
      ['Мадина', 'karaganda', 'aitu-subject-karaganda-314'],
    ]);
  });
});

describe('access flow order', () => {
  it('has no flow before «Вступить» and starts at the Passport step', async () => {
    const repo = repositoryOn();
    expect(await repo.getAccessFlow()).toBeNull();
    expect(await repo.startAccess()).toEqual({ step: 'passport' });
    expect(await repo.startAccess()).toEqual({ step: 'passport' });
  });

  it('walks Passport → rules → membership → payment → profile for a paid period', async () => {
    const repo = repositoryOn();
    await repo.startAccess();
    const afterPassport = await repo.selectPassport({ candidateId: 'passport-2' });
    expect(afterPassport).toMatchObject({ step: 'rules', candidate: { name: 'Тимур' } });

    const afterRules = await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
    expect(afterRules).toMatchObject({
      step: 'membership',
      rulesAcceptedVersion: CLUB_RULES_VERSION,
    });

    const afterMembership = await repo.selectMembership({ tier: 'paid', periodMonths: 3 });
    expect(afterMembership).toMatchObject({
      step: 'payment',
      membership: { tier: 'paid', periodMonths: 3 },
    });
    expect(afterMembership.payment).toBeUndefined();

    const afterPayment = await repo.confirmPayment({ idempotencyKey: 'key-00000001' });
    expect(afterPayment).toMatchObject({ step: 'profile', payment: { amountKzt: 4990 } });
  });

  it('skips payment for free verified and records a zero receipt', async () => {
    const repo = repositoryOn();
    await toMembershipStep(repo);
    const flow = await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
    expect(flow).toMatchObject({
      step: 'profile',
      membership: { tier: 'free_verified', periodMonths: 12 },
      payment: { amountKzt: 0 },
    });
    await expect(repo.confirmPayment({ idempotencyKey: 'key-00000002' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it.each([
    [
      'rules before Passport',
      (r: AituRepository) => r.acceptRules({ rulesVersion: CLUB_RULES_VERSION }),
    ],
    [
      'membership before rules',
      (r: AituRepository) => r.selectMembership({ tier: 'paid', periodMonths: 1 }),
    ],
    [
      'payment before membership',
      (r: AituRepository) => r.confirmPayment({ idempotencyKey: 'key-00000003' }),
    ],
  ])('rejects %s with CONFLICT', async (_label, act) => {
    const repo = repositoryOn();
    await repo.startAccess();
    await expect(act(repo)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects selecting a Passport identity before starting', async () => {
    await expect(
      repositoryOn().selectPassport({ candidateId: 'passport-1' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('rejects an unknown candidate and outdated rules as validation errors', async () => {
    const repo = repositoryOn();
    await repo.startAccess();
    await expect(repo.selectPassport({ candidateId: 'nobody' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { candidateId: 'unknown' },
    });
    await repo.selectPassport({ candidateId: 'passport-1' });
    await expect(repo.acceptRules({ rulesVersion: 'clubRules.v0' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('allows exactly one period and only 12 months for free verified', async () => {
    const repo = repositoryOn();
    await toMembershipStep(repo);
    await expect(
      repo.selectMembership({ tier: 'free_verified', periodMonths: 3 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      repo.selectMembership({ tier: 'paid', periodMonths: 2 as never }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await repo.selectMembership({ tier: 'paid', periodMonths: 1 });
    const changed = await repo.selectMembership({ tier: 'paid', periodMonths: 6 });
    expect(changed.membership).toEqual({ tier: 'paid', periodMonths: 6 });
  });

  it('restarts dependent steps when another identity is chosen', async () => {
    const repo = repositoryOn();
    await toMembershipStep(repo);
    const flow = await repo.selectPassport({ candidateId: 'passport-3' });
    expect(flow).toEqual({ step: 'rules', candidate: expect.objectContaining({ name: 'Мадина' }) });
  });

  it('locks identity and plan once membership is confirmed', async () => {
    const repo = repositoryOn();
    await toMembershipStep(repo);
    await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
    await expect(repo.selectPassport({ candidateId: 'passport-2' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(repo.selectMembership({ tier: 'paid', periodMonths: 1 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

describe('mock payment', () => {
  it('does not charge twice for a retried request with the same key', async () => {
    const repo = repositoryOn();
    await toMembershipStep(repo);
    await repo.selectMembership({ tier: 'paid', periodMonths: 12 });
    const first = await repo.confirmPayment({ idempotencyKey: 'key-retry-001' });
    const second = await repo.confirmPayment({ idempotencyKey: 'key-retry-001' });
    expect(second).toEqual(first);
    expect(first.payment).toMatchObject({ amountKzt: 14990 });
  });

  it('fails with NETWORK_ERROR under the demo flag and succeeds on retry', async () => {
    const repo = repositoryOn();
    await toMembershipStep(repo);
    await repo.selectMembership({ tier: 'paid', periodMonths: 1 });
    await repo.setDemoFlags({ networkErrorOnce: true });
    await expect(repo.confirmPayment({ idempotencyKey: 'key-net-0001' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect((await repo.getAccessFlow())?.step).toBe('payment');
    await expect(repo.confirmPayment({ idempotencyKey: 'key-net-0001' })).resolves.toMatchObject({
      step: 'profile',
    });
  });

  it('requires an idempotency key', async () => {
    const repo = repositoryOn();
    await expect(repo.confirmPayment({ idempotencyKey: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('resume', () => {
  it('continues from the saved step with the same candidate after a restart', async () => {
    const store = createMemoryStore();
    const first = repositoryOn(store);
    await toMembershipStep(first);

    const restarted = repositoryOn(store);
    expect(await restarted.getAccessFlow()).toMatchObject({
      step: 'membership',
      candidate: { name: 'Айдана' },
    });
    expect(await restarted.startAccess()).toMatchObject({ step: 'membership' });
  });

  it('leaves the visitor a guest until the card is published', async () => {
    const repo = repositoryOn();
    await toMembershipStep(repo);
    await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
    expect((await repo.getSession()).accessState).toBe('GUEST_PREVIEW');
  });

  it('forgets the flow on demo reset', async () => {
    const repo = repositoryOn();
    await toMembershipStep(repo);
    await repo.resetDemo();
    expect(await repo.getAccessFlow()).toBeNull();
  });
});
