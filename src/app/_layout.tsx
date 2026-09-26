import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, type ReactNode } from 'react';

import { QueryProvider } from '@/data/QueryProvider';
import { RepositoryProvider } from '@/data/RepositoryProvider';
import { hydrateSettings, useSettings } from '@/settings';
import { AppStatus } from '@/ui/components/AppStatus';
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
  const themePreference = useSettings((s) => s.themePreference);
  useEffect(() => {
    void hydrateSettings();
  }, []);

  return (
    <RepositoryProvider>
      <QueryProvider>
        <ThemeProvider preference={themePreference}>
          <ThemedNavigation>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="ui-kit" />
              <Stack.Screen name="access" options={{ presentation: 'modal' }} />
              <Stack.Screen name="about" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              <Stack.Screen name="chats" options={{ presentation: 'modal' }} />
              <Stack.Screen name="menu" options={{ presentation: 'modal' }} />
            </Stack>
            <AppStatus />
          </ThemedNavigation>
        </ThemeProvider>
      </QueryProvider>
    </RepositoryProvider>
  );
}
