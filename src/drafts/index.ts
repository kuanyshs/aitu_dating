import { asyncStorageStore } from '@/storage/asyncStorage';

import { createDraftStore } from './drafts';
import { createResponseDraftStore } from './responseDrafts';

export { draftOnOpen, sameTarget, type Draft, type DraftTarget } from './drafts';

/** Черновики on this device; the editor reads and writes them, a demo reset clears them. */
export const drafts = createDraftStore(asyncStorageStore);

/** Отклик texts a guest wrote before joining; restored on that План once a member. */
export const responseDrafts = createResponseDraftStore(asyncStorageStore);
