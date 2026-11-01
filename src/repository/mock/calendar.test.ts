import { describe, expect, it } from 'vitest';

import { addMonths } from './calendar';

describe('addMonths in Asia/Almaty', () => {
  it('keeps the day and the time of day', () => {
    expect(addMonths('2026-03-15T07:30:00.000Z', 3)).toBe('2026-06-15T07:30:00.000Z');
  });

  it('ends a shorter month on its last day', () => {
    // 31 January 12:00 in Almaty.
    expect(addMonths('2026-01-31T07:00:00.000Z', 1)).toBe('2026-02-28T07:00:00.000Z');
    expect(addMonths('2028-01-31T07:00:00.000Z', 1)).toBe('2028-02-29T07:00:00.000Z');
  });

  it('crosses into the next year', () => {
    expect(addMonths('2026-11-30T10:00:00.000Z', 3)).toBe('2027-02-28T10:00:00.000Z');
  });

  it('counts the day as Almaty sees it, not UTC', () => {
    // 31 January 21:00 UTC is already 1 February 02:00 in Almaty: + 1 month = 1 March.
    expect(addMonths('2026-01-31T21:00:00.000Z', 1)).toBe('2026-02-28T21:00:00.000Z');
  });
});
