import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import type { OpenChatInput } from '@/contracts';
import { useOpenChat } from '@/data/hooks';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';

/**
 * «Написать»: opens the chat with that person from where the member is, then shows it.
 * The screen that asked may be gone by then, so the promise, not a per-call callback,
 * carries on.
 */
export function useWriteTo() {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const { mutateAsync, isPending } = useOpenChat();
  const write = useCallback(
    (input: OpenChatInput) =>
      mutateAsync(input).then(
        (chat) => router.push(`/chats/${chat.id}`),
        () => toast(strings.chat.writeFailed),
      ),
    [mutateAsync, router, toast],
  );
  return { write, isPending };
}
