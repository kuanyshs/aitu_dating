import { Tabs } from 'expo-router/js-tabs';

import { FloatingTabBar } from '@/ui/navigation/FloatingTabBar';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: strings.tabs.index }} />
      <Tabs.Screen name="search" options={{ title: strings.tabs.search }} />
      <Tabs.Screen name="create" options={{ title: strings.tabs.create }} />
      <Tabs.Screen name="activity" options={{ title: strings.tabs.activity }} />
      <Tabs.Screen name="profile" options={{ title: strings.tabs.profile }} />
    </Tabs>
  );
}
