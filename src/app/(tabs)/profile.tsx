import { useRouter } from 'expo-router';

import { TextButton } from '@/ui/components/buttons';
import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
import { strings } from '@/ui/strings';

export default function ProfileScreen() {
  const router = useRouter();
  const { title, text } = strings.placeholder.profile;
  return (
    <PlaceholderScreen title={title} text={text} testID="screen-profile">
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
    </PlaceholderScreen>
  );
}
