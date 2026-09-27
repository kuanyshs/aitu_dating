import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: creating a plan arrives with the plans spec.
export default function NewPlanScreen() {
  return <StubScreen {...strings.stub.newPlan} testID="screen-new-plan" />;
}
