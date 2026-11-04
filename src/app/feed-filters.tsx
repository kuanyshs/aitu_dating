import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  interests,
  meetingFormats,
  meetingGoals,
  paymentPolicies,
  planBudgets,
  questionnaire,
  topics,
} from '@/catalogs';
import {
  emptyFeedFilters,
  FeedSoon,
  type FeedContent,
  type FeedFilterKey,
  type FeedFilters,
} from '@/contracts';
import { useClock } from '@/data/RepositoryProvider';
import { filterValueLabel, toggleValue, upcomingDays } from '@/features/feedFilter/chips';
import { useFeedFilter } from '@/features/feedFilter/useFeedFilter';
import { SettlementField } from '@/features/settlement/SettlementPicker';
import { useSettings } from '@/settings';
import { PrimaryButton, TextButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { FlowScreen } from '@/ui/components/FlowScreen';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';

const contents: FeedContent[] = ['all', 'posts', 'plans'];

/** The options of each chip field, in screen order. */
const chipFields: { key: FeedFilterKey; options: readonly string[] }[] = [
  { key: 'interests', options: interests },
  { key: 'topics', options: topics },
  { key: 'intent', options: questionnaire.intent },
];
const meetingFields: { key: FeedFilterKey; options: readonly string[] }[] = [
  { key: 'format', options: meetingFormats },
  { key: 'goal', options: meetingGoals },
  { key: 'budget', options: planBudgets },
  { key: 'payment', options: paymentPolicies },
];

const t = strings.feedFilters;
const fieldTitle: Partial<Record<FeedFilterKey, string>> = {
  interests: t.interests,
  topics: t.topics,
  intent: t.intent,
  format: t.format,
  goal: t.goal,
  budget: t.budget,
  payment: t.payment,
};

/**
 * The one filter of «Поиск» and «Мои подписки». Nothing changes until «Применить»;
 * «Сбросить» clears the form, «Отмена» leaves it as it was.
 */
export default function FeedFiltersScreen() {
  const router = useRouter();
  const clock = useClock();
  const { hasCard, filters: saved, apply, saving, failed } = useFeedFilter();
  const savedContent = useSettings((s) => s.feedContent.feeds);
  const setFeedContent = useSettings((s) => s.setFeedContent);

  const [draft, setDraft] = useState<FeedFilters | null>(null);
  const [content, setContent] = useState<FeedContent | null>(null);
  const filters = draft ?? saved;
  const shownContent = content ?? savedContent;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const toggle = (key: FeedFilterKey, value: string) =>
    filters && setDraft(toggleValue(filters, key, value));

  const onApply = () => {
    if (!filters) return;
    setFeedContent('for_you', shownContent);
    apply(filters, close);
  };
  const onReset = () => {
    setDraft(emptyFeedFilters());
    setContent('all');
  };

  const chips = (key: FeedFilterKey, options: readonly string[]) =>
    filters ? (
      <View
        role="group"
        aria-label={fieldTitle[key]}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
      >
        {options.map((option) => (
          <Chip
            key={option}
            role="checkbox"
            label={filterValueLabel(key, option, clock)}
            selected={(filters[key] as readonly string[]).includes(option)}
            onPress={() => toggle(key, option)}
            testID={`feed-filter-${key}-${option}`}
          />
        ))}
      </View>
    ) : null;

  const field = (key: FeedFilterKey, options: readonly string[]) => (
    <View key={key} style={{ gap: spacing.sm }}>
      <AppText variant="bodyStrong" role="heading">
        {fieldTitle[key]}
      </AppText>
      {chips(key, options)}
    </View>
  );

  return (
    <FlowScreen
      title={t.title}
      text={t.intro}
      close={{ label: t.cancel, onPress: close, testID: 'feed-filters-close' }}
      testID="screen-feed-filters"
      footer={
        <>
          {failed ? (
            <AppText tone="danger" role="alert" testID="feed-filters-error">
              {t.saveFailed}
            </AppText>
          ) : null}
          <PrimaryButton
            label={t.apply}
            loading={saving}
            disabled={!filters}
            onPress={onApply}
            testID="feed-filters-apply"
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TextButton
              label={t.reset}
              disabled={!filters}
              onPress={onReset}
              testID="feed-filters-reset"
            />
            <TextButton label={t.cancel} onPress={close} testID="feed-filters-cancel" />
          </View>
        </>
      }
    >
      {!filters ? (
        <FeedSkeleton />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {!hasCard ? (
            <AppText variant="caption" tone="textMuted" testID="feed-filters-guest-note">
              {t.guestNote}
            </AppText>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <AppText variant="bodyStrong" role="heading">
              {t.content}
            </AppText>
            <View
              role="radiogroup"
              aria-label={t.content}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
            >
              {contents.map((c) => (
                <Chip
                  key={c}
                  label={strings.home.content[c]}
                  selected={c === shownContent}
                  onPress={() => setContent(c)}
                  testID={`feed-filter-content-${c}`}
                />
              ))}
            </View>
          </View>

          <SettlementField
            label={t.city}
            value={filters.city}
            onChange={(city) => setDraft({ ...filters, city })}
            max={20}
            testID="feed-filter-city"
          />

          {chipFields.map(({ key, options }) => field(key, options))}

          {shownContent !== 'posts' ? (
            <>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="title" role="heading">
                  {t.meetings}
                </AppText>
                <AppText variant="caption" tone="textMuted">
                  {t.meetingsNote}
                </AppText>
              </View>
              {meetingFields.map(({ key, options }) => field(key, options))}
              <View style={{ gap: spacing.sm }}>
                <AppText variant="bodyStrong" role="heading">
                  {t.when}
                </AppText>
                {chips('soon', FeedSoon.options)}
                <AppText variant="caption" tone="textMuted">
                  {t.days}
                </AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.sm }}
                  role="group"
                  aria-label={t.days}
                >
                  {upcomingDays(clock).map((day) => (
                    <Chip
                      key={day}
                      role="checkbox"
                      label={filterValueLabel('days', day, clock)}
                      selected={filters.days.includes(day)}
                      onPress={() => toggle('days', day)}
                      testID={`feed-filter-days-${day}`}
                    />
                  ))}
                </ScrollView>
              </View>
            </>
          ) : null}
        </View>
      )}
    </FlowScreen>
  );
}
