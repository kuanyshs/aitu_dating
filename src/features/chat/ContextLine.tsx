import { meetingFormatLabels } from '@/catalogs';
import type { ChatContextView, ChatSummary } from '@/contracts';
import { usePlan } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { AppText } from '@/ui/components/Text';
import { formatPlanDate } from '@/ui/format';
import { strings } from '@/ui/strings';

const t = strings.chats;

/** One Контекст чата in words; a Встреча names its plan and says when it was cancelled. */
export function useContextText(context: ChatContextView): string {
  const clock = useClock();
  const planId = context.kind === 'plan_response' ? context.planId : '';
  const plan = usePlan(planId, !!planId);
  if (context.kind !== 'plan_response') return t.context[context.kind];
  if (!plan.data) return context.cancelled ? t.cancelledMeeting : t.context.plan_response;
  const what = `${meetingFormatLabels[plan.data.format]}, ${formatPlanDate(plan.data.date, clock)}`;
  return context.cancelled ? t.meetingCancelled(what) : t.meeting(what);
}

/** The latest reason the two talk, in one line. */
export function ContextLine({ chat, testID }: { chat: ChatSummary; testID: string }) {
  return <ContextText context={chat.context} testID={testID} />;
}

export function ContextText({ context, testID }: { context: ChatContextView; testID?: string }) {
  const text = useContextText(context);
  return (
    <AppText variant="caption" tone="textMuted" testID={testID}>
      {text}
    </AppText>
  );
}
