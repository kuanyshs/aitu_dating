import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
import { strings } from '@/ui/strings';

export default function ActivityScreen() {
  const { title, text } = strings.placeholder.activity;
  return <PlaceholderScreen title={title} text={text} testID="screen-activity" />;
}
