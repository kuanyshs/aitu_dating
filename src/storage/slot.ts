import type { z } from 'zod';

import type { KeyValueStore } from './types';

/** Upgrades data written by `version - 1` to `version`. Index 0 migrates v1 to v2, and so on. */
export type Migration = (data: unknown) => unknown;

export type SlotOptions<T> = {
  store: KeyValueStore;
  key: string;
  schema: z.ZodType<T>;
  /** Current layout version; stored data from older versions runs through `migrations`. */
  version: number;
  migrations?: Migration[];
  defaults: () => T;
};

export type LoadResult<T> = {
  data: T;
  /** Set when stored data could not be read or migrated and was replaced by defaults. */
  reset?: 'corrupt' | 'unsupported_version' | 'invalid';
};

type Envelope = { version: number; data: unknown };

/**
 * One persisted value with a schema, a version and a migration chain. Anything that
 * cannot be migrated or fails validation is replaced by defaults (a controlled reset)
 * instead of crashing the app, and the caller learns why.
 */
export function createSlot<T>(options: SlotOptions<T>) {
  const { store, key, schema, version, migrations = [], defaults } = options;

  async function resetTo(reason: NonNullable<LoadResult<T>['reset']>): Promise<LoadResult<T>> {
    await store.removeItem(key);
    return { data: defaults(), reset: reason };
  }

  return {
    key,

    async load(): Promise<LoadResult<T>> {
      const raw = await store.getItem(key);
      if (raw === null) return { data: defaults() };

      let envelope: Envelope;
      try {
        envelope = JSON.parse(raw) as Envelope;
      } catch {
        return resetTo('corrupt');
      }
      if (typeof envelope?.version !== 'number' || !('data' in envelope)) return resetTo('corrupt');
      if (envelope.version > version || envelope.version < 1) return resetTo('unsupported_version');

      let data = envelope.data;
      for (let v = envelope.version; v < version; v += 1) {
        const migrate = migrations[v - 1];
        if (!migrate) return resetTo('unsupported_version');
        try {
          data = migrate(data);
        } catch {
          return resetTo('invalid');
        }
      }

      const parsed = schema.safeParse(data);
      if (!parsed.success) return resetTo('invalid');
      if (envelope.version !== version) await this.save(parsed.data);
      return { data: parsed.data };
    },

    async save(data: T): Promise<void> {
      const envelope: Envelope = { version, data: schema.parse(data) };
      await store.setItem(key, JSON.stringify(envelope));
    },

    async clear(): Promise<void> {
      await store.removeItem(key);
    },
  };
}

export type Slot<T> = ReturnType<typeof createSlot<T>>;
