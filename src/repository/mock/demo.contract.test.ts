import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository } from './createMockRepository';

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
    expect(JSON.parse(snapshot[storageKeys.state] ?? '{}')).toMatchObject({ version: 1 });
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
