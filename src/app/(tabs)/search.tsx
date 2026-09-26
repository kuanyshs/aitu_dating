import { PlaceholderScreen } from '@/ui/components/PlaceholderScreen';
import { strings } from '@/ui/strings';

export default function SearchScreen() {
  const { title, text } = strings.placeholder.search;
  return <PlaceholderScreen title={title} text={text} testID="screen-search" />;
}
