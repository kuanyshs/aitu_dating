import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '@/data/hooks';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { TextButton } from '@/ui/components/buttons';
import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
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
  const { title, text } = strings.placeholder.profile;
  if (session.data?.accessState !== 'ACTIVE_MEMBER') {
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
    <PlaceholderScreen title={title} text={text} testID="screen-profile">
      <ProfileLinks />
    </PlaceholderScreen>
  );
}
