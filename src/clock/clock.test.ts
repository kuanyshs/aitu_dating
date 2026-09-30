import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { anchoredClock, fixedClock, isResumable, SEED_NOW } from './index';

const HOUR = 60 * 60 * 1000;
const at = (ms: number) => new Date(new Date(SEED_NOW).getTime() + ms).toISOString();

describe('anchoredClock', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('starts at the seed time and runs in real time', () => {
    const clock = anchoredClock();
    expect(clock.now().toISOString()).toBe(at(0));
    vi.advanceTimersByTime(HOUR);
    expect(clock.now().toISOString()).toBe(at(HOUR));
  });

  it('resumes from a saved time and runs on from there', () => {
    const clock = anchoredClock();
    clock.resumeFrom(at(5 * HOUR));
    expect(clock.now().toISOString()).toBe(at(5 * HOUR));
    vi.advanceTimersByTime(HOUR);
    expect(clock.now().toISOString()).toBe(at(6 * HOUR));
  });

  it('never goes back, and restarts at the seed time', () => {
    const clock = anchoredClock();
    vi.advanceTimersByTime(HOUR);
    clock.resumeFrom('2020-01-01T00:00:00.000Z');
    clock.resumeFrom(at(30 * 60 * 1000));
    expect(clock.now().toISOString()).toBe(at(HOUR));
    clock.restart();
    expect(clock.now().toISOString()).toBe(at(0));
  });

  it('is the only resumable clock', () => {
    expect(isResumable(anchoredClock())).toBe(true);
    expect(isResumable(fixedClock())).toBe(false);
  });
});
