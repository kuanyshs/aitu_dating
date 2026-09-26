import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { ColorTokens } from './palette';
import { useTheme } from './ThemeProvider';

type NamedStyles<T> = StyleSheet.NamedStyles<T>;

/**
 * Declares a themed stylesheet once and returns a hook that rebuilds it only when
 * the color scheme changes.
 */
export function createStyles<T extends NamedStyles<T>>(factory: (colors: ColorTokens) => T) {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
