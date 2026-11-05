import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  settlementName,
  communicationStyleLabels,
  communicationStyles,
  genderLabels,
  interestLabels,
  interests,
  questionKeys,
  type CommunicationStyle,
} from '@/catalogs';
import {
  BIO_MAX,
  INTERESTS_MAX,
  isRepositoryError,
  UpdateCardInput,
  type MyProfile,
} from '@/contracts';
import { useMyProfile, useSession, useUpdateMyCard } from '@/data/hooks';
import { AnswerInput } from '@/features/questionnaire/AnswerInput';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { ActionSheet } from '@/ui/components/ActionSheet';
import { Avatar } from '@/ui/components/Avatar';
import { PrimaryButton, TextButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
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
type FieldName = 'bio' | 'interests' | 'communicationStyle';

/**
 * «Редактировать анкету», for active and expired members alike: «О себе», interests,
 * communication style, photos and every Анкета answer, the Населённые пункты and Намерения
 * included. What Passport says stays read-only.
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
      interests: me.card.interests,
      communicationStyle: me.card.communicationStyle,
      showSurname: me.card.showSurname,
      answers: me.card.questionnaire,
    },
    mode: 'onChange',
  });
  const { control, handleSubmit, formState, setError } = form;
  const chosen = useWatch({ control, name: 'interests' }) ?? [];

  const onSave = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => {
        toast(t.saved);
        leave();
      },
      onError: (error) => {
        if (!isRepositoryError(error) || !error.fieldErrors) return;
        for (const key of Object.keys(error.fieldErrors)) {
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
            <AppText variant="bodyStrong">{step.interests}</AppText>
            <Controller
              control={control}
              name="interests"
              render={({ field }) => {
                const value = field.value ?? [];
                const full = value.length >= INTERESTS_MAX;
                return (
                  <View role="group" aria-label={step.interests} style={styles.chips}>
                    {interests.map((key) => {
                      const selected = value.includes(key);
                      return (
                        <Chip
                          key={key}
                          role="checkbox"
                          label={interestLabels[key]}
                          selected={selected}
                          disabled={full && !selected}
                          onPress={() =>
                            field.onChange(
                              selected ? value.filter((v) => v !== key) : [...value, key],
                            )
                          }
                          testID={`card-edit-interest-${key}`}
                        />
                      );
                    })}
                  </View>
                );
              }}
            />
            <AppText
              variant="caption"
              tone={errorOf('interests') ? 'danger' : 'textMuted'}
              testID="card-edit-interests-hint"
            >
              {errorOf('interests') ??
                (chosen.length >= INTERESTS_MAX
                  ? step.interestsLimit(INTERESTS_MAX)
                  : step.interestsHint(chosen.length, INTERESTS_MAX))}
            </AppText>
          </View>

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
            {questionKeys.map((question) => (
              <Controller
                key={question}
                control={control}
                name={`answers.${question}`}
                render={({ field }) => (
                  <AnswerInput
                    question={question}
                    value={(field.value as string[] | undefined) ?? []}
                    onChange={field.onChange}
                    showLabel
                    testID={`card-edit-answer-${question}`}
                  />
                )}
              />
            ))}
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
