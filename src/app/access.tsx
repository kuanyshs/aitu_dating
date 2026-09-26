import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: the access flow replaces this in ticket 04.
export default function AccessScreen() {
  return <StubScreen {...strings.stub.access} testID="screen-access" />;
}
