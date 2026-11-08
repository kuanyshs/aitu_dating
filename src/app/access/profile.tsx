import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { communicationStyleLabels, communicationStyles, type CommunicationStyle } from '@/catalogs';
import { BIO_MAX, isRepositoryError, PHOTO_LIMITS, ProfileStepInput } from '@/contracts';
import { useSaveProfileStep } from '@/data/hooks';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, stepRoute } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { PhotoSlotsEditor } from '@/features/photo/PhotoSlotsEditor';
import { usePhotoSlots } from '@/features/photo/usePhotoSlots';
import { PrimaryButton } from '@/ui/components/buttons';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { TextArea } from '@/ui/components/TextArea';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';

type FieldName = Exclude<keyof ProfileStepInput, 'showSurname' | 'photoIds'>;

const empty: ProfileStepInput = {
  bio: '',
  communicationStyle: undefined as never,
  showSurname: false,
};

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

  const surname = flow.data?.candidate?.surname;
  const photos = usePhotoSlots(PHOTO_LIMITS.profile);
  // Coming back to this step shows the Фото already chosen.
  const draftPhotos = flow.data?.photos;
  const { reset: resetPhotos } = photos;
  useEffect(() => {
    if (draftPhotos) resetPhotos(draftPhotos);
  }, [draftPhotos, resetPhotos]);

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      { ...values, photoIds: photos.photoIds },
      {
        onSuccess: (next) => router.replace(stepRoute(next.step) as Href),
        onError: (error) => {
          if (!isRepositoryError(error) || !error.fieldErrors) return;
          for (const key of Object.keys(error.fieldErrors)) {
            const name = key.replace('profile.', '') as FieldName;
            if (name in t.errors) setError(name, { message: t.errors[name] });
          }
        },
      },
    ),
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
            disabled={!formState.isValid || photos.busy}
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

      <View style={{ gap: spacing.sm }}>
        <AppText variant="bodyStrong">{strings.photo.profile.title}</AppText>
        <AppText variant="caption" tone="textMuted">
          {strings.photo.profile.hint}
        </AppText>
        <PhotoSlotsEditor
          slots={photos.slots}
          max={PHOTO_LIMITS.profile}
          onAdd={photos.add}
          onRemove={photos.remove}
          onMove={photos.move}
          onRetry={photos.retry}
          onMakeMain={photos.makeFirst}
          firstIsMain
          testID="profile-step-photos"
        />
      </View>

      {surname ? (
        <Controller
          control={control}
          name="showSurname"
          render={({ field: f }) => (
            <ToggleRow
              label={t.showSurname}
              hint={t.showSurnameHint(surname)}
              value={!!f.value}
              onChange={f.onChange}
              testID="profile-show-surname"
            />
          )}
        />
      ) : null}
    </StepScreen>
  );
}
