import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  settlementName,
  communicationStyleLabels,
  communicationStyles,
  genderLabels,
  questionnairePageLabels,
  questionnairePages,
  type CommunicationStyle,
  type QuestionKey,
} from '@/catalogs';
import {
  BIO_MAX,
  isRepositoryError,
  UpdateCardInput,
  type MyProfile,
  type PartialAnswers,
} from '@/contracts';
import { useMyProfile, useSession, useUpdateMyCard } from '@/data/hooks';
import { QuestionnairePage } from '@/features/questionnaire/QuestionnairePage';
import { asAnswers } from '@/features/questionnaire/rules';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { ActionSheet } from '@/ui/components/ActionSheet';
import { Avatar } from '@/ui/components/Avatar';
import { PrimaryButton, TextButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { Screen } from '@/ui/components/Screen';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { TextArea } from '@/ui/components/TextArea';
import { AppText } from '@/ui/components/Text';
import { useReportFooter } from '@/ui/navigation/statusInset';
import { fullName } from '@/ui/format';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.cardEdit;
const step = strings.access.profileStep;
type FieldName = 'bio' | 'communicationStyle';
const answerErrors = strings.questionnaireEdit.errors;

/**
 * «Редактировать анкету», for active and expired members alike: «О себе», communication
 * style, photos and every answer of the Анкета «Вопросы о тебе», in the sections of its
 * pages. What Passport says — Пол and возраст included — stays read-only.
 */
export default function CardEditScreen() {
  const session = useSession();
  const state = session.data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER' || state === 'ACTIVE_MEMBER_EXPIRED';
  const me = useMyProfile(isMember);
  if (state && !isMember) {
    return (
      <Screen testID="screen-card-edit" withTabBar={false}>
        <AccessPrompt text={t.guest} testID="card-edit-access-prompt" />
      </Screen>
    );
  }
  if (!me.data) {
    return (
      <Screen testID="screen-card-edit" withTabBar={false}>
        <FeedSkeleton rows={2} />
      </Screen>
    );
  }
  return <CardForm me={me.data} />;
}

function CardForm({ me }: { me: MyProfile }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const save = useUpdateMyCard();
  const reportFooter = useReportFooter();
  const [confirming, setConfirming] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const form = useForm<UpdateCardInput>({
    resolver: zodResolver(UpdateCardInput),
    defaultValues: {
      bio: me.card.bio,
      communicationStyle: me.card.communicationStyle,
      showSurname: me.card.showSurname,
      answers: me.card.questionnaire,
    },
    mode: 'onChange',
  });
  const { control, handleSubmit, formState, setError } = form;

  const onSave = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => {
        toast(t.saved);
        leave();
      },
      onError: (error) => {
        if (!isRepositoryError(error) || !error.fieldErrors) return;
        for (const [key, code] of Object.entries(error.fieldErrors)) {
          if (key.startsWith('answers.')) {
            setError(key as `answers.${QuestionKey}`, { message: code });
            continue;
          }
          const name = key.replace('profile.', '') as FieldName;
          if (name in step.errors) setError(name, { message: step.errors[name] });
        }
      },
    }),
  );
  const errorOf = (name: FieldName) => (formState.errors[name] ? step.errors[name] : undefined);
  const failed =
    save.isError && !(isRepositoryError(save.error) && save.error.code === 'VALIDATION_ERROR');
  const cancel = () => (formState.isDirty ? setConfirming(true) : leave());

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-card-edit">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TextButton label={t.cancel} onPress={cancel} testID="card-edit-cancel" />
          <AppText variant="bodyStrong" role="heading" style={styles.title} pointerEvents="none">
            {t.title}
          </AppText>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.passport} testID="card-edit-passport">
            <Avatar avatar={me.avatar} size={48} />
            <View style={styles.grow}>
              <AppText variant="bodyStrong">{fullName(me)}</AppText>
              <AppText variant="caption" tone="textMuted">
                {`${genderLabels[me.gender]} · ${strings.profile.ageCity(me.age, settlementName(me.city))}`}
              </AppText>
              <AppText variant="caption" tone="textMuted">
                {t.passportText}
              </AppText>
            </View>
          </View>

          <TextButton
            label={strings.photo.profile.open(me.photos.length)}
            onPress={() => router.push('/profile-photos')}
            testID="card-edit-photos"
          />

          <Controller
            control={control}
            name="bio"
            render={({ field }) => (
              <TextArea
                label={step.bio}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder={step.bioPlaceholder}
                maxLength={BIO_MAX}
                error={errorOf('bio')}
                testID="card-edit-bio"
              />
            )}
          />

          <View style={styles.section}>
            <AppText variant="bodyStrong">{step.communication}</AppText>
            <Controller
              control={control}
              name="communicationStyle"
              render={({ field }) => (
                <RadioGroup<CommunicationStyle>
                  label={step.communication}
                  options={communicationStyles.map((value) => ({
                    value,
                    label: communicationStyleLabels[value],
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  testID="card-edit-style"
                />
              )}
            />
          </View>

          <View style={styles.section} testID="card-edit-answers">
            <AppText variant="title" role="heading">
              {strings.profile.questionnaire}
            </AppText>
            <Controller
              control={control}
              name="answers"
              render={({ field }) => (
                <View style={styles.pages}>
                  {questionnairePages.map((page) => (
                    <View key={page.key} style={styles.section}>
                      <AppText variant="bodyStrong" role="heading" style={styles.pageTitle}>
                        {questionnairePageLabels[page.key]}
                      </AppText>
                      <QuestionnairePage
                        questions={page.questions}
                        answers={asAnswers(field.value)}
                        onChange={(next) => field.onChange(next as PartialAnswers)}
                        errors={answerErrorsOf(formState.errors.answers)}
                        testID={`card-edit-${page.key}`}
                      />
                    </View>
                  ))}
                </View>
              )}
            />
          </View>

          {me.surname ? (
            <Controller
              control={control}
              name="showSurname"
              render={({ field }) => (
                <ToggleRow
                  label={step.showSurname}
                  hint={step.showSurnameHint(me.surname ?? '')}
                  value={!!field.value}
                  onChange={field.onChange}
                  testID="card-edit-show-surname"
                />
              )}
            />
          ) : null}
        </ScrollView>

        <View style={styles.footer} onLayout={reportFooter}>
          {failed ? (
            <AppText tone="danger" role="alert" testID="card-edit-error">
              {t.failed}
            </AppText>
          ) : null}
          <PrimaryButton
            label={failed ? t.retry : t.save}
            onPress={onSave}
            // Field errors show as they appear; «Сохранить» validates the whole form again.
            disabled={!formState.isDirty || Object.keys(formState.errors).length > 0}
            loading={save.isPending}
            testID="card-edit-save"
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
            testID: 'card-edit-discard',
          },
          {
            label: t.keepEditing,
            onPress: () => setConfirming(false),
            testID: 'card-edit-keep',
          },
        ]}
        onClose={() => setConfirming(false)}
        testID="card-edit-sheet"
      />
    </SafeAreaView>
  );
}

/** Answer errors as texts, by question; the schema and the server give codes. */
function answerErrorsOf(errors: unknown): Partial<Record<QuestionKey, string>> {
  const result: Partial<Record<QuestionKey, string>> = {};
  for (const [question, error] of Object.entries((errors ?? {}) as Record<string, unknown>)) {
    const code = (error as { message?: string } | undefined)?.message;
    if (code) result[question as QuestionKey] = answerErrors[code] ?? answerErrors.required;
  }
  return result;
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
  // «Отменить изменения» is long: the title takes the rest of the row instead of overlapping it.
  title: { flex: 1, textAlign: 'center', paddingRight: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.lg },
  passport: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  grow: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
  pages: { gap: spacing.xl },
  pageTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
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
