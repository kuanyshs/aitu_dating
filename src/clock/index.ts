/** Injected time source: relative labels and date rules never read the system clock directly. */
export interface Clock {
  now(): Date;
  readonly timezone: string;
}

export const UI_TIMEZONE = 'Asia/Almaty';

/** Seed data is written relative to this instant. */
export const SEED_NOW = '2026-09-26T12:00:00Z';

export function fixedClock(iso: string = SEED_NOW, timezone: string = UI_TIMEZONE): Clock {
  const instant = new Date(iso);
  return { now: () => new Date(instant), timezone };
}

export const systemClock: Clock = { now: () => new Date(), timezone: UI_TIMEZONE };

/**
 * Starts at `anchorIso` and advances in real time. The demo app runs on this so the
 * seed stays consistent (plans stay in the future) whatever the real date is.
 */
export function anchoredClock(anchorIso: string = SEED_NOW, timezone: string = UI_TIMEZONE): Clock {
  const anchor = new Date(anchorIso).getTime();
  const startedAt = Date.now();
  return { now: () => new Date(anchor + (Date.now() - startedAt)), timezone };
}
