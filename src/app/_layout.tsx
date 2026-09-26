import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, type ReactNode } from 'react';

import { QueryProvider } from '@/data/QueryProvider';
import { RepositoryProvider } from '@/data/RepositoryProvider';
import { navigationTheme } from '@/ui/theme/navigationTheme';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';

function ThemedNavigation({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg).catch(() => undefined);
  }, [theme.colors.bg]);

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <RepositoryProvider>
      <QueryProvider>
        <ThemeProvider>
          <ThemedNavigation>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="ui-kit" />
              <Stack.Screen name="access" options={{ presentation: 'modal' }} />
              <Stack.Screen name="about" options={{ presentation: 'modal' }} />
            </Stack>
          </ThemedNavigation>
        </ThemeProvider>
      </QueryProvider>
    </RepositoryProvider>
  );
}
