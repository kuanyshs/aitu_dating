import { Pressable, View } from 'react-native';

import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { AppText } from './Text';

type Props = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

/** On/off setting; state is shown by knob position and fill, and exposed as a switch. */
export function ToggleRow({ label, hint, value, onChange, disabled, testID }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      role="switch"
      aria-checked={value}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      testID={testID}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="textMuted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    minHeight: minTouch + 12,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  track: {
    width: 48,
    height: 28,
    borderRadius: radius.pill,
    padding: 3,
    backgroundColor: colors.surfacePressed,
    borderWidth: 1,
    borderColor: colors.line,
  },
  trackOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  knob: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.textMuted },
  knobOn: { backgroundColor: colors.onPrimary, transform: [{ translateX: 20 }] },
}));
