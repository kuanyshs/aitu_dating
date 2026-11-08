import { z } from 'zod';
import { create } from 'zustand';

import {
  FeedContent,
  FeedFilters,
  fromLegacyFeedFilters,
  keepKnownFeedFilters,
  type FeedTab,
} from '@/contracts';
import { createSlot, storageKeys, type KeyValueStore } from '@/storage';
import type { ThemePreference } from '@/ui/theme/scheme';

const Settings = z.strictObject({
  themePreference: z.enum(['system', 'light', 'dark']),
  /** What a Лента shows: one choice for «Поиск» and «Мои подписки», one for «Популярное». */
  feedContent: z.strictObject({ feeds: FeedContent, popular: FeedContent }),
  /** A guest's filter; a member's is kept with their account. */
  guestFilters: FeedFilters.nullable(),
});
type Settings = z.infer<typeof Settings>;

const defaults = (): Settings => ({
  themePreference: 'system',
  feedContent: { feeds: 'all', popular: 'all' },
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
    version: 5,
    // v2 adds the content type of each Лента and a guest's Фильтры ленты.
    // v3: Фильтры ленты name settlements by KATO code; older ones start over.
    migrations: [
      (v1: unknown) => ({
        ...(v1 as object),
        feedContent: defaults().feedContent,
        guestFilters: null,
      }),
      (v2: unknown) => ({ ...(v2 as object), guestFilters: null }),
      // v4: one filter and one content type for «Поиск» and «Мои подписки».
      (v3: unknown) => {
        const old = v3 as {
          feedContent?: { for_you?: unknown; popular?: unknown };
          guestFilters?: unknown;
        };
        const content = (value: unknown) => FeedContent.catch('all').parse(value);
        return {
          ...old,
          feedContent: {
            feeds: content(old.feedContent?.for_you),
            popular: content(old.feedContent?.popular),
          },
          guestFilters: old.guestFilters ? fromLegacyFeedFilters(old.guestFilters) : null,
        };
      },
      // v5: the Анкета's catalogs changed; the filter keeps what they still know.
      (v4: unknown) => {
        const old = v4 as { guestFilters?: unknown };
        return {
          ...old,
          guestFilters: old.guestFilters ? keepKnownFeedFilters(old.guestFilters) : null,
        };
      },
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
        const key = tab === 'popular' ? 'popular' : 'feeds';
        set({ feedContent: { ...get().feedContent, [key]: content } });
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
