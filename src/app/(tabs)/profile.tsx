import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useLogout, useMyProfile, useProfile, useSession } from '@/data/hooks';
import { MyPlans } from '@/features/profile/MyPlans';
import { MyPosts } from '@/features/profile/MyPosts';
import { ProfileStats } from '@/features/profile/ProfileStats';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { TextButton } from '@/ui/components/buttons';
import { ProfileCardView } from '@/ui/components/ProfileCardView';
import { RenewBanner } from '@/ui/components/RenewBanner';
import { Screen } from '@/ui/components/Screen';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { spacing } from '@/ui/theme/tokens';

function ProfileLinks() {
  const router = useRouter();
  return (
    <View style={{ gap: spacing.xs, marginTop: spacing.lg }}>
      <TextButton
        label={strings.settings.open}
        onPress={() => router.push('/settings')}
        testID="open-settings"
      />
      <TextButton
        label={strings.uiKit.open}
        onPress={() => router.push('/ui-kit')}
        testID="open-ui-kit"
      />
    </View>
  );
}

export default function ProfileScreen() {
  const session = useSession();
  const state = session.data?.accessState;
  const isExpired = state === 'ACTIVE_MEMBER_EXPIRED';
  // An expired member keeps their own card in full; only other people are hidden.
  const isMember = state === 'ACTIVE_MEMBER' || isExpired;
  const me = useMyProfile(isMember);
  const own = useProfile(me.data?.id ?? '', { enabled: !!me.data });
  const router = useRouter();
  const logout = useLogout();
  const toast = useToast((s) => s.show);
  if (!isMember) {
    // Guests keep Settings: appearance and the demo panel must stay reachable.
    return (
      <Screen testID="screen-profile">
        <AccessPrompt text={strings.access.prompt.profile} testID="profile-access-prompt">
          <ProfileLinks />
        </AccessPrompt>
      </Screen>
    );
  }
  return (
    <Screen testID="screen-profile">
      {isExpired ? <RenewBanner testID="profile-renew-banner" /> : null}
      {me.data ? (
        <ProfileCardView
          me={me.data}
          stats={
            own.data ? (
              <ProfileStats
                memberId={me.data.id}
                stats={own.data.stats}
                openLists={state === 'ACTIVE_MEMBER'}
                testID="profile-stat"
              />
            ) : null
          }
        />
      ) : null}
      <TextButton
        label={strings.profile.editCard}
        onPress={() => router.push('/card-edit')}
        testID="profile-edit-card"
      />
      {me.data ? <MyPlans canCreate={!isExpired} /> : null}
      {me.data ? <MyPosts memberId={me.data.id} canWrite={!isExpired} /> : null}
      <ProfileLinks />
      <TextButton
        label={strings.session.logout}
        accessibilityLabel={strings.session.logoutLabel}
        onPress={() =>
          logout.mutate(undefined, {
            onSuccess: () => toast(strings.session.loggedOut),
            onError: () => toast(strings.session.failed),
          })
        }
        testID="profile-logout"
      />
    </Screen>
  );
}
