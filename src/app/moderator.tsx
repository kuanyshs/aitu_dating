import { Redirect } from 'expo-router';

import { useSession } from '@/data/hooks';
import { StubScreen } from '@/ui/components/StubScreen';
import { strings } from '@/ui/strings';

// Protected: only sessions with the moderator role; everyone else lands on Home.
// Temporary content: the moderation queue arrives with the moderation spec.
export default function ModeratorScreen() {
  const session = useSession();
  if (session.isPending) return null;
  const allowed =
    session.data?.roles.includes('moderator') && session.data.accessState !== 'BLOCKED';
  if (!allowed) return <Redirect href="/" />;
  return <StubScreen {...strings.stub.moderator} testID="screen-moderator" />;
}
