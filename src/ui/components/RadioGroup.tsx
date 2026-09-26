import { Pressable, View } from 'react-native';

import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { AppText } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
};

/** Single choice list; the selected item shows a filled dot, not just a colour change. */
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: Props<T>) {
  const styles = useStyles();
  return (
    <View role="radiogroup" aria-label={label} testID={testID} style={styles.group}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            testID={testID ? `${testID}-${option.value}` : undefined}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.divided,
              pressed && styles.pressed,
            ]}
          >
            <AppText style={styles.label}>{option.label}</AppText>
            <View style={[styles.ring, selected && styles.ringSelected]}>
              {selected ? <View style={styles.dot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  group: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    minHeight: minTouch + 8,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.surfacePressed },
  label: { flex: 1 },
  ring: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSelected: { borderColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
}));
