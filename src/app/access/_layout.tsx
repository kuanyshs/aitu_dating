import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';

import { useSession } from '@/data/hooks';

/**
 * The access flow: one modal stack of step screens, each a real route. It exists for
 * guests only; a member reaching it (back navigation, an old link) goes to Home.
 */
export default function AccessLayout() {
  const session = useSession();
  // Decided on the first known session only: publishing the card turns this very visitor
  // into a member, and the last step must still finish (toast, then Home) on its own.
  const [openedAs, setOpenedAs] = useState<string | undefined>(undefined);
  const state = session.data?.accessState;
  if (openedAs === undefined && state !== undefined) setOpenedAs(state);
  if ((openedAs ?? state) !== undefined && (openedAs ?? state) !== 'GUEST_PREVIEW') {
    return <Redirect href="/" />;
  }
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
