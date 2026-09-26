import { DarkTheme, DefaultTheme } from 'expo-router';

import type { Theme } from './ThemeProvider';

type NavigationTheme = typeof DefaultTheme;

/** Maps app tokens onto the navigation theme so native containers match the screens. */
export function navigationTheme({ scheme, colors }: Theme): NavigationTheme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.line,
      notification: colors.danger,
    },
  };
}
