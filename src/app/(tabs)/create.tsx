import { useRouter } from 'expo-router';

import { useSession } from '@/data/hooks';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
import { Screen } from '@/ui/components/Screen';
import { strings } from '@/ui/strings';

export default function CreateScreen() {
  const session = useSession();
  const router = useRouter();
  const { title } = strings.placeholder.create;
  if (session.data?.accessState !== 'ACTIVE_MEMBER') {
    return (
      <Screen testID="screen-create">
        <AccessPrompt text={strings.access.prompt.create} testID="create-access-prompt" />
      </Screen>
    );
  }
  // The tab bar opens the editor straight away; a link to the tab shows the way in.
  return (
    <PlaceholderScreen title={title} text={strings.compose.writeText} testID="screen-create">
      <PrimaryButton
        label={strings.compose.write}
        onPress={() => router.push('/compose')}
        testID="create-write"
      />
      <SecondaryButton
        label={strings.planNew.open}
        onPress={() => router.push('/plan/new')}
        testID="create-plan"
      />
    </PlaceholderScreen>
  );
}
