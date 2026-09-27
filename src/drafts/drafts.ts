import { z } from 'zod';

import { topics as topicKeys } from '@/catalogs';
import { LIMITS } from '@/contracts';
import { createSlot, storageKeys, type KeyValueStore } from '@/storage';

/** Черновик: what the editor held when its author chose to keep it. */
export const Draft = z.strictObject({
  type: z.enum(['post', 'question', 'quote']),
  text: z.string().max(LIMITS.postText),
  topics: z.array(z.enum(topicKeys)).max(4),
  quotedPostId: z.string().min(1).optional(),
});
export type Draft = z.infer<typeof Draft>;

/** One draft per member, kept only on this device. */
const Drafts = z.record(z.string(), Draft);
type Drafts = z.infer<typeof Drafts>;

/** What the editor is opened for: a new post, or a quote of one post. */
export type DraftTarget = { quotedPostId?: string };

export const sameTarget = (draft: Draft, target: DraftTarget) =>
  (draft.quotedPostId ?? null) === (target.quotedPostId ?? null);

/**
 * On opening the editor: nothing to offer, the draft for this very target (filled in
 * silently), or a draft for something else (the author chooses to continue or start over).
 */
export function draftOnOpen(
  draft: Draft | undefined,
  target: DraftTarget,
): 'none' | 'restore' | 'ask' {
  if (!draft) return 'none';
  return sameTarget(draft, target) ? 'restore' : 'ask';
}

export function createDraftStore(store: KeyValueStore) {
  const slot = createSlot<Drafts>({
    store,
    key: storageKeys.drafts,
    schema: Drafts,
    version: 1,
    defaults: (): Drafts => ({}),
  });

  return {
    async load(userId: string): Promise<Draft | undefined> {
      return (await slot.load()).data[userId];
    },
    async save(userId: string, draft: Draft): Promise<void> {
      const { data } = await slot.load();
      await slot.save({ ...data, [userId]: Draft.parse(draft) });
    },
    async clear(userId: string): Promise<void> {
      const { data } = await slot.load();
      if (!(userId in data)) return;
      const rest = { ...data };
      delete rest[userId];
      await slot.save(rest);
    },
    /** «Сбросить демо» forgets every draft on the device. */
    async clearAll(): Promise<void> {
      await slot.clear();
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;
