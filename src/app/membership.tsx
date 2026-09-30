import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { membershipTierLabels } from '@/catalogs';
import type { MyProfile } from '@/contracts';
import { useMyProfile, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.membershipScreen;
const DAY_MS = 24 * 60 * 60 * 1000;
const date = (iso: string) => format(new Date(iso), 'd MMMM yyyy', { locale: ru });

/**
 * Membership: the current tier, period, dates and what is left, with «Продлить». A guest is
 * invited to join instead. There is no payment history.
 */
export default function MembershipScreen() {
  const session = useSession();
  const state = session.data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER' || state === 'ACTIVE_MEMBER_EXPIRED';

  return (
    <Screen testID="screen-membership" withTabBar={false}>
      <SheetHeader title={t.title} closeLabel={t.close} testID="membership-close" />
      {isMember ? (
        <Details />
      ) : state ? (
        <AccessPrompt text={t.guest} testID="membership-access-prompt" />
      ) : null}
    </Screen>
  );
}

function Details() {
  const me = useMyProfile(true);
  if (me.isPending) return <FeedSkeleton rows={1} />;
  if (me.isError)
    return (
      <ErrorState
        testID="membership-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => me.refetch(), testID: 'membership-retry' }}
      />
    );
  return <Membership membership={me.data.membership} />;
}

function Membership({ membership }: { membership: MyProfile['membership'] }) {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const active = membership.status === 'active';
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(membership.endsAt).getTime() - clock.now().getTime()) / DAY_MS),
  );
  const rows: [label: string, value: string, id: string][] = [
    [t.tier, membershipTierLabels[membership.tier], 'tier'],
    [t.period, strings.access.membership.months(membership.periodMonths), 'period'],
    [t.starts, date(membership.startsAt), 'starts'],
    [t.ends, date(membership.endsAt), 'ends'],
    [t.status, active ? t.active : t.expired, 'status'],
    ...(active ? [[t.left, t.days(daysLeft), 'left'] as [string, string, string]] : []),
  ];
  const renew = {
    label: t.renew,
    onPress: () => router.push('/renew'),
    testID: 'membership-renew',
  };

  return (
    <>
      <View style={styles.card} testID="membership-details">
        {rows.map(([label, value, id], index) => (
          <View key={id} style={[styles.row, index > 0 && styles.divided]}>
            <AppText tone="textMuted">{label}</AppText>
            <AppText variant="bodyStrong" testID={`membership-${id}`}>
              {value}
            </AppText>
          </View>
        ))}
      </View>
      {active ? (
        <SecondaryButton {...renew} />
      ) : (
        <>
          <AppText tone="textMuted">{t.expiredHint}</AppText>
          <PrimaryButton {...renew} />
        </>
      )}
    </>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
}));
