import { forwardRef } from 'react';
import { TextInput, View, type TextInput as TextInputType } from 'react-native';

import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { AppText } from './Text';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength: number;
  error?: string;
  testID?: string;
};

/** Multiline field with a live «n / max» counter and an inline error under it. */
export const TextArea = forwardRef<TextInputType, Props>(function TextArea(
  { label, value, onChangeText, onBlur, placeholder, maxLength, error, testID },
  ref,
) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        ref={ref}
        multiline
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        maxLength={maxLength}
        aria-label={label}
        aria-invalid={!!error}
        testID={testID}
        style={[styles.input, error ? styles.inputError : null]}
      />
      <View style={styles.meta}>
        <AppText
          variant="caption"
          tone="danger"
          role={error ? 'alert' : undefined}
          style={styles.error}
        >
          {error ?? ''}
        </AppText>
        <AppText
          variant="caption"
          tone="textMuted"
          testID={testID ? `${testID}-counter` : undefined}
        >
          {`${value.length} / ${maxLength}`}
        </AppText>
      </View>
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  root: { gap: spacing.xs },
  input: {
    ...typography.body,
    minHeight: 96,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    backgroundColor: colors.bg,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.danger },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  error: { flex: 1 },
}));
