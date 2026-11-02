import { describe, expect, it } from 'vitest';

import { fixedClock, SEED_NOW } from '@/clock';
import { LIMITS, type Session } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';

const member = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});
const moderator: Session = { ...member('m05'), roles: ['member', 'moderator'] };

type Store = ReturnType<typeof createMemoryStore>;
const on = (store: Store, session?: Session, now = SEED_NOW) =>
  createMockRepository({ clock: fixedClock(now), latency: 0, store, session });

const DAY = 24 * 60 * 60 * 1000;
const later = (days: number) => new Date(new Date(SEED_NOW).getTime() + days * DAY).toISOString();

let keyCounter = 0;
const key = () => `restriction-key-${(keyCounter += 1).toString().padStart(4, '0')}`;

async function restrict(store: Store, term: 'days_7' | 'days_30' | 'permanent' = 'days_7') {
  await on(store, moderator).moderateMember({
    memberId: 'm01',
    decision: 'restrict',
    reason: 'spam',
    term,
  });
}

describe('Ограничение', () => {
  it('has a reason and a term, and ends by itself once the term is over', async () => {
    const store = createMemoryStore();
    await restrict(store);
    const now = on(store, member('m01'));
    expect((await now.getSession()).accessState).toBe('BLOCKED');
    expect(await now.getMyRestriction()).toMatchObject({
      reason: 'spam',
      term: 'days_7',
      decidedAt: new Date(SEED_NOW).toISOString(),
      endsAt: later(7),
      canAppeal: true,
    });

    const after = on(store, member('m01'), later(8));
    expect((await after.getSession()).accessState).toBe('ACTIVE_MEMBER');
    expect(await after.getMyRestriction()).toBeNull();
    // Others see the member again.
    await expect(
      on(store, member('m09'), later(8)).getProfile({ memberId: 'm01' }),
    ).resolves.toBeTruthy();
  });

  it('until lifted does not end; «Продлить» never lifts it', async () => {
    const store = createMemoryStore();
    await restrict(store, 'permanent');
    const much = on(store, member('m01'), later(100));
    expect((await much.getSession()).accessState).toBe('BLOCKED');
    expect((await much.getMyRestriction())?.endsAt).toBeUndefined();
    await much
      .renewMembership({ selection: { tier: 'paid', periodMonths: 1 }, idempotencyKey: key() })
      .catch(() => undefined);
    expect((await much.getSession()).accessState).toBe('BLOCKED');
  });

  it('from a report needs a term and takes the report’s reason', async () => {
    const store = createMemoryStore();
    const mod = on(store, moderator);
    await expect(
      mod.resolveReport({ reportId: 'report4', resolution: 'member_restricted' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const decided = await mod.resolveReport({
      reportId: 'report4',
      resolution: 'member_restricted',
      term: 'days_30',
    });
    expect(decided.subject?.restricted).toBe(true);
  });

  it('is not what removing content does', async () => {
    const store = createMemoryStore();
    const decided = await on(store, moderator).resolveReport({
      reportId: 'report5',
      resolution: 'content_removed',
    });
    expect(decided.subject?.restricted).toBe(false);
  });
});

describe('a reported message', () => {
  it('shows its author and text to moderation and is removed for both', async () => {
    const store = createMemoryStore();
    const receipt = await on(store, member('m01')).createReport({
      target: { type: 'message', id: 'chat1-m25' },
      reason: 'harassment',
      idempotencyKey: key(),
    });
    const mod = on(store, moderator);
    const queued = (await mod.listReports({ status: 'created' })).items.find(
      (i) => i.report.id === receipt.report.id,
    );
    expect(queued?.subject).toMatchObject({ person: { id: 'm09' } });
    expect(queued?.subject?.text).toBeTruthy();

    await mod.resolveReport({ reportId: receipt.report.id, resolution: 'content_removed' });
    for (const who of ['m01', 'm09']) {
      const messages = await on(store, member(who)).listMessages({ chatId: 'chat1', limit: 100 });
      expect(messages.items.map((m) => m.id)).not.toContain('chat1-m25');
    }
    // And the author is not restricted by it.
    expect((await on(store, member('m09')).getSession()).accessState).toBe('ACTIVE_MEMBER');
  });
});

describe('Апелляция', () => {
  it('is one per decision; «Оставить в силе» keeps the Ограничение', async () => {
    const store = createMemoryStore();
    await restrict(store, 'days_30');
    const me = on(store, member('m01'));
    const first = await me.createAppeal({ text: 'Это ошибка.', idempotencyKey: key() });
    expect(first.status).toBe('pending');
    const second = await me.createAppeal({ text: 'Ещё раз.', idempotencyKey: key() });
    expect(second.id).toBe(first.id);
    expect((await me.getMyRestriction())?.canAppeal).toBe(false);

    const mod = on(store, moderator);
    const waiting = await mod.listAppeals({ status: 'pending' });
    expect(waiting.items.map((i) => i.appeal.id)).toEqual([first.id]);
    expect(waiting.items[0]).toMatchObject({
      person: { id: 'm01' },
      restriction: { reason: 'spam', term: 'days_30' },
    });
    await mod.decideAppeal({ appealId: first.id, decision: 'uphold' });
    await expect(mod.decideAppeal({ appealId: first.id, decision: 'lift' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    const meNow = on(store, member('m01'));
    expect((await meNow.getSession()).accessState).toBe('BLOCKED');
    expect(await meNow.getMyRestriction()).toMatchObject({
      appeal: { id: first.id, status: 'upheld' },
      canAppeal: false,
    });
    expect((await meNow.createAppeal({ text: 'Снова', idempotencyKey: key() })).id).toBe(first.id);
    expect((await on(store, moderator).listAppeals({ status: 'pending' })).items).toEqual([]);
  });

  it('«Снять ограничение» returns the member', async () => {
    const store = createMemoryStore();
    await restrict(store, 'permanent');
    const appeal = await on(store, member('m01')).createAppeal({
      text: 'Прошу пересмотреть.',
      idempotencyKey: key(),
    });
    await on(store, moderator).decideAppeal({ appealId: appeal.id, decision: 'lift' });
    expect((await on(store, member('m01')).getSession()).accessState).toBe('ACTIVE_MEMBER');
  });

  it('is sent within 7 calendar days only', async () => {
    const store = createMemoryStore();
    await restrict(store, 'permanent');
    const late = on(store, member('m01'), later(8));
    expect((await late.getMyRestriction())?.canAppeal).toBe(false);
    await expect(
      late.createAppeal({ text: 'Поздно', idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const inTime = on(store, member('m01'), later(7));
    expect((await inTime.getMyRestriction())?.canAppeal).toBe(true);
  });

  it('needs an Ограничение, and its queue is for moderators', async () => {
    const store = createMemoryStore();
    await expect(
      on(store, member('m01')).createAppeal({ text: 'Нечего', idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(on(store, member('m01')).listAppeals({})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await restrict(store);
    await expect(
      on(store, member('m01')).createAppeal({ text: '', idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('Обращение в поддержку', () => {
  it('is received once per key and listed in «Мои обращения»', async () => {
    const store = createMemoryStore();
    const me = on(store, member('m01'));
    const k = key();
    const first = await me.createSupportRequest({
      topic: 'account',
      text: 'Вопрос',
      idempotencyKey: k,
    });
    const again = await me.createSupportRequest({
      topic: 'account',
      text: 'Вопрос',
      idempotencyKey: k,
    });
    expect(again.id).toBe(first.id);
    expect(first.status).toBe('received');
    expect((await me.listMySupportRequests({})).items.map((r) => r.id)).toEqual([first.id]);
    expect((await on(store, member('m09')).listMySupportRequests({})).items).toEqual([]);
  });

  it('is open to the restricted, not to a guest without an identity, and has a limit', async () => {
    const store = createMemoryStore();
    await restrict(store);
    await expect(
      on(store, member('m01')).createSupportRequest({
        topic: 'restriction',
        text: 'Почему?',
        idempotencyKey: key(),
      }),
    ).resolves.toMatchObject({ topic: 'restriction' });
    await expect(
      on(store).createSupportRequest({ topic: 'other', text: 'Привет', idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(
      on(store, member('m09')).createSupportRequest({
        topic: 'other',
        text: 'а'.repeat(LIMITS.supportText + 1),
        idempotencyKey: key(),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
