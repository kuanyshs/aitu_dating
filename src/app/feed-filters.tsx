import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import {
  genders,
  INTEREST_OTHER_MAX,
  MAX_CHILDREN,
  meetingFormats,
  meetingGoals,
  partnerQuestionLabels,
  paymentPolicies,
  planBudgets,
  questionnaire,
  topics,
} from '@/catalogs';
import {
  AGE_MAX,
  AGE_MIN,
  emptyFeedFilters,
  FeedSoon,
  rangeEnds,
  type FeedContent,
  type FeedFilterKey,
  type FeedFilters,
} from '@/contracts';
import { useClock } from '@/data/RepositoryProvider';
import {
  filterValueLabel,
  singleFilterKeys,
  toggleValue,
  upcomingDays,
  withField,
} from '@/features/feedFilter/chips';
import { useFeedFilter } from '@/features/feedFilter/useFeedFilter';
import { NationalityField } from '@/features/questionnaire/AnswerInput';
import { SettlementField } from '@/features/settlement/SettlementPicker';
import { useSettings } from '@/settings';
import { PrimaryButton, TextButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { FlowScreen } from '@/ui/components/FlowScreen';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing, typography } from '@/ui/theme/tokens';

const contents: FeedContent[] = ['all', 'posts', 'plans'];

/** «Кого ищу» after Пол, возраст, Национальность and place, in the Анкета's order. */
const partnerChoiceFields: { key: FeedFilterKey; options: readonly string[] }[] = [
  { key: 'intent', options: questionnaire.intent },
  { key: 'familyPlans', options: questionnaire.familyPlans },
  { key: 'maritalStatus', options: questionnaire.maritalStatus },
  { key: 'children', options: questionnaire.children },
];
const laterChoiceFields: { key: FeedFilterKey; options: readonly string[] }[] = [
  { key: 'wantChildren', options: questionnaire.wantChildren },
  { key: 'education', options: questionnaire.education },
  { key: 'occupation', options: questionnaire.occupation },
  { key: 'incomeSource', options: questionnaire.incomeSource },
  { key: 'income', options: questionnaire.income },
  { key: 'car', options: questionnaire.car },
  { key: 'housing', options: questionnaire.housing },
  { key: 'livingWith', options: questionnaire.livingWith },
  { key: 'parents', options: questionnaire.parents },
  { key: 'habits', options: questionnaire.habits },
  { key: 'interests', options: questionnaire.interests },
];
const meetingFields: { key: FeedFilterKey; options: readonly string[] }[] = [
  { key: 'format', options: meetingFormats },
  { key: 'goal', options: meetingGoals },
  { key: 'budget', options: planBudgets },
  { key: 'payment', options: paymentPolicies },
];

