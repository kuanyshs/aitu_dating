import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import {
  communicationStyleLabels,
  communicationStyles,
  interestLabels,
  interests,
  type CommunicationStyle,
} from '@/catalogs';
import { BIO_MAX, INTERESTS_MAX, isRepositoryError, ProfileStepInput } from '@/contracts';
import { useSaveProfileStep } from '@/data/hooks';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, stepRoute } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { PrimaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { TextArea } from '@/ui/components/TextArea';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';

type FieldName = keyof ProfileStepInput;

const empty: ProfileStepInput = { bio: '', interests: [], communicationStyle: undefined as never };

export default function ProfileStep() {
  const router = useRouter();
  const flow = useStepGuard('profile');
  const save = useSaveProfileStep();
  const { field } = useLocalSearchParams<{ field?: string }>();
  const t = strings.access.profileStep;

  const form = useForm<ProfileStepInput>({
    resolver: zodResolver(ProfileStepInput),
    defaultValues: empty,
    mode: 'onChange',
  });
  const { control, handleSubmit, formState, reset, setError } = form;

  // The saved draft fills the form once it arrives.
  const draft = flow.data?.profile;
  useEffect(() => {
    if (draft) reset(draft);
  }, [draft, reset]);

  // Sent back here from the last step because of a server-side field error.
  useEffect(() => {
    if (field && field in t.errors) {
      setError(field as FieldName, { message: t.errors[field as FieldName] });
    }
  }, [field, setError, t.errors]);

  const chosen = useWatch({ control, name: 'interests' }) ?? [];

  const onSubmit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (next) => router.replace(stepRoute(next.step) as Href),
      onError: (error) => {
        if (!isRepositoryError(error) || !error.fieldErrors) return;
        for (const key of Object.keys(error.fieldErrors)) {
          const name = key.replace('profile.', '') as FieldName;
          if (name in t.errors) setError(name, { message: t.errors[name] });
        }
      },
    }),
  );

  // Show a field's error once it was edited, after a submit, or when sent back to it.
  const errorOf = (name: FieldName) => {
    const visible = formState.dirtyFields[name] || formState.isSubmitted || field === name;
    return formState.errors[name] && visible ? t.errors[name] : undefined;
  };
  const failedOther =
    save.isError && !(isRepositoryError(save.error) && save.error.code === 'VALIDATION_ERROR');

  return (
    <StepScreen
      step="profile"
      title={t.title}
      text={t.text}
      testID="access-profile"
      footer={
        <>
          {failedOther ? (
            <AppText tone="danger" role="alert">
              {accessErrorText(save.error)}
            </AppText>
          ) : null}
          <PrimaryButton
            label={strings.access.next}
            onPress={onSubmit}
            disabled={!formState.isValid}
            loading={save.isPending}
            testID="access-next"
          />
        </>
      }
    >
      <Controller
        control={control}
        name="bio"
        render={({ field: f }) => (
          <TextArea
            label={t.bio}
            value={f.value ?? ''}
            onChangeText={f.onChange}
            onBlur={f.onBlur}
            placeholder={t.bioPlaceholder}
            maxLength={BIO_MAX}
            error={errorOf('bio')}
            testID="profile-bio"
          />
        )}
      />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="bodyStrong">{t.interests}</AppText>
        <Controller
          control={control}
          name="interests"
          render={({ field: f }) => {
            const value = f.value ?? [];
            const full = value.length >= INTERESTS_MAX;
            return (
              <View
                role="group"
                aria-label={t.interests}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
              >
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
                        f.onChange(selected ? value.filter((v) => v !== key) : [...value, key])
                      }
                      testID={`interest-${key}`}
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
          testID="profile-interests-hint"
        >
          {errorOf('interests') ??
            (chosen.length >= INTERESTS_MAX
              ? t.interestsLimit(INTERESTS_MAX)
              : t.interestsHint(chosen.length, INTERESTS_MAX))}
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="bodyStrong">{t.communication}</AppText>
        <Controller
          control={control}
          name="communicationStyle"
          render={({ field: f }) => (
            <RadioGroup<CommunicationStyle>
              label={t.communication}
              options={communicationStyles.map((value) => ({
                value,
                label: communicationStyleLabels[value],
              }))}
              value={f.value}
              onChange={f.onChange}
              testID="profile-style"
            />
          )}
        />
        {errorOf('communicationStyle') ? (
          <AppText variant="caption" tone="danger" role="alert">
            {errorOf('communicationStyle')}
          </AppText>
        ) : null}
      </View>
    </StepScreen>
  );
}
