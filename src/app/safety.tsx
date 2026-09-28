import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { genderLabels } from '@/catalogs';
import type { BlockedView, ReportView } from '@/contracts';
import { useBlocked, useMyReports, useSession, useSetBlock } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { ActionSheet } from '@/ui/components/ActionSheet';
import { Avatar } from '@/ui/components/Avatar';
import { IconAction, SecondaryButton, TextButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { X } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.safety;

/**
 * Безопасность: tips for a first meeting, «Заблокированные», «Мои жалобы» and support.
 * Guests have neither blocks nor reports of their own and see the tips and support only.
 */
export default function SafetyScreen() {
  const styles = useStyles();
  const router = useRouter();
  const session = useSession();
  const toast = useToast((s) => s.show);
  const state = session.data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER' || state === 'ACTIVE_MEMBER_EXPIRED';

  return (
    <Screen testID="screen-safety" withTabBar={false}>
      <View style={styles.header}>
        <AppText variant="display" role="heading">
          {t.title}
        </AppText>
        <IconAction
          icon={X}
          accessibilityLabel={t.close}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          testID="safety-close"
        />
      </View>

      <Section title={t.tipsTitle} testID="safety-tips">
        <View style={styles.card}>
          {t.tips.map((tip, index) => (
            <View key={tip} style={styles.tip}>
              <AppText variant="bodyStrong" tone="textMuted" style={styles.tipNumber}>
                {`${index + 1}`}
              </AppText>
              <AppText style={styles.grow}>{tip}</AppText>
            </View>
          ))}
        </View>
      </Section>

      {isMember ? (
        <>
          <Blocked />
          <MyReports />
        </>
      ) : null}

      <Section title={t.supportTitle} testID="safety-support">
        <AppText tone="textMuted">{t.supportText}</AppText>
        <SecondaryButton
          label={t.support}
          onPress={() => toast(t.supportSoon)}
          testID="safety-support-button"
        />
      </Section>
    </Screen>
  );
}

function Section({
  title,
  testID,
  children,
}: {
  title: string;
  testID: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="title" role="heading">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const personName = (person: BlockedView['person']) =>
  person.view === 'member' ? person.name : `${genderLabels[person.gender]}, ${person.age}`;

function Blocked() {
  const styles = useStyles();
  const toast = useToast((s) => s.show);
  const blocked = useBlocked(true);
  const setBlock = useSetBlock();
  const [pending, setPending] = useState<BlockedView>();
  const items = blocked.data?.pages.flatMap((p) => p.items) ?? [];

  const unblock = () => {
    if (!pending) return;
    setBlock.mutate(
      { target: { type: 'block', id: pending.blockId }, active: false },
      {
        onSuccess: () => toast(t.unblockDone),
        onError: () => toast(t.unblockFailed),
      },
    );
    setPending(undefined);
  };

  let body: React.ReactNode;
  if (blocked.isPending) body = <FeedSkeleton rows={1} />;
  else if (blocked.isError && items.length === 0)
    body = (
      <ErrorState
        testID="blocked-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => blocked.refetch(), testID: 'blocked-retry' }}
      />
    );
  else if (items.length === 0)
    body = (
      <AppText tone="textMuted" testID="blocked-empty">
        {t.blockedEmpty}
      </AppText>
    );
  else
    body = (
      <View style={styles.card}>
        {items.map((item, index) => (
          <View
            key={item.blockId}
            style={[styles.row, index > 0 && styles.divided]}
            testID={`blocked-${item.blockId}`}
          >
            <Avatar avatar={item.person.avatar} size={36} />
            <AppText variant="bodyStrong" style={styles.grow} testID="blocked-name">
              {personName(item.person)}
            </AppText>
            <TextButton
              label={t.unblock}
              onPress={() => setPending(item)}
              testID="blocked-unblock"
            />
          </View>
        ))}
      </View>
    );

  return (
    <Section title={t.blockedTitle} testID="safety-blocked">
      {body}
      {blocked.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={blocked.isFetchingNextPage}
          onPress={() => blocked.fetchNextPage()}
          testID="blocked-more"
        />
      ) : null}
      <ActionSheet
        visible={!!pending}
        title={t.unblockTitle}
        message={t.unblockText}
        actions={[{ label: t.unblock, onPress: unblock, testID: 'blocked-confirm' }]}
        onClose={() => setPending(undefined)}
        testID="blocked-sheet"
      />
    </Section>
  );
}

function MyReports() {
  const styles = useStyles();
  const clock = useClock();
  const reports = useMyReports(true);
  const items = reports.data?.pages.flatMap((p) => p.items) ?? [];

  let body: React.ReactNode;
  if (reports.isPending) body = <FeedSkeleton rows={1} />;
  else if (reports.isError && items.length === 0)
    body = (
      <ErrorState
        testID="reports-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => reports.refetch(), testID: 'reports-retry' }}
      />
    );
  else if (items.length === 0)
    body = <EmptyState testID="reports-empty" title={t.reportsTitle} text={t.reportsEmpty} />;
  else
    body = (
      <View style={styles.card}>
        {items.map((report, index) => (
          <ReportRow
            key={report.id}
            report={report}
            time={formatRelative(report.createdAt, clock)}
            divided={index > 0}
          />
        ))}
      </View>
    );

  return (
    <Section title={t.reportsTitle} testID="safety-reports">
      {body}
      {reports.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={reports.isFetchingNextPage}
          onPress={() => reports.fetchNextPage()}
          testID="reports-more"
        />
      ) : null}
    </Section>
  );
}

function ReportRow({
  report,
  time,
  divided,
}: {
  report: ReportView;
  time: string;
  divided: boolean;
}) {
  const styles = useStyles();
  const status =
    report.status === 'resolved' && report.outcome
      ? `${t.status.resolved} · ${t.outcome[report.outcome]}`
      : t.status[report.status];
  return (
    <View style={[styles.report, divided && styles.divided]} testID={`report-${report.id}`}>
      <View style={styles.reportHead}>
        <AppText variant="bodyStrong" style={styles.grow}>
          {`${t.target[report.target.type]} · ${strings.report.reasons[report.reason]}`}
        </AppText>
        <AppText variant="caption" tone="textMuted">
          {time}
        </AppText>
      </View>
      {report.details ? (
        <AppText tone="textMuted" numberOfLines={2}>
          {report.details}
        </AppText>
      ) : null}
      <View style={[styles.badge, report.status === 'resolved' && styles.badgeResolved]}>
        <AppText variant="caption" testID="report-status">
          {status}
        </AppText>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: spacing.sm, marginTop: spacing.md },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  tip: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tipNumber: { width: 16 },
  grow: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  report: { gap: spacing.xs, padding: spacing.md },
  reportHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  badgeResolved: { backgroundColor: colors.surfacePressed },
}));
