import type { PlanStatus } from '@/contracts';

import type { PlanRecord } from './records';

// Plans are dated in Almaty time, which stays at UTC+5 all year round.
const ALMATY_OFFSET = '+05:00';
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A plan as readers see it: stored status changes applied, «Прошёл» computed. */
export type CurrentPlan = Omit<PlanRecord, 'status'> & { status: PlanStatus };

/** The instant a plan starts. */
export function planStartsAt(plan: Pick<PlanRecord, 'date' | 'timeStart'>): Date {
  return new Date(`${plan.date}T${plan.timeStart}:00${ALMATY_OFFSET}`);
}

/** The Almaty calendar date `days` after `now`, as YYYY-MM-DD. */
export function almatyDate(now: Date, days = 0): string {
  return new Date(now.getTime() + ALMATY_OFFSET_MS + days * DAY_MS).toISOString().slice(0, 10);
}

/** An open or closed plan whose start time has come reads as «Прошёл». */
export function currentStatus(plan: PlanRecord, now: Date): PlanStatus {
  const running = plan.status === 'published' || plan.status === 'closed';
  return running && planStartsAt(plan) <= now ? 'past' : plan.status;
}
