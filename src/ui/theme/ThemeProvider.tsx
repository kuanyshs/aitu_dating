import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palettes, type ColorTokens } from './palette';
import { resolveScheme, type ColorScheme, type ThemePreference } from './scheme';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  preference: ThemePreference;
};

const ThemeContext = createContext<Theme | null>(null);

type Props = {
  /** Controlled by the settings store later; defaults to following the OS. */
  preference?: ThemePreference;
  children: ReactNode;
};

export function ThemeProvider({ preference = 'system', children }: Props) {
  const system = useColorScheme();
  const scheme = resolveScheme(preference, system);
  const value = useMemo<Theme>(
    () => ({ scheme, colors: palettes[scheme], preference }),
    [scheme, preference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider');
  return theme;
}
