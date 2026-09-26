import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: contextual chats arrive with the chats and activity spec.
export default function ChatsScreen() {
  return <StubScreen {...strings.stub.chats} testID="screen-chats" />;
}
