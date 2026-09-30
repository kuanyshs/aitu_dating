/** Minimal async key-value store; AsyncStorage on devices and web, memory in tests. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Versioned storage keys of the demo app. Bump the suffix only for a breaking layout change. */
export const storageKeys = {
  state: 'aitu.demo.state.v1',
  session: 'aitu.demo.session.v1',
  drafts: 'aitu.demo.drafts.v1',
  settings: 'aitu.demo.settings.v1',
  clock: 'aitu.demo.clock.v1',
} as const;
