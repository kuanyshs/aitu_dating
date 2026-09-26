import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
import { strings } from '@/ui/strings';

export default function HomeScreen() {
  const { title, text } = strings.placeholder.home;
  return <PlaceholderScreen title={title} text={text} testID="screen-home" />;
}
