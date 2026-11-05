import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { meetingFormatLabels, meetingGoalLabels, settlementName } from '@/catalogs';
import type { MeetingCard } from '@/contracts';
import { useClock } from '@/data/RepositoryProvider';
import { PhotoGallery } from '@/features/photo/PhotoGallery';
import { SecondaryButton } from '@/ui/components/buttons';
import { budgetLine } from '@/ui/components/PostRow';
import { AppText } from '@/ui/components/Text';
import { formatPlanDate } from '@/ui/format';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.chat.meeting;

/**
 * A Встреча in a chat, put there by a Запрос: what, where and when, its status now and
 * «Открыть встречу». Never the exact place.
 */
export function MeetingCardView({
  card,
  fromMe,
  testID,
}: {
  card: MeetingCard;
  fromMe: boolean;
  testID: string;
}) {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const plan = card.plan;
  const open = card.state !== 'deleted' && card.state !== 'unavailable';
  return (
    <View style={styles.card} testID={testID}>
      <AppText variant="caption" tone="textMuted">
        {card.kind === 'share'
          ? fromMe
            ? t.sharedByMe
            : t.sharedToMe
          : fromMe
            ? t.sentByMe
            : t.toMine}
      </AppText>
      {plan ? (
        <>
          <AppText variant="bodyStrong">
            {`${meetingFormatLabels[plan.format]} · ${meetingGoalLabels[plan.goal]}`}
          </AppText>
          <AppText>{settlementName(plan.city) ?? ''}</AppText>
          <AppText>
            {`${formatPlanDate(plan.date, clock)} · ${plan.timeStart} · ${strings.plan.minutes(plan.durationMinutes)}`}
          </AppText>
          <AppText tone="textMuted">{budgetLine(plan)}</AppText>
        </>
      ) : null}
      {card.photo ? (
        <PhotoGallery photos={[card.photo]} testID={`${testID}-photo`} height={140} />
      ) : null}
      <View style={styles.status}>
        <AppText variant="caption" testID={`${testID}-status`}>
          {card.kind === 'share' && card.state === 'matched' ? t.matchedOther : t.state[card.state]}
        </AppText>
      </View>
      {open ? (
        <SecondaryButton
          label={t.open}
          onPress={() => router.push(`/meeting/${card.planId}`)}
          testID={`${testID}-open`}
        />
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    minWidth: 240,
  },
  status: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
}));
