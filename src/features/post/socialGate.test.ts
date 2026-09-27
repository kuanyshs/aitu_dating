import { describe, expect, it } from 'vitest';

import { socialGate } from './socialGate';

describe('social gate', () => {
  it('lets active members act', () => {
    expect(socialGate('ACTIVE_MEMBER')).toBe('allow');
  });

  it('sends expired members to Продление and everyone else to the access flow', () => {
    expect(socialGate('ACTIVE_MEMBER_EXPIRED')).toBe('renew');
    expect(socialGate('GUEST_PREVIEW')).toBe('access');
    expect(socialGate('BLOCKED')).toBe('access');
  });

  it('waits while the session is loading instead of taking a member for a guest', () => {
    expect(socialGate(undefined)).toBe('wait');
  });
});
