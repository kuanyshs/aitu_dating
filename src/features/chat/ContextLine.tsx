import { meetingFormatLabels } from '@/catalogs';
import type { ChatSummary } from '@/contracts';
import { usePlan } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { AppText } from '@/ui/components/Text';
import { formatPlanDate } from '@/ui/format';
import { strings } from '@/ui/strings';

const t = strings.chats;

/** Where the chat started, in one line; a Встреча names its plan. */
export function ContextLine({ chat, testID }: { chat: ChatSummary; testID: string }) {
  const clock = useClock();
  const planId = chat.context.kind === 'plan_response' ? chat.context.planId : '';
  const plan = usePlan(planId, !!planId);
  const text =
    planId && plan.data
      ? t.meeting(
          `${meetingFormatLabels[plan.data.format]}, ${formatPlanDate(plan.data.date, clock)}`,
        )
      : t.context[chat.context.kind];
  return (
    <AppText variant="caption" tone="textMuted" testID={testID}>
      {text}
    </AppText>
  );
}
