import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type {
  ModerationAppealView,
  ModerationReportView,
  ReportOutcome,
  ReportStatus,
  RestrictionTerm,
} from '@/contracts';
import {
  useAppeals,
  useDecideAppeal,
  useModerationQueue,
  useOpenReport,
  useResolveReport,
  useSession,
} from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { ActionSheet, type SheetAction } from '@/ui/components/ActionSheet';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { IconAction, SecondaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { formatDay, formatRelative } from '@/ui/format';
import { X } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.moderation;
type Tab = ReportStatus | 'appeals';
const tabs: Tab[] = ['created', 'reviewing', 'resolved', 'appeals'];
const terms: RestrictionTerm[] = ['days_7', 'days_30', 'permanent'];

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
  const [tab, setTab] = useState<Tab>('created');
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

  const decide = (decision: ReportOutcome, term?: RestrictionTerm) => {
    if (!sheet) return;
    resolve.mutate(
      { reportId: sheet.item.report.id, resolution: decision, ...(term ? { term } : {}) },
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
    : sheet.decision === 'member_restricted'
      ? // Restricting asks for a term; the reason is the report's.
        terms.map((term) => ({
          label: t.terms[term],
          danger: true,
          onPress: () => decide('member_restricted', term),
          testID: `moderation-term-${term}`,
        }))
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
        {tabs.map((item) => (
          <Chip
            key={item}
            label={t.tabs[item]}
            selected={item === tab}
            onPress={() => {
              setTab(item);
              if (item !== 'appeals') setStatus(item);
            }}
            testID={`moderation-tab-${item}`}
          />
        ))}
      </View>
      {tab === 'appeals' ? <Appeals /> : body}
      {tab !== 'appeals' && queue.hasNextPage ? (
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
            ? `${t.confirm[sheet.decision].text} ${sheet.decision === 'member_restricted' ? `${t.chooseTerm} ` : ''}${t.cascade}`
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

/** Waiting Апелляции, the oldest first: «Снять ограничение» or «Оставить в силе». */
function Appeals() {
  const styles = useStyles();
  const clock = useClock();
  const toast = useToast((s) => s.show);
  const list = useAppeals('pending');
  const decide = useDecideAppeal();
  const [picked, setPicked] = useState<ModerationAppealView>();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  let body: React.ReactNode;
  if (list.isPending) body = <FeedSkeleton rows={2} />;
  else if (list.isError && items.length === 0)
    body = (
      <ErrorState
        testID="appeals-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => list.refetch(), testID: 'appeals-retry' }}
      />
    );
  else if (items.length === 0)
    body = <EmptyState testID="appeals-empty" title={t.tabs.appeals} text={t.empty.appeals} />;
  else
    body = items.map((item) => (
      <Pressable
        key={item.appeal.id}
        role="button"
        aria-label={t.appealDecide}
        onPress={() => setPicked(item)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        testID={`appeal-${item.appeal.id}`}
      >
        <View style={styles.cardHead}>
          <AppText variant="bodyStrong" style={styles.grow}>
            {`${strings.report.reasons[item.restriction.reason]} · ${t.termsShort[item.restriction.term]}`}
          </AppText>
          <AppText variant="caption" tone="textMuted">
            {formatRelative(item.appeal.createdAt, clock)}
          </AppText>
        </View>
        <AuthorRow author={item.person} />
        <AppText testID="appeal-text">{`«${item.appeal.text}»`}</AppText>
        <AppText variant="caption" tone="textMuted">
          {strings.restricted.decidedAt(formatDay(item.restriction.decidedAt, clock))}
        </AppText>
      </Pressable>
    ));

  const choose = (decision: 'lift' | 'uphold') => {
    if (!picked) return;
    decide.mutate(
      { appealId: picked.appeal.id, decision },
      { onSuccess: () => toast(t.appealDone), onError: () => toast(t.failed) },
    );
    setPicked(undefined);
  };

  return (
    <>
      {body}
      <ActionSheet
        visible={!!picked}
        title={t.appealDecide}
        message={picked ? `«${picked.appeal.text}»` : undefined}
        actions={[
          {
            label: t.appealDecisions.lift,
            onPress: () => choose('lift'),
            testID: 'appeal-decide-lift',
          },
          {
            label: t.appealDecisions.uphold,
            danger: true,
            onPress: () => choose('uphold'),
            testID: 'appeal-decide-uphold',
          },
        ]}
        onClose={() => setPicked(undefined)}
        testID="appeal-sheet"
      />
    </>
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
