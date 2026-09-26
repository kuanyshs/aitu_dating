import { useSession } from '@/data/hooks';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
import { Screen } from '@/ui/components/Screen';
import { strings } from '@/ui/strings';

export default function ActivityScreen() {
  const session = useSession();
  const { title, text } = strings.placeholder.activity;
  if (session.data?.accessState !== 'ACTIVE_MEMBER') {
    return (
      <Screen testID="screen-activity">
        <AccessPrompt text={strings.access.prompt.activity} testID="activity-access-prompt" />
      </Screen>
    );
  }
  return <PlaceholderScreen title={title} text={text} testID="screen-activity" />;
}
