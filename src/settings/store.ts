import { z } from 'zod';
import { create } from 'zustand';

import { createSlot, storageKeys, type KeyValueStore } from '@/storage';
import type { ThemePreference } from '@/ui/theme/scheme';

const Settings = z.strictObject({
  themePreference: z.enum(['system', 'light', 'dark']),
});
type Settings = z.infer<typeof Settings>;

const defaults = (): Settings => ({ themePreference: 'system' });

type SettingsState = Settings & {
  hydrated: boolean;
  setThemePreference(preference: ThemePreference): void;
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
    version: 1,
    defaults,
  });

  const useSettings = create<SettingsState>((set, get) => ({
    ...defaults(),
    hydrated: false,
    setThemePreference(themePreference) {
      set({ themePreference });
      void slot.save({ themePreference: get().themePreference });
    },
  }));

  const hydrate = async () => {
    const { data } = await slot.load();
    useSettings.setState({ ...data, hydrated: true });
  };

  return { useSettings, hydrate };
}
