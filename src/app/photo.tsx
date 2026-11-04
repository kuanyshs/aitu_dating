import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePhotoViewer } from '@/features/photo/viewer';
import { AppText } from '@/ui/components/Text';
import { ChevronLeft, ChevronRight, X } from '@/ui/icons';
import { AiLabel } from '@/features/photo/AiLabel';
import { strings } from '@/ui/strings';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';
import { useTheme } from '@/ui/theme/ThemeProvider';

const t = strings.photo.viewer;

/** One Фото on the whole screen, with «1 из N» and buttons to step through the set. */
export default function PhotoViewer() {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  const { photos, index: start } = usePhotoViewer();
  const [index, setIndex] = useState(start);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const photo = photos[index];

  const control = (
    label: string,
    Icon: typeof X,
    onPress: () => void,
    testID: string,
    disabled = false,
  ) => (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[styles.control, disabled && styles.disabled]}
      testID={testID}
    >
      <Icon size={24} color={colors.onViewer} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root} testID="screen-photo">
      <View style={styles.top}>
        <AppText style={styles.position} testID="photo-position">
          {photo ? t.position(index + 1, photos.length) : ''}
        </AppText>
        {control(t.close, X, close, 'photo-close')}
      </View>
      <View style={styles.stage}>
        {photo ? (
          <Image
            source={{ uri: photo.url }}
            style={styles.image}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            testID="photo-image"
          />
        ) : null}
        <AiLabel ai={photo?.ai} color={colors.onViewer} testID="photo-ai" />
      </View>
      {photos.length > 1 ? (
        <View style={styles.bottom}>
          {control(
            t.previous,
            ChevronLeft,
            () => setIndex(index - 1),
            'photo-previous',
            index === 0,
          )}
          {control(
            t.next,
            ChevronRight,
            () => setIndex(index + 1),
            'photo-next',
            index >= photos.length - 1,
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.viewerBg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  position: { color: colors.onViewer, paddingHorizontal: spacing.sm },
  stage: { flex: 1, justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  control: {
    minWidth: minTouch,
    minHeight: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  disabled: { opacity: 0.3 },
}));
