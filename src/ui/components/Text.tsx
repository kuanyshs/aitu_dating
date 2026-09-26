import { Text as RNText, type TextProps } from 'react-native';

import type { ColorTokens } from '@/ui/theme/palette';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { typography, type TypographyVariant } from '@/ui/theme/tokens';

type Tone = Extract<keyof ColorTokens, 'text' | 'textMuted' | 'danger' | 'onPrimary'>;

type Props = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
};

export function AppText({ variant = 'body', tone = 'text', style, ...rest }: Props) {
  const { colors } = useTheme();
  return <RNText style={[typography[variant], { color: colors[tone] }, style]} {...rest} />;
}
