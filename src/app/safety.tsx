import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: safety tips, blocks and reports arrive with the safety spec.
export default function SafetyScreen() {
  return <StubScreen {...strings.stub.safety} testID="screen-safety" />;
}
