import { useRouter } from 'expo-router';
import { Image, Pressable, View } from 'react-native';

import type { PhotoRef } from '@/contracts';
import { useSession } from '@/data/hooks';
import { AppText } from '@/ui/components/Text';
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

/**
 * Фото in a row; a tap opens them on the whole screen. A blurred one (the viewer may not
 * see it, and only got a tiny stand-in) stays blurred and leads to verification instead.
 */
export function PhotoGallery({ photos, testID, height = 220 }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const show = usePhotoViewer((s) => s.show);
  const expired = useSession().data?.accessState === 'ACTIVE_MEMBER_EXPIRED';
  if (photos.length === 0) return null;
  const visible = photos.filter((p) => !p.blurred);
  return (
    <View style={styles.row} testID={testID}>
      {photos.map((photo, index) => (
        <View key={photo.id} style={styles.column}>
          <Pressable
            role="button"
            aria-label={
              photo.blurred ? strings.photo.blurred : strings.photo.open(index + 1, photos.length)
            }
            onPress={() => {
              if (photo.blurred) {
                router.push(expired ? '/renew' : '/access');
                return;
              }
              show(visible, visible.indexOf(photo));
              router.push('/photo');
            }}
            style={[styles.cell, { height }]}
            testID={`${testID}-${index}`}
          >
            <Image
              source={{ uri: photo.url }}
              style={styles.image}
              resizeMode="cover"
              blurRadius={photo.blurred ? 18 : undefined}
              accessibilityIgnoresInvertColors
              testID={photo.blurred ? `${testID}-${index}-blurred` : undefined}
            />
            {photo.blurred ? (
              <View style={styles.veil} pointerEvents="none">
                <AppText variant="caption" style={styles.veilText}>
                  {strings.photo.blurred}
                </AppText>
              </View>
            ) : null}
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
  veil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    backgroundColor: colors.viewerBg,
    opacity: 0.85,
  },
  veilText: { color: colors.onViewer, textAlign: 'center' },
}));
