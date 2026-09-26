import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';

import { formatPlanDate, formatRelative } from './format';

const clock = fixedClock('2026-09-26T12:00:00Z');

describe('formatRelative', () => {
  it('uses compact units for the last week', () => {
    expect(formatRelative('2026-09-26T12:00:00Z', clock)).toBe('сейчас');
    expect(formatRelative('2026-09-26T11:55:00Z', clock)).toBe('5 мин');
    expect(formatRelative('2026-09-26T09:00:00Z', clock)).toBe('3 ч');
    expect(formatRelative('2026-09-24T12:00:00Z', clock)).toBe('2 д');
  });

  it('switches to a calendar date after a week', () => {
    expect(formatRelative('2026-09-12T08:00:00Z', clock)).toBe('12 сент.');
    expect(formatRelative('2025-09-12T08:00:00Z', clock)).toBe('12 сент. 2025');
  });
});

describe('formatPlanDate', () => {
  it('formats a plan date in the UI timezone', () => {
    expect(formatPlanDate('2026-09-27', clock)).toBe('27 сент., вс');
  });
});
