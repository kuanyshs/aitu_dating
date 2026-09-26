import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useMyProfile, useSession } from '@/data/hooks';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { TextButton } from '@/ui/components/buttons';
import { ProfileCardView } from '@/ui/components/ProfileCardView';
import { Screen } from '@/ui/components/Screen';
import { strings } from '@/ui/strings';
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
  const isMember = session.data?.accessState === 'ACTIVE_MEMBER';
  const me = useMyProfile(isMember);
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
      {me.data ? <ProfileCardView me={me.data} /> : null}
      <ProfileLinks />
    </Screen>
  );
}
