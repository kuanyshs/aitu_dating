import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/ui/strings';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { AppText } from './Text';

export type SheetAction = {
  label: string;
  onPress: () => void;
  /** Destructive actions read in the danger tone. */
  danger?: boolean;
  testID?: string;
};

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
  testID?: string;
};

/**
 * The «•••» menu and its confirmations: a bottom sheet with actions and «Отмена».
 * Tapping outside or the system back closes it without doing anything.
 */
export function ActionSheet({ visible, title, message, actions, onClose, testID }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        aria-label={strings.sheet.close}
        testID={testID ? `${testID}-backdrop` : undefined}
      />
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        role="menu"
        testID={testID}
      >
        {title ? (
          <AppText variant="bodyStrong" role="heading" style={styles.center}>
            {title}
          </AppText>
        ) : null}
        {message ? (
          <AppText tone="textMuted" style={styles.center}>
            {message}
          </AppText>
        ) : null}
        {actions.map((action) => (
          <Pressable
            key={action.label}
            role="menuitem"
            aria-label={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID={action.testID}
          >
            <AppText variant="bodyStrong" tone={action.danger ? 'danger' : 'text'}>
              {action.label}
            </AppText>
          </Pressable>
        ))}
        <Pressable
          role="button"
          aria-label={strings.sheet.cancel}
          onPress={onClose}
          style={({ pressed }) => [styles.row, styles.cancel, pressed && styles.pressed]}
          testID={testID ? `${testID}-cancel` : undefined}
        >
          <AppText variant="bodyStrong" tone="textMuted">
            {strings.sheet.cancel}
          </AppText>
        </Pressable>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  center: { textAlign: 'center' },
  row: {
    minHeight: minTouch + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  cancel: { marginTop: spacing.xs },
  pressed: { backgroundColor: colors.surfacePressed },
}));
