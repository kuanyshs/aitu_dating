import { meetingFormatLabels, settlementName } from '@/catalogs';
import type { Clock } from '@/clock';
import type { PlanSummary } from '@/contracts';
import { formatPlanDate } from '@/ui/format';
import { strings } from '@/ui/strings';

const t = strings.share;

/**
 * The one link to a Встреча: the app's own address, or the app's scheme when it was
 * opened from a file. Nothing but the id goes into it.
 */
export function meetingLink(planId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return /^https?:\/\//.test(origin)
    ? `${origin}/meeting/${encodeURIComponent(planId)}`
    : `aitudating://meeting/${encodeURIComponent(planId)}`;
}

/** What goes out through another app: what, where, when and the link; no exact place, no names. */
export function inviteText(plan: PlanSummary, clock: Clock): string {
  const when = `${formatPlanDate(plan.date, clock)}, ${plan.timeStart}`;
  const what = `${meetingFormatLabels[plan.format]} · ${settlementName(plan.city) ?? ''}`;
  return t.text(what, when, meetingLink(plan.id));
}

/** A Встреча can be passed on while it is still ahead. */
export const canShare = (plan: Pick<PlanSummary, 'status'>) =>
  plan.status === 'published' || plan.status === 'closed' || plan.status === 'matched';

export async function copyLink(planId: string): Promise<void> {
  await navigator.clipboard.writeText(meetingLink(planId));
}

/**
 * The system share sheet (WhatsApp, Telegram, mail and whatever else the device offers).
 * Without one the link is copied: `'copied'`; a share the person dismissed is `'cancelled'`.
 */
export async function shareElsewhere(
  plan: PlanSummary,
  clock: Clock,
): Promise<'shared' | 'copied' | 'cancelled'> {
  const data = { title: t.title, text: inviteText(plan, clock), url: meetingLink(plan.id) };
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return 'cancelled';
    }
  }
  await copyLink(plan.id);
  return 'copied';
}
