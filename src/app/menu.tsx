import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useLogout, useSession } from '@/data/hooks';
import { IconAction } from '@/ui/components/buttons';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/Text';
import { X } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { minTouch, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

/** Home menu sheet: product info, settings and, for members, «Выйти в preview». */
export default function MenuScreen() {
  const styles = useStyles();
  const router = useRouter();
  const session = useSession();
  const logout = useLogout();
  const toast = useToast((s) => s.show);
  const isMember = session.data?.accessState !== 'GUEST_PREVIEW' && !!session.data?.userId;
  const isModerator = !!session.data?.roles.includes('moderator');

  const go = (href: Href) => router.replace(href);

  return (
    <Screen testID="screen-menu" withTabBar={false}>
      <View style={styles.header}>
        <AppText variant="display" role="heading">
          {strings.menu.title}
        </AppText>
        <IconAction
          icon={X}
          accessibilityLabel={strings.settings.close}
          onPress={() => router.back()}
          testID="menu-close"
        />
      </View>
      <MenuRow label={strings.menu.about} onPress={() => go('/about')} testID="menu-about" />
      <MenuRow
        label={strings.menu.settings}
        onPress={() => go('/settings')}
        testID="menu-settings"
      />
      <MenuRow label={strings.menu.safety} onPress={() => go('/safety')} testID="menu-safety" />
      {isMember ? (
        <>
          <MenuRow
            label={strings.menu.messages}
            onPress={() => go('/chats')}
            testID="menu-messages"
          />
          <MenuRow
            label={strings.menu.membership}
            onPress={() => go('/membership')}
            testID="menu-membership"
          />
          <MenuRow
            label={strings.menu.activity}
            // A tab: close the menu and switch to it, not a second copy of the tabs.
            onPress={() => router.dismissTo('/activity')}
            testID="menu-activity"
          />
        </>
      ) : null}
      {isModerator ? (
        <MenuRow
          label={strings.menu.moderator}
          onPress={() => go('/moderator')}
          testID="menu-moderator"
        />
      ) : null}
      {isMember ? (
        <MenuRow
          label={strings.session.logout}
          accessibilityLabel={strings.session.logoutLabel}
          danger
          onPress={() =>
            logout.mutate(undefined, {
              onSuccess: () => {
                toast(strings.session.loggedOut);
                router.dismissTo('/');
              },
              onError: () => toast(strings.session.failed),
            })
          }
          testID="menu-logout"
        />
      ) : null}
    </Screen>
  );
}

function MenuRow({
  label,
  accessibilityLabel,
  onPress,
  danger,
  testID,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  danger?: boolean;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel ?? label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <AppText variant="bodyStrong" tone={danger ? 'danger' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: {
    minHeight: minTouch + 8,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.surfacePressed },
}));
