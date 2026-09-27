import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, type ReactNode } from 'react';

import { QueryProvider } from '@/data/QueryProvider';
import { RepositoryProvider } from '@/data/RepositoryProvider';
import { hydrateSettings, useSettings } from '@/settings';
import { SessionGate } from '@/features/restriction/SessionGate';
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
            <SessionGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="ui-kit" />
                <Stack.Screen name="access" options={{ presentation: 'modal' }} />
                <Stack.Screen name="about" options={{ presentation: 'modal' }} />
                <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
                {/* Full-screen surfaces. */}
                <Stack.Screen name="post/[id]" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="member/[id]" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="plan/[id]" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="reply" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="compose" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="chats/index" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="chats/[id]" options={{ presentation: 'fullScreenModal' }} />
                {/* Sheets. */}
                <Stack.Screen name="safety" options={{ presentation: 'modal' }} />
                <Stack.Screen name="membership" options={{ presentation: 'modal' }} />
                <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
                <Stack.Screen name="report" options={{ presentation: 'modal' }} />
                <Stack.Screen name="menu" options={{ presentation: 'modal' }} />
                <Stack.Screen name="renew" options={{ presentation: 'modal' }} />
                <Stack.Screen name="card-edit" options={{ presentation: 'modal' }} />
                <Stack.Screen name="moderator" options={{ presentation: 'modal' }} />
              </Stack>
            </SessionGate>
            <AppStatus />
          </ThemedNavigation>
        </ThemeProvider>
      </QueryProvider>
    </RepositoryProvider>
  );
}
