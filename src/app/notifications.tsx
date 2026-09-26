import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: notification settings arrive with the activity spec.
export default function NotificationsScreen() {
  return <StubScreen {...strings.stub.notifications} testID="screen-notifications" />;
}
