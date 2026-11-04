import { z } from 'zod';
import { create } from 'zustand';

import { FeedContent, FeedFilters, type FeedTab } from '@/contracts';
import { createSlot, storageKeys, type KeyValueStore } from '@/storage';
import type { ThemePreference } from '@/ui/theme/scheme';

const Settings = z.strictObject({
  themePreference: z.enum(['system', 'light', 'dark']),
  /** What each Лента shows: «Все», «Посты» or «Планы встреч». */
  feedContent: z.strictObject({
    for_you: FeedContent,
    popular: FeedContent,
    following: FeedContent,
  }),
  /** A guest's Фильтры ленты; a member's are kept with their account. */
  guestFilters: FeedFilters.nullable(),
});
type Settings = z.infer<typeof Settings>;

const defaults = (): Settings => ({
  themePreference: 'system',
  feedContent: { for_you: 'all', popular: 'all', following: 'all' },
  guestFilters: null,
});

type SettingsState = Settings & {
  hydrated: boolean;
  setThemePreference(preference: ThemePreference): void;
  setFeedContent(tab: FeedTab, content: FeedContent): void;
  setGuestFilters(filters: FeedFilters | null): void;
};

/**
 * Client-side preferences (not backend data). Persisted through the same versioned
 * storage slot as everything else, so migrations and controlled resets behave alike.
 */
export function createSettingsStore(store: KeyValueStore) {
  const slot = createSlot({
    store,
    key: storageKeys.settings,
    schema: Settings,
    version: 3,
    // v2 adds the content type of each Лента and a guest's Фильтры ленты.
    // v3: Фильтры ленты name settlements by KATO code; older ones start over.
    migrations: [
      (v1: unknown) => ({
        ...(v1 as object),
        feedContent: defaults().feedContent,
        guestFilters: null,
      }),
      (v2: unknown) => ({ ...(v2 as object), guestFilters: null }),
    ],
    defaults,
  });

  const useSettings = create<SettingsState>((set, get) => {
    const persist = () => {
      const { themePreference, feedContent, guestFilters } = get();
      void slot.save({ themePreference, feedContent, guestFilters });
    };
    return {
      ...defaults(),
      hydrated: false,
      setThemePreference(themePreference) {
        set({ themePreference });
        persist();
      },
      setFeedContent(tab, content) {
        set({ feedContent: { ...get().feedContent, [tab]: content } });
        persist();
      },
      setGuestFilters(guestFilters) {
        set({ guestFilters });
        persist();
      },
    };
  });

  const hydrate = async () => {
    const { data } = await slot.load();
    useSettings.setState({ ...data, hydrated: true });
  };

  return { useSettings, hydrate };
}
