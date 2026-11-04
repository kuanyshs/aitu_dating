import { TZDate } from '@date-fns/tz';
import { addDays, format } from 'date-fns';

import {
  datingIntentLabels,
  interestLabels,
  meetingFormatLabels,
  meetingGoalLabels,
  paymentPolicyLabels,
  planBudgetLabels,
  settlementName,
  topicLabels,
} from '@/catalogs';
import type { Clock } from '@/clock';
import { FEED_DAYS_AHEAD, feedFilterKeys, type FeedFilterKey, type FeedFilters } from '@/contracts';
import { formatPlanDate } from '@/ui/format';
import { strings } from '@/ui/strings';

export type FilterChip = { key: FeedFilterKey; value: string; label: string };

/** The label of one chosen value, as the chips and the filter screen show it. */
export function filterValueLabel(key: FeedFilterKey, value: string, clock: Clock): string {
  switch (key) {
    case 'city':
      return settlementName(value) ?? value;
    case 'interests':
      return interestLabels[value as keyof typeof interestLabels];
    case 'topics':
      return topicLabels[value as keyof typeof topicLabels];
    case 'intent':
      return datingIntentLabels[value as keyof typeof datingIntentLabels];
    case 'format':
      return meetingFormatLabels[value as keyof typeof meetingFormatLabels];
    case 'goal':
      return meetingGoalLabels[value as keyof typeof meetingGoalLabels];
    case 'budget':
      return planBudgetLabels[value as keyof typeof planBudgetLabels];
    case 'payment':
      return paymentPolicyLabels[value as keyof typeof paymentPolicyLabels];
    case 'soon':
      return strings.feedFilters.soon[value as keyof typeof strings.feedFilters.soon];
    case 'days':
      return formatPlanDate(value, clock);
  }
}

/** Every chosen value in the order of the filter screen. */
export function filterChips(filters: FeedFilters, clock: Clock): FilterChip[] {
  return feedFilterKeys.flatMap((key) =>
    (filters[key] as readonly string[]).map((value) => ({
      key,
      value,
      label: filterValueLabel(key, value, clock),
    })),
  );
}

/** The filter with one value taken out. */
export function withoutValue(filters: FeedFilters, key: FeedFilterKey, value: string): FeedFilters {
  return {
    ...filters,
    [key]: (filters[key] as readonly string[]).filter((v) => v !== value),
  } as FeedFilters;
}

/** The filter with one value switched on or off. */
export function toggleValue(filters: FeedFilters, key: FeedFilterKey, value: string): FeedFilters {
  const current = filters[key] as readonly string[];
  return current.includes(value)
    ? withoutValue(filters, key, value)
    : ({ ...filters, [key]: [...current, value] } as FeedFilters);
}

/** The single dates the filter offers: today and the next days, in the UI timezone. */
export function upcomingDays(clock: Clock): string[] {
  const today = new TZDate(clock.now(), clock.timezone);
  return Array.from({ length: FEED_DAYS_AHEAD }, (_, d) => format(addDays(today, d), 'yyyy-MM-dd'));
}
