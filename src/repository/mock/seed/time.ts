import { SEED_NOW } from '@/clock';

const seedNow = new Date(SEED_NOW).getTime();
const HOUR = 60 * 60 * 1000;

/** ISO timestamp `hours` before the seed clock. */
export function hoursAgo(hours: number): string {
  return new Date(seedNow - hours * HOUR).toISOString();
}

/** ISO timestamp `hours` after `iso`. */
export function hoursAfter(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * HOUR).toISOString();
}

/** Deterministic PRNG (mulberry32) so generated relations are identical on every run. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}
