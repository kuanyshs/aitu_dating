import { TZDate } from '@date-fns/tz';
import { addDays, format } from 'date-fns';

import {
  answerLabel,
  genderLabels,
  meetingFormatLabels,
  meetingGoalLabels,
  paymentPolicyLabels,
  placeName,
  planBudgetLabels,
  topicLabels,
  type QuestionKey,
} from '@/catalogs';
import type { Clock } from '@/clock';
import {
  FEED_DAYS_AHEAD,
  feedFilterKeys,
  rangeEnds,
  type FeedFilterKey,
  type FeedFilters,
} from '@/contracts';
import { formatPlanDate } from '@/ui/format';
import { strings } from '@/ui/strings';

const t = strings.feedFilters;

/** Fields that hold one value: choosing another replaces it. */
export const singleFilterKeys: ReadonlySet<FeedFilterKey> = new Set<FeedFilterKey>([
  'gender',
  'age',
  'familyPlans',
  'children',
  'childrenCount',
  'wantChildren',
  'income',
  'car',
  'housing',
  'livingWith',
  'interestOther',
]);

export type FilterChip = { key: FeedFilterKey; value: string; label: string };

/** The label of one chosen value, as the chips and the filter screen show it. */
export function filterValueLabel(key: FeedFilterKey, value: string, clock: Clock): string {
  switch (key) {
    case 'gender':
      return genderLabels[value as keyof typeof genderLabels];
    case 'age':
      return t.ageChip(...rangeEnds(value));
    case 'city':
      return placeName(value) || value;
    case 'childrenCount':
      return value === 'none' ? t.noChildren : t.childrenChip(...rangeEnds(value));
    case 'interestOther':
      return t.otherChip(value);
    case 'topics':
      return topicLabels[value as keyof typeof topicLabels];
    case 'format':
      return meetingFormatLabels[value as keyof typeof meetingFormatLabels];
    case 'goal':
      return meetingGoalLabels[value as keyof typeof meetingGoalLabels];
    case 'budget':
      return planBudgetLabels[value as keyof typeof planBudgetLabels];
    case 'payment':
      return paymentPolicyLabels[value as keyof typeof paymentPolicyLabels];
    case 'soon':
      return t.soon[value as keyof typeof t.soon];
    case 'days':
      return formatPlanDate(value, clock);
    default:
      return answerLabel(key as QuestionKey, value);
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
  const next = {
    ...filters,
    [key]: (filters[key] as readonly string[]).filter((v) => v !== value),
  } as FeedFilters;
  if (key === 'interests' && value === 'other') next.interestOther = [];
  return next;
}

/** The filter with one value switched on or off; a one-value field takes it instead. */
export function toggleValue(filters: FeedFilters, key: FeedFilterKey, value: string): FeedFilters {
  const current = filters[key] as readonly string[];
  if (current.includes(value)) return withoutValue(filters, key, value);
  const next = singleFilterKeys.has(key) ? [value] : [...current, value];
  return { ...filters, [key]: next } as FeedFilters;
}

/** The filter with a field set as a whole («Все варианты» is an empty one). */
export function withField(filters: FeedFilters, key: FeedFilterKey, values: string[]): FeedFilters {
  const next = { ...filters, [key]: values } as FeedFilters;
  // «Свой вариант» looks for its text only while it is chosen.
  if (key === 'interests' && !values.includes('other')) next.interestOther = [];
  return next;
}

/** The single dates the filter offers: today and the next days, in the UI timezone. */
export function upcomingDays(clock: Clock): string[] {
  const today = new TZDate(clock.now(), clock.timezone);
  return Array.from({ length: FEED_DAYS_AHEAD }, (_, d) => format(addDays(today, d), 'yyyy-MM-dd'));
}
