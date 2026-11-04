import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Tabs } from 'expo-router/js-tabs';

import { useHasNewActivity, useSession, useUnreadMessages } from '@/data/hooks';
import { socialGate } from '@/features/post/socialGate';

import { ActionSheet } from '@/ui/components/ActionSheet';
import { FloatingTabBar } from '@/ui/navigation/FloatingTabBar';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const accessState = useSession().data?.accessState;
  const hasCard = accessState === 'ACTIVE_MEMBER' || accessState === 'ACTIVE_MEMBER_EXPIRED';
  const hasNew = useHasNewActivity(hasCard);
  const unread = useUnreadMessages(hasCard);
  // «＋» offers exactly two things to create; the sheet closes before the editor opens.
  const [creating, setCreating] = useState(false);
  const open = (href: '/compose' | '/meeting/new') => {
    setCreating(false);
    router.push(href);
  };
  return (
    <>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar {...props} dots={{ activity: hasNew }} counts={{ chats: unread }} />
        )}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="index" options={{ title: strings.tabs.index }} />
        <Tabs.Screen name="chats" options={{ title: strings.tabs.chats }} />
        <Tabs.Screen
          name="create"
          options={{ title: strings.tabs.create }}
          listeners={{
            tabPress: (event) => {
              // Members choose what to create; everyone else sees why they cannot yet.
              if (socialGate(accessState) !== 'allow') return;
              event.preventDefault();
              setCreating(true);
            },
          }}
        />
        <Tabs.Screen name="activity" options={{ title: strings.tabs.activity }} />
        <Tabs.Screen name="profile" options={{ title: strings.tabs.profile }} />
      </Tabs>
      <ActionSheet
        visible={creating}
        title={strings.create.title}
        actions={[
          { label: strings.create.post, onPress: () => open('/compose'), testID: 'create-post' },
          {
            label: strings.create.plan,
            onPress: () => open('/meeting/new'),
            testID: 'create-plan',
          },
        ]}
        onClose={() => setCreating(false)}
        testID="create-sheet"
      />
    </>
  );
}
