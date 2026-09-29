import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cities,
  cityLabels,
  meetingDurations,
  meetingFormatLabels,
  meetingFormats,
  meetingGoalLabels,
  meetingGoals,
  paymentPolicies,
  paymentPolicyLabels,
  topicLabels,
  topics as topicKeys,
  type City,
  type MeetingDuration,
  type MeetingFormat,
  type MeetingGoal,
  type PaymentPolicy,
  type Topic,
} from '@/catalogs';
import { isRepositoryError, LIMITS, type MyProfile } from '@/contracts';
import { useCreatePlan, useMyProfile, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { newIdempotencyKey } from '@/features/access/steps';
import { planDates, planTimes } from '@/features/plan/schedule';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { ActionSheet } from '@/ui/components/ActionSheet';
import { PrimaryButton, TextButton } from '@/ui/components/buttons';
import { Checkbox } from '@/ui/components/Checkbox';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { ErrorState } from '@/ui/components/StateViews';
import { TextArea } from '@/ui/components/TextArea';
import { AppText } from '@/ui/components/Text';
import { formatPlanDate } from '@/ui/format';
import { useReportFooter } from '@/ui/navigation/statusInset';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.planNew;
const PLACE_MAX = 120;
const TOPICS_MAX = 4;

/** Creating a План: active members only; publishes the plan and its feed post together. */
export default function NewPlanScreen() {
  const session = useSession();
  const active = session.data?.accessState === 'ACTIVE_MEMBER';
  const me = useMyProfile(active);
  if (session.data && !active) {
    return (
      <Screen testID="screen-new-plan" withTabBar={false}>
        <AccessPrompt text={t.guest} testID="new-plan-access-prompt" />
      </Screen>
    );
  }
  if (!me.data) {
    return (
      <Screen testID="screen-new-plan" withTabBar={false}>
        {me.isError ? (
          <ErrorState
            testID="new-plan-load-error"
            title={t.loadErrorTitle}
            text={t.loadErrorText}
            action={{ label: t.retry, onPress: () => me.refetch(), testID: 'new-plan-reload' }}
          />
        ) : (
          <FeedSkeleton rows={2} />
        )}
      </Screen>
    );
  }
  return <PlanForm me={me.data} />;
}

type Draft = {
  city: City;
  date?: string;
  timeStart?: string;
  format: MeetingFormat;
  durationMinutes: MeetingDuration;
  goal: MeetingGoal;
  paymentPolicy: PaymentPolicy;
  place: string;
  isPublicPlace: boolean;
  description: string;
  topics: Topic[];
};

function PlanForm({ me }: { me: MyProfile }) {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const toast = useToast((s) => s.show);
  const create = useCreatePlan();
  const reportFooter = useReportFooter();
  const [draft, setDraft] = useState<Draft>({
    city: me.city,
    format: 'coffee',
    durationMinutes: 60,
    goal: 'get_acquainted',
    paymentPolicy: 'each_pays',
    place: '',
    isPublicPlace: false,
    description: '',
    topics: ['meetings'],
  });
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // One key per attempt to publish: «Повторить» after a failure sends the same one.
  const [idempotencyKey, setKey] = useState(newIdempotencyKey);
  const [problem, setProblem] = useState<string>();
  // A request that never got an answer: «Повторить» sends it again with the same key.
  const [failed, setFailed] = useState(false);

  const dates = planDates(clock);
  const times = draft.date ? planTimes(draft.date, clock) : [];
  const set = (patch: Partial<Draft>) => {
    setDirty(true);
    setProblem(undefined);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const cancel = () => (dirty ? setConfirming(true) : leave());

  const ready =
    !!draft.date &&
    !!draft.timeStart &&
    times.includes(draft.timeStart) &&
    draft.place.trim().length > 0 &&
    draft.description.trim().length > 0 &&
    draft.isPublicPlace;

  const submit = () => {
    if (!ready || !draft.date || !draft.timeStart) return;
    create.mutate(
      {
        ...draft,
        date: draft.date,
        timeStart: draft.timeStart,
        isPublicPlace: true,
        place: draft.place.trim(),
        description: draft.description.trim(),
        idempotencyKey,
      },
      {
        onSuccess: (plan) => {
          toast(t.done);
          router.replace(`/plan/${plan.id}`);
        },
        onError: (error) => {
          const refused =
            isRepositoryError(error) &&
            (error.code === 'CONFLICT' || error.code === 'VALIDATION_ERROR');
          if (!refused) return setFailed(true);
          // What the server refuses is the member's to change; a new attempt gets a new key.
          setFailed(false);
          setKey(newIdempotencyKey());
          setProblem(
            error.code === 'CONFLICT'
              ? t.limit
              : error.fieldErrors?.date === 'too_far'
                ? t.tooFar
                : t.past,
          );
        },
      },
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-new-plan">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TextButton label={t.cancel} onPress={cancel} testID="new-plan-cancel" />
          <AppText variant="bodyStrong" role="heading" style={styles.title} pointerEvents="none">
            {t.title}
          </AppText>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText tone="textMuted">{t.intro}</AppText>

          <Group label={t.city}>
            {cities.map((city) => (
              <Chip
                key={city}
                label={cityLabels[city]}
                selected={draft.city === city}
                onPress={() => set({ city })}
                testID={`new-plan-city-${city}`}
              />
            ))}
          </Group>

          <Group label={t.date}>
            {dates.map((date) => (
              <Chip
                key={date}
                label={formatPlanDate(date, clock)}
                selected={draft.date === date}
                onPress={() => {
                  const available = planTimes(date, clock);
                  set({
                    date,
                    timeStart:
                      draft.timeStart && available.includes(draft.timeStart)
                        ? draft.timeStart
                        : undefined,
                  });
                }}
                testID={`new-plan-date-${date}`}
              />
            ))}
          </Group>

          {draft.date ? (
            <Group label={t.time}>
              {times.length === 0 ? (
                <AppText tone="textMuted" testID="new-plan-no-times">
                  {t.noTimes}
                </AppText>
              ) : (
                times.map((time) => (
                  <Chip
                    key={time}
                    label={time}
                    selected={draft.timeStart === time}
                    onPress={() => set({ timeStart: time })}
                    testID={`new-plan-time-${time}`}
                  />
                ))
              )}
            </Group>
          ) : null}

          <Group label={t.format}>
            {meetingFormats.map((format) => (
              <Chip
                key={format}
                label={meetingFormatLabels[format]}
                selected={draft.format === format}
                onPress={() => set({ format })}
                testID={`new-plan-format-${format}`}
              />
            ))}
          </Group>

          <Group label={t.duration}>
            {meetingDurations.map((minutes) => (
              <Chip
                key={minutes}
                label={strings.plan.minutes(minutes)}
                selected={draft.durationMinutes === minutes}
                onPress={() => set({ durationMinutes: minutes })}
                testID={`new-plan-duration-${minutes}`}
              />
            ))}
          </Group>

          <Group label={t.goal}>
            {meetingGoals.map((goal) => (
              <Chip
                key={goal}
                label={meetingGoalLabels[goal]}
                selected={draft.goal === goal}
                onPress={() => set({ goal })}
                testID={`new-plan-goal-${goal}`}
              />
            ))}
          </Group>

          <Group label={t.payment}>
            {paymentPolicies.map((policy) => (
              <Chip
                key={policy}
                label={paymentPolicyLabels[policy]}
                selected={draft.paymentPolicy === policy}
                onPress={() => set({ paymentPolicy: policy })}
                testID={`new-plan-payment-${policy}`}
              />
            ))}
          </Group>

          <TextArea
            label={t.place}
            value={draft.place}
            onChangeText={(place) => set({ place })}
            placeholder={t.placePlaceholder}
            maxLength={PLACE_MAX}
            testID="new-plan-place"
          />
          <View style={styles.section}>
            <Checkbox
              label={t.publicPlace}
              checked={draft.isPublicPlace}
              onChange={(isPublicPlace) => set({ isPublicPlace })}
              testID="new-plan-public"
            />
            <AppText variant="caption" tone="textMuted">
              {t.publicHint}
            </AppText>
          </View>

          <TextArea
            label={t.description}
            value={draft.description}
            onChangeText={(description) => set({ description })}
            placeholder={t.descriptionPlaceholder}
            maxLength={LIMITS.planDescription}
            testID="new-plan-description"
          />

          <Group label={t.topics} many>
            {topicKeys.map((topic) => {
              const selected = draft.topics.includes(topic);
              return (
                <Chip
                  key={topic}
                  role="checkbox"
                  label={topicLabels[topic]}
                  selected={selected}
                  disabled={!selected && draft.topics.length >= TOPICS_MAX}
                  onPress={() =>
                    set({
                      topics: selected
                        ? draft.topics.filter((x) => x !== topic)
                        : [...draft.topics, topic],
                    })
                  }
                  testID={`new-plan-topic-${topic}`}
                />
              );
            })}
          </Group>
        </ScrollView>

        <View style={styles.footer} onLayout={reportFooter}>
          {problem || failed ? (
            <AppText tone="danger" role="alert" testID="new-plan-error">
              {problem ?? t.failed}
            </AppText>
          ) : null}
          <PrimaryButton
            label={failed ? t.retry : t.submit}
            onPress={submit}
            disabled={!ready}
            loading={create.isPending}
            testID="new-plan-submit"
          />
        </View>
      </KeyboardAvoidingView>

      <ActionSheet
        visible={confirming}
        title={t.discardTitle}
        message={t.discardText}
        actions={[
          {
            label: t.discard,
            danger: true,
            onPress: () => {
              setConfirming(false);
              leave();
            },
            testID: 'new-plan-discard',
          },
          {
            label: t.keepEditing,
            onPress: () => setConfirming(false),
            testID: 'new-plan-keep',
          },
        ]}
        onClose={() => setConfirming(false)}
        testID="new-plan-sheet"
      />
    </SafeAreaView>
  );
}

function Group({
  label,
  many,
  children,
}: {
  label: string;
  /** Several may be chosen (Темы); otherwise exactly one. */
  many?: boolean;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong">{label}</AppText>
      <View role={many ? 'group' : 'radiogroup'} aria-label={label} style={styles.chips}>
        {children}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  // Centred on the screen, not between the buttons.
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  content: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
}));
