import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { PHOTO_LIMITS, type MyProfile } from '@/contracts';
import { useMyProfile, useUpdateMyPhotos } from '@/data/hooks';
import { PhotoSlotsEditor } from '@/features/photo/PhotoSlotsEditor';
import { usePhotoSlots } from '@/features/photo/usePhotoSlots';
import { ActionSheet } from '@/ui/components/ActionSheet';
import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';

const t = strings.photo.profile;

/** «Фото профиля»: up to four, the first one main; every change is saved at once. */
export default function ProfilePhotosScreen() {
  const me = useMyProfile(true);
  return (
    <Screen testID="screen-profile-photos" withTabBar={false}>
      <SheetHeader title={t.title} closeLabel={t.close} testID="profile-photos-close" />
      {me.data ? <Editor me={me.data} /> : <FeedSkeleton rows={1} />}
    </Screen>
  );
}

function Editor({ me }: { me: MyProfile }) {
  const slots = usePhotoSlots(PHOTO_LIMITS.profile, me.photos);
  const save = useUpdateMyPhotos();
  const [removing, setRemoving] = useState<string | undefined>(undefined);

  // Save whenever the stored set or its order changes and nothing is still uploading.
  const saved = useRef(me.photos.map((p) => p.id).join(','));
  const ids = slots.photoIds.join(',');
  const { mutate } = save;
  useEffect(() => {
    if (slots.busy || ids === saved.current) return;
    saved.current = ids;
    mutate(ids ? ids.split(',') : []);
  }, [ids, slots.busy, mutate]);

  const remove = (key: string) => {
    const slot = slots.slots.find((s) => s.key === key);
    // An upload in progress is just cancelled; a stored Фото is removed after a confirmation.
    if (slot?.status === 'done') setRemoving(key);
    else slots.remove(key);
  };

  return (
    <View style={{ gap: spacing.md }}>
      <AppText tone="textMuted">{t.hint}</AppText>
      <PhotoSlotsEditor
        slots={slots.slots}
        max={PHOTO_LIMITS.profile}
        onAdd={slots.add}
        onRemove={remove}
        onMove={slots.move}
        onRetry={slots.retry}
        onMakeMain={slots.makeFirst}
        firstIsMain
        testID="profile-photos"
      />
      {save.isError ? (
        <AppText tone="danger" role="alert" testID="profile-photos-error">
          {t.saveFailed}
        </AppText>
      ) : null}
      <ActionSheet
        visible={!!removing}
        title={t.removeTitle}
        message={t.removeText}
        actions={[
          {
            label: t.removeConfirm,
            danger: true,
            onPress: () => {
              if (removing) slots.remove(removing);
              setRemoving(undefined);
            },
            testID: 'sheet-confirm-remove-photo',
          },
        ]}
        onClose={() => setRemoving(undefined)}
        testID="profile-photos-sheet"
      />
    </View>
  );
}
