import { describe, expect, it } from 'vitest';
import { sampleAnswers } from '@/repository/mock/testAnswers';

import { emptyFeedFilters } from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createSettingsStore } from './store';

describe('settings store', () => {
  it('defaults to following the system theme', async () => {
    const { useSettings, hydrate } = createSettingsStore(createMemoryStore());
    await hydrate();
    expect(useSettings.getState()).toMatchObject({ themePreference: 'system', hydrated: true });
  });

  it('persists the theme choice across restarts', async () => {
    const store = createMemoryStore();
    const first = createSettingsStore(store);
    await first.hydrate();
    first.useSettings.getState().setThemePreference('dark');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = createSettingsStore(store);
    await second.hydrate();
    expect(second.useSettings.getState().themePreference).toBe('dark');
  });

  it('falls back to defaults when stored settings are unreadable', async () => {
    const store = createMemoryStore({
      [storageKeys.settings]: JSON.stringify({ version: 1, data: { themePreference: 'neon' } }),
    });
    const { useSettings, hydrate } = createSettingsStore(store);
    await hydrate();
    expect(useSettings.getState().themePreference).toBe('system');
  });
});

describe('Ленты on the device', () => {
  it('share one content type between «Поиск» and «Мои подписки» and keep it across restarts', async () => {
    const store = createMemoryStore();
    const first = createSettingsStore(store);
    await first.hydrate();
    first.useSettings.getState().setFeedContent('popular', 'plans');
    first.useSettings.getState().setFeedContent('following', 'posts');
    first.useSettings.getState().setGuestFilters({ ...emptyFeedFilters(), city: ['710000000'] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = createSettingsStore(store);
    await second.hydrate();
    expect(second.useSettings.getState().feedContent).toEqual({ feeds: 'posts', popular: 'plans' });
    expect(second.useSettings.getState().guestFilters?.city).toEqual(['710000000']);
  });

  it('upgrades v1 settings without losing the theme', async () => {
    const store = createMemoryStore({
      [storageKeys.settings]: JSON.stringify({ version: 1, data: { themePreference: 'dark' } }),
    });
    const { useSettings, hydrate } = createSettingsStore(store);
    await hydrate();
    expect(useSettings.getState()).toMatchObject({
      themePreference: 'dark',
      feedContent: { feeds: 'all', popular: 'all' },
      guestFilters: null,
    });
  });

  it('upgrades v3: «Для тебя» gives the shared content type, the filter keeps city and Намерения', async () => {
    const store = createMemoryStore({
      [storageKeys.settings]: JSON.stringify({
        version: 3,
        data: {
          themePreference: 'light',
          feedContent: { for_you: 'plans', popular: 'posts', following: 'all' },
          guestFilters: { ...sampleAnswers, city: ['750000000'] },
        },
      }),
    });
    const { useSettings, hydrate } = createSettingsStore(store);
    await hydrate();
    expect(useSettings.getState()).toMatchObject({
      themePreference: 'light',
      feedContent: { feeds: 'plans', popular: 'posts' },
      guestFilters: {
        ...emptyFeedFilters(),
        city: ['750000000'],
        intent: ['serious_relationship'],
      },
    });
  });
});
