import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';

import { planDates, planTimes } from './schedule';

// 2026-09-26 17:10 in Almaty.
const clock = fixedClock('2026-09-26T12:10:00Z');

describe('plan schedule', () => {
  it('offers today and the next 13 days in Almaty', () => {
    const dates = planDates(clock);
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe('2026-09-26');
    expect(dates[13]).toBe('2026-10-09');
    // Late evening in UTC is already the next day in Almaty.
    expect(planDates(fixedClock('2026-09-26T20:00:00Z'))[0]).toBe('2026-09-27');
  });

  it('offers 30-minute starts, today only those still ahead', () => {
    const later = planTimes('2026-09-27', clock);
    expect(later[0]).toBe('08:00');
    expect(later.at(-1)).toBe('22:00');
    expect(later).toHaveLength(29);
    expect(planTimes('2026-09-26', clock)[0]).toBe('17:30');
    expect(planTimes('2026-09-26', fixedClock('2026-09-26T17:30:00Z'))).toEqual([]);
  });
});
