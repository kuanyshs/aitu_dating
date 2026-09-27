import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useSession } from '@/data/hooks';
import { socialGate } from '@/features/post/socialGate';

import { FloatingTabBar } from '@/ui/navigation/FloatingTabBar';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const accessState = useSession().data?.accessState;
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: strings.tabs.index }} />
      <Tabs.Screen name="search" options={{ title: strings.tabs.search }} />
      <Tabs.Screen
        name="create"
        options={{ title: strings.tabs.create }}
        listeners={{
          tabPress: (event) => {
            // Members go straight to the editor; everyone else sees why they cannot yet.
            if (socialGate(accessState) !== 'allow') return;
            event.preventDefault();
            router.push('/compose');
          },
        }}
      />
      <Tabs.Screen name="activity" options={{ title: strings.tabs.activity }} />
      <Tabs.Screen name="profile" options={{ title: strings.tabs.profile }} />
    </Tabs>
  );
}
