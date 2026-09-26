import { buttonVariants } from '@/ui/components/buttons/buttonVariants';

import type { ColorTokens } from './palette';

type ColorKey = keyof ColorTokens;

export type ContrastPair = {
  foreground: ColorKey;
  background: ColorKey;
  /** 4.5 for normal text, 3 for UI components and graphics (WCAG 1.4.3 / 1.4.11). */
  min: number;
};

const TEXT = 4.5;
const UI = 3;

const textColors: ColorKey[] = ['text', 'textMuted', 'danger'];
const textBackgrounds: ColorKey[] = ['bg', 'surface', 'surfacePressed', 'tabBar'];

const buttonPairs: ContrastPair[] = Object.values(buttonVariants).flatMap((states) =>
  // Disabled controls are exempt from WCAG 1.4.3; transparent buttons sit on `bg`.
  [states.default, states.pressed].map((colors) => ({
    foreground: colors.foreground,
    background: colors.background ?? 'bg',
    min: TEXT,
  })),
);

// Excluded on purpose: `line` is decorative, disabled pairs are exempt, and
// `textMuted` is never drawn on `tabActive`.
export const contrastPairs: ContrastPair[] = [
  ...textColors.flatMap((foreground) =>
    textBackgrounds.map((background) => ({ foreground, background, min: TEXT })),
  ),
  { foreground: 'text', background: 'tabActive', min: TEXT },
  ...buttonPairs,
  { foreground: 'tabIcon', background: 'tabBar', min: UI },
  { foreground: 'tabIconActive', background: 'tabActive', min: UI },
  { foreground: 'primary', background: 'bg', min: UI },
];
