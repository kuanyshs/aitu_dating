import { useRouter } from 'expo-router';
import { Image, Pressable, View } from 'react-native';

import type { PhotoRef } from '@/contracts';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { AiLabel } from './AiLabel';
import { usePhotoViewer } from './viewer';

type Props = {
  photos: PhotoRef[];
  testID: string;
  /** Height of each picture; one Фото takes the whole row. */
  height?: number;
};

/** Фото in a row; a tap opens them on the whole screen. */
export function PhotoGallery({ photos, testID, height = 220 }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const show = usePhotoViewer((s) => s.show);
  if (photos.length === 0) return null;
  return (
    <View style={styles.row} testID={testID}>
      {photos.map((photo, index) => (
        <View key={photo.id} style={styles.column}>
          <Pressable
            role="button"
            aria-label={strings.photo.open(index + 1, photos.length)}
            onPress={() => {
              show(photos, index);
              router.push('/photo');
            }}
            style={[styles.cell, { height }]}
            testID={`${testID}-${index}`}
          >
            <Image
              source={{ uri: photo.url }}
              style={styles.image}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
          <AiLabel ai={photo.ai} testID={`${testID}-${index}-ai`} />
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: 'row', gap: spacing.xs },
  column: { flex: 1, gap: spacing.xs },
  cell: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  image: { width: '100%', height: '100%' },
}));
