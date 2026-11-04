import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { chosenFilterCount, emptyFeedFilters } from '@/contracts';
import { useClock } from '@/data/RepositoryProvider';
import { TextButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { AppText } from '@/ui/components/Text';
import { SlidersHorizontal } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { filterChips, withoutValue } from './chips';
import { useFeedFilter } from './useFeedFilter';

/** «Фильтры» with the number chosen, and the chosen values as chips that remove themselves. */
export function FeedFilterButton() {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  const { filters } = useFeedFilter();
  const count = chosenFilterCount(filters);
  return (
    <Pressable
      role="button"
      aria-label={count ? strings.home.filtersCount(count) : strings.home.filters}
      onPress={() => router.push('/feed-filters')}
      style={styles.button}
      testID="home-filters"
    >
      <SlidersHorizontal size={18} color={colors.text} />
      <AppText variant="bodyStrong">{strings.home.filters}</AppText>
      {count ? (
        <View style={styles.count} testID="home-filters-count">
          <AppText variant="caption" tone="onPrimary">
            {String(count)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function FeedFilterChips() {
  const styles = useStyles();
  const clock = useClock();
  const { filters, apply } = useFeedFilter();
  if (!filters) return null;
  const chips = filterChips(filters, clock);
  if (!chips.length) return null;
  const t = strings.feedFilters;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      style={styles.chipRow}
      aria-label={t.applied}
      testID="feed-filter-chips"
    >
      {chips.map((chip) => (
        <Chip
          key={`${chip.key}-${chip.value}`}
          role="checkbox"
          selected
          label={`${chip.label} ✕`}
          onPress={() => apply(withoutValue(filters, chip.key, chip.value))}
          testID={`feed-chip-${chip.key}-${chip.value}`}
        />
      ))}
      <TextButton
        label={t.resetAll}
        onPress={() => apply(emptyFeedFilters())}
        testID="feed-chips-reset"
      />
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  chipRow: { flexGrow: 0 },
  chips: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
}));
