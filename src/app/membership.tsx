import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: membership details arrive with the profile spec; Продление already works.
export default function MembershipScreen() {
  return <StubScreen {...strings.stub.membership} testID="screen-membership" />;
}