const t = strings.feedFilters;
const fieldTitle: Partial<Record<FeedFilterKey, string>> = {
  ...partnerQuestionLabels,
  topics: t.topics,
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
  const { hasCard, full, stored: saved, apply, saving, failed } = useFeedFilter();
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

  const setField = (key: FeedFilterKey, values: string[]) =>
    filters && setDraft(withField(filters, key, values));

  /** «Все варианты»: chosen while the field is empty, and choosing it empties the field. */
  const anyChip = (key: FeedFilterKey) =>
    filters ? (
      <Chip
        role={singleFilterKeys.has(key) ? 'radio' : 'checkbox'}
        label={t.any}
        selected={(filters[key] as readonly string[]).length === 0}
        onPress={() => setField(key, [])}
        testID={`feed-filter-${key}-any`}
      />
    ) : null;

  const chips = (key: FeedFilterKey, options: readonly string[], withAny = false) =>
    filters ? (
      <View
        role={singleFilterKeys.has(key) ? 'radiogroup' : 'group'}
        aria-label={fieldTitle[key]}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
      >
        {withAny ? anyChip(key) : null}
        {options.map((option) => (
          <Chip
            key={option}
            role={singleFilterKeys.has(key) ? 'radio' : 'checkbox'}
            label={filterValueLabel(key, option, clock)}
            selected={(filters[key] as readonly string[]).includes(option)}
            onPress={() => toggle(key, option)}
            testID={`feed-filter-${key}-${option}`}
          />
        ))}
      </View>
    ) : null;

  const field = (key: FeedFilterKey, options: readonly string[], withAny = false) => (
    <View key={key} style={{ gap: spacing.sm }} testID={`feed-filter-${key}`}>
      <AppText variant="bodyStrong" role="heading">
        {fieldTitle[key]}
      </AppText>
      {chips(key, options, withAny)}
    </View>
  );

  const titled = (key: FeedFilterKey, body: React.ReactNode) => (
    <View key={key} style={{ gap: spacing.sm }} testID={`feed-filter-${key}`}>
      <AppText variant="bodyStrong" role="heading">
        {fieldTitle[key]}
      </AppText>
      {body}
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

          <View style={{ gap: spacing.xs }}>
            <AppText variant="title" role="heading">
              {t.partner}
            </AppText>
            <AppText variant="caption" tone="textMuted" testID="feed-filters-partner-note">
              {full ? t.partnerNote : t.partnerGuest}
            </AppText>
          </View>
          {field('gender', genders, true)}
          {titled(
            'age',
            <RangeField
              value={filters.age[0]}
              min={AGE_MIN}
              max={AGE_MAX}
              unit={t.years}
              label={fieldTitle.age!}
              onChange={(v) => setField('age', v ? [v] : [])}
              any={anyChip('age')}
              testID="feed-filter-age"
            />,
          )}
          {full
            ? titled(
                'nationality',
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {anyChip('nationality')}
                  </View>
                  <NationalityField
                    value={filters.nationality}
                    onChange={(v) => setField('nationality', v)}
                    multiple
                    chooseLabel={t.chooseNationalities}
                    testID="feed-filter-nationality-field"
                  />
                </>,
              )
            : null}
          {titled(
            'city',
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {anyChip('city')}
              </View>
              <SettlementField
                value={filters.city}
                onChange={(city) => setField('city', city)}
                max={20}
                withCountries
                testID="feed-filter-city-field"
              />
            </>,
          )}
          {full ? (
            <>
              {partnerChoiceFields.map(({ key, options }) => field(key, options, true))}
              {titled(
                'childrenCount',
                <RangeField
                  value={filters.childrenCount[0] === 'none' ? undefined : filters.childrenCount[0]}
                  min={1}
                  max={MAX_CHILDREN}
                  label={fieldTitle.childrenCount!}
                  onChange={(v) => setField('childrenCount', v ? [v] : [])}
                  any={
                    <>
                      {anyChip('childrenCount')}
                      <Chip
                        role="radio"
                        label={t.noChildren}
                        selected={filters.childrenCount[0] === 'none'}
                        onPress={() => setField('childrenCount', ['none'])}
                        testID="feed-filter-childrenCount-none"
                      />
                    </>
                  }
                  testID="feed-filter-childrenCount"
                />,
              )}
              {laterChoiceFields.map(({ key, options }) => field(key, options, true))}
              {filters.interests.includes('other') ? (
                <OtherText
                  value={filters.interestOther[0] ?? ''}
                  onChange={(text) => setField('interestOther', text.trim() ? [text] : [])}
                />
              ) : null}
            </>
          ) : null}

          {field('topics', topics)}

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

/**
 * «от … до …» as two number fields. The range counts once both ends are numbers within the
 * bounds; ends in the wrong order are swapped.
 */
function RangeField({
  value,
  min,
  max,
  unit,
  label,
  onChange,
  any,
  testID,
}: {
  value: string | undefined;
  min: number;
  max: number;
  unit?: string;
  label: string;
  onChange: (value: string | undefined) => void;
  any: React.ReactNode;
  testID: string;
}) {
  const { colors } = useTheme();
  const ends = value ? rangeEnds(value) : undefined;
  const [from, setFrom] = useState(ends ? String(ends[0]) : '');
  const [to, setTo] = useState(ends ? String(ends[1]) : '');
  const toRange = (a: string, b: string) => {
    const x = Number(a);
    const y = Number(b);
    const ok = (n: number) => Number.isInteger(n) && n >= min && n <= max;
    return a && b && ok(x) && ok(y) ? `${Math.min(x, y)}-${Math.max(x, y)}` : undefined;
  };
  // «Все варианты», «Сбросить» or «Нет детей» clear the numbers typed here.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    if (value !== toRange(from, to)) {
      setFrom(ends ? String(ends[0]) : '');
      setTo(ends ? String(ends[1]) : '');
    }
  }
  const commit = (a: string, b: string) => {
    const next = toRange(a, b);
    if (next !== value) onChange(next);
  };
  const input = (end: 'from' | 'to') => (
    <TextInput
      value={end === 'from' ? from : to}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '').slice(0, 3);
        if (end === 'from') {
          setFrom(digits);
          commit(digits, to);
        } else {
          setTo(digits);
          commit(from, digits);
        }
      }}
      inputMode="numeric"
      placeholder={end === 'from' ? String(min) : String(max)}
      placeholderTextColor={colors.textMuted}
      aria-label={t.rangeLabel(label, end === 'from' ? t.from : t.to)}
      style={{
        ...typography.body,
        width: 72,
        minHeight: minTouch,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        color: colors.text,
        textAlign: 'center',
      }}
      testID={`${testID}-${end}`}
    />
  );
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{any}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppText>{t.from}</AppText>
        {input('from')}
        <AppText>{t.to}</AppText>
        {input('to')}
        {unit ? <AppText>{unit}</AppText> : null}
      </View>
    </View>
  );
}

/** The text «Свой вариант» of the author has to contain. */
function OtherText({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      maxLength={INTEREST_OTHER_MAX}
      placeholder={t.otherPlaceholder}
      placeholderTextColor={colors.textMuted}
      aria-label={t.otherPlaceholder}
      style={{
        ...typography.body,
        minHeight: minTouch,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        color: colors.text,
      }}
      testID="feed-filter-interestOther"
    />
  );
}
