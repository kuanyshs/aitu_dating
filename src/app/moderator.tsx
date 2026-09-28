import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { ModerationReportView, ReportOutcome, ReportStatus } from '@/contracts';
import { useModerationQueue, useOpenReport, useResolveReport, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { ActionSheet, type SheetAction } from '@/ui/components/ActionSheet';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { IconAction, SecondaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
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

const t = strings.moderation;
const tabs: ReportStatus[] = ['created', 'reviewing', 'resolved'];

// Protected: only sessions with the moderator role; everyone else lands on Home.
export default function ModeratorScreen() {
  const session = useSession();
  if (session.isPending) return null;
  const allowed =
    session.data?.roles.includes('moderator') && session.data.accessState !== 'BLOCKED';
  if (!allowed) return <Redirect href="/" />;
  return <Queue />;
}

/** What a decision needs on screen: the report, and a confirmation step once picked. */
type Sheet = { item: ModerationReportView; decision?: ReportOutcome };

/**
 * Очередь модерации: reports by status. Opening a new one takes it into review; a
 * decision is confirmed first and closes every open report on the same target.
 */
function Queue() {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const [status, setStatus] = useState<ReportStatus>('created');
  const queue = useModerationQueue(status);
  const openReport = useOpenReport();
  const resolve = useResolveReport();
  const [sheet, setSheet] = useState<Sheet>();
  const items = queue.data?.pages.flatMap((p) => p.items) ?? [];

  const open = (item: ModerationReportView) => {
    setSheet({ item });
    if (item.report.status === 'created') openReport.mutate(item.report.id);
  };

  const decide = (decision: ReportOutcome) => {
    if (!sheet) return;
    resolve.mutate(
      { reportId: sheet.item.report.id, resolution: decision },
      { onSuccess: () => toast(t.done), onError: () => toast(t.failed) },
    );
    setSheet(undefined);
  };

  const decisions = (item: ModerationReportView): ReportOutcome[] => [
    'dismissed',
    // A person has no «content» of their own to remove.
    ...(item.report.target.type !== 'user' ? (['content_removed'] as const) : []),
    ...(item.subject && !item.subject.restricted ? (['member_restricted'] as const) : []),
  ];

  const sheetActions: SheetAction[] = !sheet
    ? []
    : sheet.decision
      ? [
          {
            label: t.decisions[sheet.decision],
            danger: sheet.decision !== 'dismissed',
            onPress: () => decide(sheet.decision!),
            testID: 'moderation-confirm',
          },
        ]
      : decisions(sheet.item).map((decision) => ({
          label: t.decisions[decision],
          danger: decision !== 'dismissed',
          onPress: () => setSheet({ ...sheet, decision }),
          testID: `moderation-decide-${decision}`,
        }));

  let body: React.ReactNode;
  if (queue.isPending) body = <FeedSkeleton rows={2} />;
  else if (queue.isError && items.length === 0)
    body = (
      <ErrorState
        testID="moderation-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => queue.refetch(), testID: 'moderation-retry' }}
      />
    );
  else if (items.length === 0)
    body = <EmptyState testID="moderation-empty" title={t.tabs[status]} text={t.empty[status]} />;
  else
    body = items.map((item) => (
      <ReportCard
        key={item.report.id}
        item={item}
        onOpen={item.report.status === 'resolved' ? undefined : () => open(item)}
      />
    ));

  return (
    <Screen testID="screen-moderator" withTabBar={false}>
      <View style={styles.header}>
        <AppText variant="display" role="heading">
          {t.title}
        </AppText>
        <IconAction
          icon={X}
          accessibilityLabel={t.close}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          testID="moderation-close"
        />
      </View>
      <View role="radiogroup" aria-label={t.tabsLabel} style={styles.tabs}>
        {tabs.map((tab) => (
          <Chip
            key={tab}
            label={t.tabs[tab]}
            selected={tab === status}
            onPress={() => setStatus(tab)}
            testID={`moderation-tab-${tab}`}
          />
        ))}
      </View>
      {body}
      {queue.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={queue.isFetchingNextPage}
          onPress={() => queue.fetchNextPage()}
          testID="moderation-more"
        />
      ) : null}
      <ActionSheet
        visible={!!sheet}
        title={sheet?.decision ? t.confirm[sheet.decision].title : t.decide}
        message={
          sheet?.decision
            ? `${t.confirm[sheet.decision].text} ${t.cascade}`
            : sheet
              ? `${strings.safety.target[sheet.item.report.target.type]} · ${strings.report.reasons[sheet.item.report.reason]}`
              : undefined
        }
        actions={sheetActions}
        onClose={() => setSheet(undefined)}
        testID="moderation-sheet"
      />
    </Screen>
  );
}

function ReportCard({ item, onOpen }: { item: ModerationReportView; onOpen?: () => void }) {
  const styles = useStyles();
  const clock = useClock();
  const { report, subject } = item;
  const content = (
    <>
      <View style={styles.cardHead}>
        <AppText variant="bodyStrong" style={styles.grow}>
          {`${strings.safety.target[report.target.type]} · ${strings.report.reasons[report.reason]}`}
        </AppText>
        <AppText variant="caption" tone="textMuted">
          {formatRelative(report.createdAt, clock)}
        </AppText>
      </View>
      {subject ? (
        <View style={styles.subject}>
          <AuthorRow author={subject.person} />
          {subject.text ? (
            <AppText numberOfLines={3} tone="textMuted" testID="moderation-text">
              {subject.text}
            </AppText>
          ) : null}
          {subject.restricted ? (
            <AppText variant="caption" tone="danger" testID="moderation-restricted">
              {t.restricted}
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppText tone="textMuted">{t.gone}</AppText>
      )}
      {report.details ? (
        <AppText testID="moderation-details">{`«${report.details}»`}</AppText>
      ) : null}
      {report.outcome ? (
        <View style={styles.badge}>
          <AppText variant="caption" testID="moderation-outcome">
            {t.outcome(strings.safety.outcome[report.outcome])}
          </AppText>
        </View>
      ) : null}
    </>
  );
  if (!onOpen)
    return (
      <View style={styles.card} testID={`moderation-${report.id}`}>
        {content}
      </View>
    );
  return (
    <Pressable
      role="button"
      aria-label={t.open}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`moderation-${report.id}`}
    >
      {content}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  grow: { flex: 1 },
  subject: {
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
}));
