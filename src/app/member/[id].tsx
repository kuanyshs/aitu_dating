import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: another member's profile arrives with the profile spec.
export default function MemberScreen() {
  return <StubScreen {...strings.stub.member} testID="screen-member" />;
}
