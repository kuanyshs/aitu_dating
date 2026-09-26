import { Pressable, View } from 'react-native';

import { Check } from '@/ui/icons';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { AppText } from './Text';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testID?: string;
};

/** Explicit consent box; checked state is a tick mark, not just colour. */
export function Checkbox({ label, checked, onChange, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      testID={testID}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Check size={16} color={colors.onPrimary} strokeWidth={3} /> : null}
      </View>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTouch },
  pressed: { opacity: 0.7 },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm - 2,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { flex: 1 },
}));
