import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { cityLabels, meetingFormatLabels, meetingGoalLabels } from '@/catalogs';
import type { PlanView } from '@/contracts';
import { useClock } from '@/data/RepositoryProvider';
import { AppText } from '@/ui/components/Text';
import { formatPlanDate } from '@/ui/format';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

/** A plan in a line: what, when, where, and its status or the Отклик's. */
export function PlanRow({
  plan,
  note,
  testID,
}: {
  plan: PlanView;
  /** Overrides the plan's own status line (an Отклик's standing, say). */
  note?: string;
  testID: string;
}) {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const status =
    note ??
    (plan.status === 'published'
      ? plan.pendingResponses
        ? strings.planScreen.waiting(plan.pendingResponses)
        : undefined
      : strings.planScreen.status[plan.status]);
  return (
    <Pressable
      role="link"
      aria-label={strings.plan.open}
      onPress={() => router.push(`/plan/${plan.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={testID}
    >
      <AppText variant="bodyStrong">
        {`${meetingFormatLabels[plan.format]} · ${meetingGoalLabels[plan.goal]}`}
      </AppText>
      <AppText tone="textMuted">
        {`${formatPlanDate(plan.date, clock)} · ${plan.timeStart} · ${cityLabels[plan.city]}`}
      </AppText>
      {status ? (
        <AppText variant="caption" testID={`${testID}-status`}>
          {status}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: { backgroundColor: colors.surfacePressed },
}));
