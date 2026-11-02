import { describe, expect, it } from 'vitest';

import { createMemoryStore } from '@/storage';

import { createResponseDraftStore } from './responseDrafts';

describe('a guest’s Отклик draft', () => {
  it('is kept per План and cleared once sent', async () => {
    const store = createMemoryStore();
    const drafts = createResponseDraftStore(store);
    await drafts.save('plan1', 'Буду рада компании');
    await drafts.save('plan2', 'Другой план');
    expect(await createResponseDraftStore(store).load('plan1')).toBe('Буду рада компании');
    await drafts.clear('plan1');
    expect(await drafts.load('plan1')).toBeUndefined();
    expect(await drafts.load('plan2')).toBe('Другой план');
    await drafts.clearAll();
    expect(await drafts.load('plan2')).toBeUndefined();
  });
});
