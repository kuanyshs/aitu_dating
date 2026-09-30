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

/** A clock the demo backend can move to where the previous page load left off. */
export interface ResumableClock extends Clock {
  /** Goes on from `iso` if it is later than now; the clock never goes back. */
  resumeFrom(iso: string): void;
  /** Back to the anchor («Сбросить демо»). */
  restart(): void;
}

export function isResumable(clock: Clock): clock is ResumableClock {
  return typeof (clock as Partial<ResumableClock>).restart === 'function';
}

/**
 * Starts at `anchorIso` and advances in real time. The demo app runs on this so the
 * seed stays consistent (plans stay in the future) whatever the real date is. The mock
 * backend resumes it from the last saved time, so a reload never goes back in time.
 */
export function anchoredClock(
  anchorIso: string = SEED_NOW,
  timezone: string = UI_TIMEZONE,
): ResumableClock {
  const anchor = new Date(anchorIso).getTime();
  let base = anchor;
  let startedAt = Date.now();
  return {
    now: () => new Date(base + (Date.now() - startedAt)),
    timezone,
    resumeFrom(iso) {
      const saved = new Date(iso).getTime();
      if (saved <= base + (Date.now() - startedAt)) return;
      base = saved;
      startedAt = Date.now();
    },
    restart() {
      base = anchor;
      startedAt = Date.now();
    },
  };
}
