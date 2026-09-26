import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Temporary: the chat arrives with the chats and activity spec.
export default function ChatScreen() {
  return <StubScreen {...strings.stub.chat} testID="screen-chat" />;
}
