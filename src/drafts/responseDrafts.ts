import { z } from 'zod';

import { LIMITS } from '@/contracts';
import { createSlot, storageKeys, type KeyValueStore } from '@/storage';

/** Отклик texts a guest wrote before joining, by План; kept on this device only. */
const ResponseDrafts = z.record(z.string(), z.string().max(LIMITS.commentText));
type ResponseDrafts = z.infer<typeof ResponseDrafts>;

export function createResponseDraftStore(store: KeyValueStore) {
  const slot = createSlot<ResponseDrafts>({
    store,
    key: storageKeys.responseDrafts,
    schema: ResponseDrafts,
    version: 1,
    defaults: (): ResponseDrafts => ({}),
  });

  return {
    async load(planId: string): Promise<string | undefined> {
      return (await slot.load()).data[planId];
    },
    async save(planId: string, text: string): Promise<void> {
      const { data } = await slot.load();
      await slot.save({ ...data, [planId]: text.slice(0, LIMITS.commentText) });
    },
    async clear(planId: string): Promise<void> {
      const { data } = await slot.load();
      if (!(planId in data)) return;
      const rest = { ...data };
      delete rest[planId];
      await slot.save(rest);
    },
    async clearAll(): Promise<void> {
      await slot.clear();
    },
  };
}

export type ResponseDraftStore = ReturnType<typeof createResponseDraftStore>;
