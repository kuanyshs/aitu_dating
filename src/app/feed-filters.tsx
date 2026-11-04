import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { answerLabel, questionKeys, questionnaire, type QuestionKey } from '@/catalogs';
import type { FeedFilters } from '@/contracts';
import { SettlementField } from '@/features/settlement/SettlementPicker';
import { useFeedFilters, useMyProfile, useSession, useUpdateFeedFilters } from '@/data/hooks';
import { useSettings } from '@/settings';
import { PrimaryButton, TextButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FlowScreen } from '@/ui/components/FlowScreen';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';

const empty = (): FeedFilters => ({
  city: [],
  intent: [],
  communication: [],
  pace: [],
  firstMeeting: [],
  boundaries: [],
  dateFormat: [],
});

/** Фильтры ленты: the Анкета questions «Для тебя» ranks by, any number of options each. */
export default function FeedFiltersScreen() {
  const router = useRouter();
  const session = useSession();
  const hasCard = !!session.data && session.data.accessState.startsWith('ACTIVE_MEMBER');
  const saved = useFeedFilters(hasCard);
  const profile = useMyProfile(hasCard);
  const guestFilters = useSettings((s) => s.guestFilters);
  const setGuestFilters = useSettings((s) => s.setGuestFilters);
  const update = useUpdateFeedFilters();

  const initial = hasCard ? saved.data : (guestFilters ?? empty());
  const [draft, setDraft] = useState<FeedFilters | null>(null);
  const filters = draft ?? initial;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const toggle = (question: QuestionKey, option: string) => {
    if (!filters) return;
    const current = filters[question] as readonly string[];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setDraft({ ...filters, [question]: next } as FeedFilters);
  };

  const answers = profile.data?.card?.questionnaire;
  const reset = () => {
    if (!hasCard) return setDraft(empty());
    if (!answers) return;
    setDraft(
      Object.fromEntries(questionKeys.map((q) => [q, [...answers[q]]])) as unknown as FeedFilters,
    );
  };

  const apply = () => {
    if (!filters) return;
    if (!hasCard) {
      const chosen = questionKeys.some((q) => filters[q].length > 0);
      setGuestFilters(chosen ? filters : null);
      return close();
    }
    update.mutate(filters, { onSuccess: close });
  };

  return (
    <FlowScreen
      title={strings.feedFilters.title}
      text={strings.feedFilters.intro}
      close={{ label: strings.feedFilters.close, onPress: close, testID: 'feed-filters-close' }}
      testID="screen-feed-filters"
      footer={
        <>
          {update.isError ? (
            <AppText tone="danger" role="alert" testID="feed-filters-error">
              {strings.feedFilters.saveFailed}
            </AppText>
          ) : null}
          <PrimaryButton
            label={strings.feedFilters.show}
            loading={update.isPending}
            disabled={!filters}
            onPress={apply}
            testID="feed-filters-apply"
          />
          <TextButton
            label={hasCard ? strings.feedFilters.resetMine : strings.feedFilters.reset}
            disabled={!filters || (hasCard && !answers)}
            onPress={reset}
            testID="feed-filters-reset"
          />
        </>
      }
    >
      {!filters ? (
        <FeedSkeleton />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {!hasCard ? (
            <AppText variant="caption" tone="textMuted" testID="feed-filters-guest-note">
              {strings.feedFilters.guestNote}
            </AppText>
          ) : null}
          {questionKeys.map((question) => (
            <View key={question} style={{ gap: spacing.sm }}>
              <AppText variant="bodyStrong" role="heading">
                {strings.feedFilters.questions[question]}
              </AppText>
              <View
                role="group"
                aria-label={strings.feedFilters.questions[question]}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
              >
                {question === 'city' ? (
                  <SettlementField
                    value={filters.city}
                    onChange={(city) => setDraft({ ...filters, city })}
                    max={20}
                    testID="feed-filter-city"
                  />
                ) : null}
                {(question === 'city' ? [] : (questionnaire[question] as readonly string[])).map(
                  (option) => (
                    <Chip
                      key={option}
                      role="checkbox"
                      label={answerLabel(question, option)}
                      selected={(filters[question] as readonly string[]).includes(option)}
                      onPress={() => toggle(question, option)}
                      testID={`feed-filter-${question}-${option}`}
                    />
                  ),
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </FlowScreen>
  );
}
