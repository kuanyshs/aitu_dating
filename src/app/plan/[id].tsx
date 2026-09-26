import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: plan detail and Отклики arrive with the plans spec.
export default function PlanScreen() {
  return <StubScreen {...strings.stub.plan} testID="screen-plan" />;
}
