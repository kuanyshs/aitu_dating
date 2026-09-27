import { describe, expect, it } from 'vitest';

import { createMemoryStore, storageKeys } from '@/storage';

import { createDraftStore, draftOnOpen, type Draft } from './drafts';

const post: Draft = { type: 'question', text: 'Где поговорить?', topics: ['city'] };
const quote: Draft = { type: 'quote', text: 'Согласна', topics: [], quotedPostId: 'p02' };

describe('draft slot', () => {
  it('keeps one draft per member and survives a restart', async () => {
    const store = createMemoryStore();
    await createDraftStore(store).save('me-1', post);
    await createDraftStore(store).save('me-2', quote);

    const restarted = createDraftStore(store);
    expect(await restarted.load('me-1')).toEqual(post);
    expect(await restarted.load('me-2')).toEqual(quote);
    expect(await restarted.load('someone-else')).toBeUndefined();
  });

  it('replaces a member’s draft and clears only theirs', async () => {
    const drafts = createDraftStore(createMemoryStore());
    await drafts.save('me-1', post);
    await drafts.save('me-2', post);
    await drafts.save('me-1', quote);
    expect(await drafts.load('me-1')).toEqual(quote);

    await drafts.clear('me-1');
    expect(await drafts.load('me-1')).toBeUndefined();
    expect(await drafts.load('me-2')).toEqual(post);
  });

  it('forgets everything on a demo reset', async () => {
    const drafts = createDraftStore(createMemoryStore());
    await drafts.save('me-1', post);
    await drafts.clearAll();
    expect(await drafts.load('me-1')).toBeUndefined();
  });

  it('starts empty instead of failing on unreadable data', async () => {
    const store = createMemoryStore({ [storageKeys.drafts]: '{broken' });
    expect(await createDraftStore(store).load('me-1')).toBeUndefined();
  });
});

describe('opening the editor with a draft', () => {
  it('fills in the draft for the same target and asks for another one', () => {
    expect(draftOnOpen(undefined, {})).toBe('none');
    expect(draftOnOpen(post, {})).toBe('restore');
    expect(draftOnOpen(quote, { quotedPostId: 'p02' })).toBe('restore');
    expect(draftOnOpen(post, { quotedPostId: 'p02' })).toBe('ask');
    expect(draftOnOpen(quote, {})).toBe('ask');
    expect(draftOnOpen(quote, { quotedPostId: 'p05' })).toBe('ask');
  });
});
