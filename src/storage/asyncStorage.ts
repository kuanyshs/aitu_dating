import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from './types';

/** Device store (AsyncStorage; localStorage on web). Only the app shell imports this. */
export const asyncStorageStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
