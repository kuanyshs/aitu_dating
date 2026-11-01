/** Kazakhstan keeps one time zone, UTC+5, all year: Membership months follow it. */
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Adds calendar months as a person in Almaty counts them: the same day of the month and
 * time of day, or the last day of a shorter month (31 January + 1 month = end of February).
 */
export function addMonths(iso: string, months: number): string {
  const local = new Date(new Date(iso).getTime() + ALMATY_OFFSET_MS);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0),
  ).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - ALMATY_OFFSET_MS).toISOString();
}
