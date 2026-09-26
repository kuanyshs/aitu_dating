import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: card editing arrives with the profile spec. Open to active and expired members.
export default function CardEditScreen() {
  return <StubScreen {...strings.stub.editCard} testID="screen-card-edit" />;
}
