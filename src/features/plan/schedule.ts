import { TZDate } from '@date-fns/tz';
import { addDays, format } from 'date-fns';

import type { Clock } from '@/clock';
import { PLAN_HORIZON_DAYS } from '@/contracts';

/** Earliest and latest start a plan is offered with, in 30-minute steps. */
const FIRST_SLOT = 8 * 60;
const LAST_SLOT = 22 * 60;
const STEP = 30;

const pad = (n: number) => String(n).padStart(2, '0');

/** Today and the following days a plan can be made for, as YYYY-MM-DD in the UI timezone. */
export function planDates(clock: Clock): string[] {
  const today = new TZDate(clock.now(), clock.timezone);
  return Array.from({ length: PLAN_HORIZON_DAYS }, (_, i) =>
    format(addDays(today, i), 'yyyy-MM-dd'),
  );
}

/** Start times for a date, «HH:mm»; today only those still ahead. */
export function planTimes(date: string, clock: Clock): string[] {
  const now = new TZDate(clock.now(), clock.timezone);
  const isToday = format(now, 'yyyy-MM-dd') === date;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const times: string[] = [];
  for (let m = FIRST_SLOT; m <= LAST_SLOT; m += STEP) {
    if (isToday && m <= minutesNow) continue;
    times.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return times;
}
