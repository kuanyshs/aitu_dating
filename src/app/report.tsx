import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: the report form arrives with the safety spec.
export default function ReportScreen() {
  return <StubScreen {...strings.stub.report} testID="screen-report" />;
}
