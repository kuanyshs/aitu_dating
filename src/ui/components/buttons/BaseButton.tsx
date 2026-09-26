import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorTokens } from '@/ui/theme/palette';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch } from '@/ui/theme/tokens';

import { buttonVariants, type ButtonVariant, type ButtonVisualState } from './buttonVariants';

export type BaseButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

type Props = BaseButtonProps & {
  variant: ButtonVariant;
  shape: StyleProp<ViewStyle>;
  /** Renders the content in the resolved foreground color. */
  children: (foreground: string) => ReactNode;
};

function colorOf(colors: ColorTokens, key: keyof ColorTokens | null): string | undefined {
  return key ? colors[key] : undefined;
}

/**
 * Shared press/disabled/loading behaviour. Loading keeps the content in place
 * (invisible) so the button does not change width, and ignores presses.
 */
export function BaseButton({
  onPress,
  accessibilityLabel,
  disabled = false,
  loading = false,
  testID,
  style,
  variant,
  shape,
  children,
}: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel}
      aria-disabled={disabled}
      aria-busy={loading}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => {
        const state: ButtonVisualState = disabled ? 'disabled' : pressed ? 'pressed' : 'default';
        const tokens = buttonVariants[variant][state];
        const borderColor = colorOf(colors, tokens.border);
        return [
          { minHeight: minTouch, alignItems: 'center', justifyContent: 'center' },
          shape,
          {
            backgroundColor: colorOf(colors, tokens.background) ?? 'transparent',
            borderColor,
            borderWidth: borderColor ? 1 : 0,
          },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const state: ButtonVisualState = disabled ? 'disabled' : pressed ? 'pressed' : 'default';
        const foreground = colors[buttonVariants[variant][state].foreground];
        return (
          <>
            <View style={{ opacity: loading ? 0 : 1, flexDirection: 'row', alignItems: 'center' }}>
              {children(foreground)}
            </View>
            {loading ? (
              <ActivityIndicator color={foreground} style={{ position: 'absolute' }} />
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}
