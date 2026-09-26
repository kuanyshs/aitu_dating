import { useSession } from '@/data/hooks';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
import { Screen } from '@/ui/components/Screen';
import { strings } from '@/ui/strings';

export default function CreateScreen() {
  const session = useSession();
  const { title, text } = strings.placeholder.create;
  if (session.data?.accessState !== 'ACTIVE_MEMBER') {
    return (
      <Screen testID="screen-create">
        <AccessPrompt text={strings.access.prompt.create} testID="create-access-prompt" />
      </Screen>
    );
  }
  return <PlaceholderScreen title={title} text={text} testID="screen-create" />;
}
