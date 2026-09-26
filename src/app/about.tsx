import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

export default function AboutScreen() {
  return <StubScreen {...strings.stub.about} testID="screen-about" />;
}
