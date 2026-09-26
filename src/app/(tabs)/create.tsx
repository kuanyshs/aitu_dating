import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
import { strings } from '@/ui/strings';

export default function CreateScreen() {
  const { title, text } = strings.placeholder.create;
  return <PlaceholderScreen title={title} text={text} testID="screen-create" />;
}
