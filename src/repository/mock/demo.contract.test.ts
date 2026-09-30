import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { anchoredClock, fixedClock, SEED_NOW } from '@/clock';
import type { Session } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { MOCK_STATE_VERSION } from './demo';

const clock = fixedClock();

function repositoryOn(store = createMemoryStore()) {
  return { store, repo: createMockRepository({ clock, latency: 0, store }) };
}

describe('persistence', () => {
  it('keeps demo flags across restarts', async () => {
    const { store, repo } = repositoryOn();
    await repo.setDemoFlags({ offline: true });

    const restarted = createMockRepository({ clock, latency: 0, store });
    expect(await restarted.getDemoFlags()).toMatchObject({ offline: true });
  });

  it('writes versioned keys', async () => {
    const { store, repo } = repositoryOn();
    await repo.setDemoFlags({ networkErrorOnce: true });
    const snapshot = store.snapshot();
    expect(JSON.parse(snapshot[storageKeys.state] ?? '{}')).toMatchObject({
      version: MOCK_STATE_VERSION,
    });
  });

  it('migrates v1 state (demo flags only) without losing the flags', async () => {
    const v1 = {
      version: 1,
      data: { demoFlags: { networkErrorOnce: false, offline: true, failedMessageOnce: false } },
    };
    const store = createMemoryStore({ [storageKeys.state]: JSON.stringify(v1) });
    const repo = createMockRepository({ clock, latency: 0, store });
    expect(await repo.getDemoFlags()).toMatchObject({ offline: true });
    expect(await repo.getAccessFlow()).toBeNull();
    expect(await repo.takeResetNotice()).toBeUndefined();
  });

  it('resets unreadable stored state and reports it once', async () => {
    const store = createMemoryStore({ [storageKeys.state]: '{broken' });
    const repo = createMockRepository({ clock, latency: 0, store });
    expect(await repo.getSession()).toEqual({ accessState: 'GUEST_PREVIEW', roles: [] });
    expect(await repo.takeResetNotice()).toBe('corrupt');
    expect(await repo.takeResetNotice()).toBeUndefined();
    expect(await repo.getDemoFlags()).toEqual({
      networkErrorOnce: false,
      offline: false,
      failedMessageOnce: false,
    });
  });

  it('does not report a reset on a clean start', async () => {
    const { repo } = repositoryOn();
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});

describe('demo failure flags', () => {
  it('fails exactly the next data request with NETWORK_ERROR', async () => {
    const { repo } = repositoryOn();
    await repo.setDemoFlags({ networkErrorOnce: true });

    await expect(repo.getHomeFeed({ tab: 'for_you' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    await expect(repo.getHomeFeed({ tab: 'for_you' })).resolves.toMatchObject({
      hasMore: true,
    });
    expect((await repo.getDemoFlags()).networkErrorOnce).toBe(false);
  });

  it('does not spend the one-off error on the local session read', async () => {
    const { repo } = repositoryOn();
    await repo.setDemoFlags({ networkErrorOnce: true });
    await expect(repo.getSession()).resolves.toMatchObject({ accessState: 'GUEST_PREVIEW' });
    await expect(repo.getHomeFeed({ tab: 'for_you' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('fails every data request while offline and recovers when switched off', async () => {
    const { repo } = repositoryOn();
    await repo.setDemoFlags({ offline: true });
    for (let i = 0; i < 3; i += 1) {
      await expect(repo.getHomeFeed({ tab: 'popular' })).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    }
    await repo.setDemoFlags({ offline: false });
    await expect(repo.getHomeFeed({ tab: 'popular' })).resolves.toBeTruthy();
  });
});

describe('resetDemo', () => {
  it('returns to a guest preview with pristine flags and clears stored state', async () => {
    const { store, repo } = repositoryOn();
    await repo.setDemoFlags({ offline: true, failedMessageOnce: true });

    await repo.resetDemo();

    expect(await repo.getSession()).toEqual({ accessState: 'GUEST_PREVIEW', roles: [] });
    expect(await repo.getDemoFlags()).toEqual({
      networkErrorOnce: false,
      offline: false,
      failedMessageOnce: false,
    });
    expect(store.snapshot()[storageKeys.state]).toBeUndefined();
    expect(store.snapshot()[storageKeys.session]).toBeUndefined();
  });
});

describe('demo clock', () => {
  const member: Session = { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm01' };
  const start = new Date('2030-01-01T00:00:00Z');
  const load = (store: ReturnType<typeof createMemoryStore>) => {
    const demoClock = anchoredClock();
    return {
      demoClock,
      repo: createMockRepository({ clock: demoClock, latency: 0, store, session: member }),
    };
  };
  const post = (repo: ReturnType<typeof load>['repo'], key: string) =>
    repo.createPost({ type: 'post', text: 'Запись для порядка', topics: [], idempotencyKey: key });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start);
  });
  afterEach(() => vi.useRealTimers());

  it('goes on after a reload, so later records stay later', async () => {
    const store = createMemoryStore();
    const before = load(store);
    vi.advanceTimersByTime(60 * 60 * 1000);
    const first = await post(before.repo, 'clock-key-1');

    // A reload: a new clock starts from the seed time again, then resumes.
    vi.setSystemTime(start);
    const after = load(store);
    const second = await post(after.repo, 'clock-key-2');
    expect(new Date(second.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.createdAt).getTime(),
    );
    expect(after.demoClock.now().getTime()).toBeGreaterThan(new Date(SEED_NOW).getTime());
  });

  it('goes back to the seed time with «Сбросить демо»', async () => {
    const store = createMemoryStore();
    const { demoClock, repo } = load(store);
    vi.advanceTimersByTime(60 * 60 * 1000);
    await post(repo, 'clock-key-3');
    await repo.resetDemo();
    expect(demoClock.now().toISOString()).toBe(new Date(SEED_NOW).toISOString());
    expect(store.snapshot()[storageKeys.clock]).toBeUndefined();

    const reloaded = load(store);
    await reloaded.repo.getSession();
    expect(reloaded.demoClock.now().toISOString()).toBe(new Date(SEED_NOW).toISOString());
  });
});
