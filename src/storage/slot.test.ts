import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createMemoryStore } from './memoryStore';
import { createSlot } from './slot';

const V2 = z.strictObject({ theme: z.enum(['system', 'light', 'dark']), density: z.number() });

function slotOn(store: ReturnType<typeof createMemoryStore>) {
  return createSlot({
    store,
    key: 'test.settings',
    schema: V2,
    version: 2,
    // v1 stored { dark: boolean }; v2 renamed it to theme and added density.
    migrations: [
      (data) => ({ theme: (data as { dark: boolean }).dark ? 'dark' : 'system', density: 1 }),
    ],
    defaults: () => ({ theme: 'system' as const, density: 1 }),
  });
}

describe('storage slot', () => {
  it('returns defaults when nothing is stored', async () => {
    const result = await slotOn(createMemoryStore()).load();
    expect(result).toEqual({ data: { theme: 'system', density: 1 } });
  });

  it('round-trips saved data', async () => {
    const store = createMemoryStore();
    await slotOn(store).save({ theme: 'dark', density: 2 });
    expect((await slotOn(store).load()).data).toEqual({ theme: 'dark', density: 2 });
  });

  it('migrates an older version and rewrites it in the current layout', async () => {
    const store = createMemoryStore({
      'test.settings': JSON.stringify({ version: 1, data: { dark: true } }),
    });
    const result = await slotOn(store).load();
    expect(result).toEqual({ data: { theme: 'dark', density: 1 } });
    expect(JSON.parse(store.snapshot()['test.settings'] ?? '{}').version).toBe(2);
  });

  it.each([
    ['corrupt JSON', '{not json', 'corrupt'],
    ['missing envelope', JSON.stringify({ theme: 'dark' }), 'corrupt'],
    ['a newer version', JSON.stringify({ version: 3, data: {} }), 'unsupported_version'],
    ['data failing the schema', JSON.stringify({ version: 2, data: { theme: 'blue' } }), 'invalid'],
  ])('resets to defaults on %s and says why', async (_label, raw, reason) => {
    const store = createMemoryStore({ 'test.settings': raw });
    const result = await slotOn(store).load();
    expect(result).toEqual({ data: { theme: 'system', density: 1 }, reset: reason });
    expect(store.snapshot()['test.settings']).toBeUndefined();
  });
});
