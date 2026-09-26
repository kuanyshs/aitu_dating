import { TZDate } from '@date-fns/tz';
import { differenceInCalendarYears, differenceInMinutes, format } from 'date-fns';
import { ru } from 'date-fns/locale';

import type { Clock } from '@/clock';

import { strings } from './strings';

const HOUR = 60;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact Threads-style age of an event: «сейчас», «5 мин», «3 ч», «2 д», «12 сент.». */
export function formatRelative(iso: string, clock: Clock): string {
  const date = new Date(iso);
  const now = clock.now();
  const minutes = differenceInMinutes(now, date);
  const units = strings.time;
  if (minutes < 1) return units.now;
  if (minutes < HOUR) return `${minutes} ${units.minutes}`;
  if (minutes < DAY) return `${Math.floor(minutes / HOUR)} ${units.hours}`;
  if (minutes < WEEK) return `${Math.floor(minutes / DAY)} ${units.days}`;
  const local = new TZDate(date, clock.timezone);
  const sameYear = differenceInCalendarYears(new TZDate(now, clock.timezone), local) === 0;
  return format(local, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: ru });
}

/** Calendar date of a plan in the UI timezone, e.g. «27 сент., вс». */
export function formatPlanDate(isoDate: string, clock: Clock): string {
  const local = new TZDate(`${isoDate}T12:00:00`, clock.timezone);
  return format(local, 'd MMM, EEEEEE', { locale: ru });
}
