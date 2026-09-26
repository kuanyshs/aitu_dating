import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: the post with its thread and reply editor arrives with the post spec.
export default function PostScreen() {
  return <StubScreen {...strings.stub.post} testID="screen-post" />;
}
