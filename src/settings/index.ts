import { asyncStorageStore } from '@/storage/asyncStorage';

import { createSettingsStore } from './store';

const settings = createSettingsStore(asyncStorageStore);

export const useSettings = settings.useSettings;
export const hydrateSettings = settings.hydrate;
