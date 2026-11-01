import { describe, expect, it } from 'vitest';

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
  it('keep the content type of each Лента and a guest’s filters across restarts', async () => {
    const store = createMemoryStore();
    const first = createSettingsStore(store);
    await first.hydrate();
    first.useSettings.getState().setFeedContent('popular', 'plans');
    first.useSettings.getState().setGuestFilters({
      city: ['astana'],
      intent: [],
      communication: [],
      pace: [],
      firstMeeting: [],
      boundaries: [],
      dateFormat: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = createSettingsStore(store);
    await second.hydrate();
    expect(second.useSettings.getState().feedContent).toEqual({
      for_you: 'all',
      popular: 'plans',
      following: 'all',
    });
    expect(second.useSettings.getState().guestFilters?.city).toEqual(['astana']);
  });

  it('upgrades v1 settings without losing the theme', async () => {
    const store = createMemoryStore({
      [storageKeys.settings]: JSON.stringify({ version: 1, data: { themePreference: 'dark' } }),
    });
    const { useSettings, hydrate } = createSettingsStore(store);
    await hydrate();
    expect(useSettings.getState()).toMatchObject({
      themePreference: 'dark',
      feedContent: { for_you: 'all', popular: 'all', following: 'all' },
      guestFilters: null,
    });
  });
});
