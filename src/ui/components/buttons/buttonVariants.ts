import type { ColorTokens } from '@/ui/theme/palette';

export type ButtonVariant = 'primary' | 'secondary' | 'text';
export type ButtonVisualState = 'default' | 'pressed' | 'disabled';

type ColorKey = keyof ColorTokens;

export type ButtonColors = {
  background: ColorKey | null;
  foreground: ColorKey;
  border: ColorKey | null;
};

/** Token keys per variant and state; also feeds the contrast test. */
export const buttonVariants: Record<ButtonVariant, Record<ButtonVisualState, ButtonColors>> = {
  primary: {
    default: { background: 'primary', foreground: 'onPrimary', border: null },
    pressed: { background: 'primaryPressed', foreground: 'onPrimary', border: null },
    disabled: { background: 'disabledBg', foreground: 'disabledText', border: null },
  },
  secondary: {
    default: { background: 'surface', foreground: 'text', border: 'line' },
    pressed: { background: 'surfacePressed', foreground: 'text', border: 'line' },
    disabled: { background: 'disabledBg', foreground: 'disabledText', border: 'line' },
  },
  text: {
    default: { background: null, foreground: 'text', border: null },
    pressed: { background: 'surfacePressed', foreground: 'text', border: null },
    disabled: { background: null, foreground: 'disabledText', border: null },
  },
};
