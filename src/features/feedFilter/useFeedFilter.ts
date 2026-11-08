import { emptyFeedFilters, safeFeedFilters, type FeedFilters } from '@/contracts';
import { useFeedFilters, useSession, useUpdateFeedFilters } from '@/data/hooks';
import { useSettings } from '@/settings';

/**
 * The one filter of «Поиск» and «Мои подписки»: a member's lives with their account, a
 * guest's on this device. `apply` saves it either way; `onDone` runs once it is kept.
 * `filters` is what works now: someone in the Безопасный вид filters by Пол, возраст and
 * place only, while `stored` keeps everything chosen for when full access returns.
 */
export function useFeedFilter() {
  const session = useSession();
  const accessState = session.data?.accessState;
  const hasCard = accessState === 'ACTIVE_MEMBER' || accessState === 'ACTIVE_MEMBER_EXPIRED';
  const full = accessState === 'ACTIVE_MEMBER';
  const saved = useFeedFilters(hasCard);
  const guestFilters = useSettings((s) => s.guestFilters);
  const setGuestFilters = useSettings((s) => s.setGuestFilters);
  const update = useUpdateFeedFilters();

  const stored: FeedFilters | undefined = !session.data
    ? undefined
    : hasCard
      ? saved.data
      : (guestFilters ?? emptyFeedFilters());
  const filters = stored && !full ? safeFeedFilters(stored) : stored;

  const apply = (next: FeedFilters, onDone?: () => void) => {
    if (!hasCard) {
      setGuestFilters(next);
      onDone?.();
      return;
    }
    update.mutate(next, { onSuccess: () => onDone?.() });
  };

  return {
    hasCard,
    full,
    filters,
    stored,
    /** What a guest sends with each feed request; a member's is read on the server. */
    requestFilters: hasCard ? undefined : (guestFilters ?? undefined),
    apply,
    saving: update.isPending,
    failed: update.isError,
  };
}
