import { asyncStorageStore } from '@/storage/asyncStorage';

import { createDraftStore } from './drafts';

export { draftOnOpen, sameTarget, type Draft, type DraftTarget } from './drafts';

/** Черновики on this device; the editor reads and writes them, a demo reset clears them. */
export const drafts = createDraftStore(asyncStorageStore);
