import { Pressable, Text } from 'react-native';

import { minTouch, radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/** Pill filter; selection is shown by fill and weight, and exposed as a radio state. */
export function Chip({ label, selected, onPress, testID }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onPress={onPress}
      testID={testID}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  chip: {
    minHeight: minTouch - 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.bg, borderColor: colors.line },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { backgroundColor: colors.surfacePressed },
  label: { ...typography.body },
  labelIdle: { color: colors.text },
  labelSelected: { color: colors.onPrimary, fontWeight: '600' },
}));
