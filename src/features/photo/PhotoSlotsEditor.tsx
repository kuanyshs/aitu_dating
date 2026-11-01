import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { AppText } from '@/ui/components/Text';
import { ChevronLeft, ChevronRight, Plus, X } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import type { PhotoSlot } from './usePhotoSlots';

type Props = {
  slots: PhotoSlot[];
  max: number;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  onRetry: (key: string) => void;
  /** Marks the first Фото as the main one (the profile's avatar). */
  firstIsMain?: boolean;
  testID: string;
};

const t = strings.photo;

/** Picked Фото before they are used: preview, order, remove, retry, and «Добавить фото». */
export function PhotoSlotsEditor({
  slots,
  max,
  onAdd,
  onRemove,
  onMove,
  onRetry,
  firstIsMain,
  testID,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const icon = (Icon: typeof X) => <Icon size={18} color={colors.onViewer} />;
  const button = (label: string, Icon: typeof X, onPress: () => void, id: string) => (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      hitSlop={6}
      style={styles.overlayButton}
      testID={id}
    >
      {icon(Icon)}
    </Pressable>
  );

  return (
    <View style={styles.grid} testID={testID}>
      {slots.map((slot, index) => (
        <View key={slot.key} style={styles.cell} testID={`${testID}-slot-${index}`}>
          <Image
            source={{ uri: slot.preview }}
            style={[styles.image, slot.status !== 'done' && styles.dimmed]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          {slot.status === 'uploading' ? (
            <View style={styles.center} role="status" aria-label={t.uploading}>
              <ActivityIndicator color={colors.onViewer} />
            </View>
          ) : null}
          {slot.status === 'error' ? (
            <Pressable
              role="button"
              aria-label={t.retry}
              onPress={() => onRetry(slot.key)}
              style={styles.center}
              testID={`${testID}-retry-${index}`}
            >
              <AppText variant="caption" style={styles.onImage}>
                {t.failed}
              </AppText>
              <AppText variant="bodyStrong" style={styles.onImage}>
                {t.retry}
              </AppText>
            </Pressable>
          ) : null}
          <View style={styles.topRow}>
            {firstIsMain && index === 0 && slot.status === 'done' ? (
              <View style={styles.badge} testID={`${testID}-main`}>
                <AppText variant="caption" tone="onPrimary">
                  {t.main}
                </AppText>
              </View>
            ) : (
              <View />
            )}
            {button(
              slot.status === 'uploading' ? t.cancel : t.remove,
              X,
              () => onRemove(slot.key),
              `${testID}-remove-${index}`,
            )}
          </View>
          {slots.length > 1 ? (
            <View style={styles.bottomRow}>
              {index > 0 ? (
                button(
                  t.earlier,
                  ChevronLeft,
                  () => onMove(slot.key, -1),
                  `${testID}-earlier-${index}`,
                )
              ) : (
                <View />
              )}
              {index < slots.length - 1 ? (
                button(t.later, ChevronRight, () => onMove(slot.key, 1), `${testID}-later-${index}`)
              ) : (
                <View />
              )}
            </View>
          ) : null}
        </View>
      ))}
      {slots.length < max ? (
        <Pressable
          role="button"
          aria-label={t.addMore(max - slots.length)}
          onPress={onAdd}
          style={[styles.cell, styles.add]}
          testID={`${testID}-add`}
        >
          <Plus size={22} color={colors.text} />
          <AppText variant="caption" tone="textMuted">
            {t.limit(max)}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const SIZE = 104;

const useStyles = createStyles((colors) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: { width: '100%', height: '100%' },
  dimmed: { opacity: 0.5 },
  center: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
    gap: 2,
  },
  onImage: { color: colors.onViewer, textAlign: 'center' },
  topRow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bottomRow: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlayButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  badge: {
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.bg,
    minHeight: minTouch,
  },
}));
