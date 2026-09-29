import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  cityLabels,
  meetingFormatLabels,
  meetingGoalLabels,
  paymentPolicyLabels,
} from '@/catalogs';
import {
  isRepositoryError,
  LIMITS,
  type AuthorView,
  type PlanResponseView,
  type PlanView,
} from '@/contracts';
import {
  useAcceptResponse,
  useCancelPlan,
  useClosePlan,
  useDeclineResponse,
  usePlan,
  usePlanResponses,
  useRespondToPlan,
  useSession,
  useSetBlock,
  useWithdrawResponse,
} from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { newIdempotencyKey } from '@/features/access/steps';
import { useSocialGate } from '@/features/post/usePostActions';
import { ActionSheet, type SheetAction } from '@/ui/components/ActionSheet';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { Avatar } from '@/ui/components/Avatar';
import { IconAction, PrimaryButton, SecondaryButton, TextButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { TextArea } from '@/ui/components/TextArea';
import { AppText } from '@/ui/components/Text';
import { formatPlanDate } from '@/ui/format';
import {
  Calendar,
  ChevronLeft,
  Clock as ClockIcon,
  Ellipsis,
  MapPin,
  Wallet,
  type Icon,
} from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { iconStroke, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.planScreen;

/**
 * A План by role. A guest and an expired member see the safe summary and are sent to
 * join or renew; an active member sees the place and responds; the author sees the
 * Отклики and decides. «•••» closes or cancels for the author, reports or blocks for
 * everyone else.
 */
export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = String(id);
  const plan = usePlan(planId);
  const router = useRouter();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (isRepositoryError(plan.error) && plan.error.code === 'NOT_FOUND') {
    return (
      <Screen testID="screen-plan" withTabBar={false}>
        <Header />
        <EmptyState
          testID="plan-unavailable"
          title={t.unavailableTitle}
          text={t.unavailableText}
          action={{ label: t.back, onPress: leave, testID: 'plan-unavailable-back' }}
        />
      </Screen>
    );
  }
  if (!plan.data) {
    return (
      <Screen testID="screen-plan" withTabBar={false}>
        <Header />
        {plan.isError ? (
          <ErrorState
            testID="plan-error"
            title={t.errorTitle}
            text={t.errorText}
            action={{ label: t.retry, onPress: () => plan.refetch(), testID: 'plan-retry' }}
          />
        ) : (
          <FeedSkeleton rows={2} />
        )}
      </Screen>
    );
  }
  return <PlanDetail plan={plan.data} onLeave={leave} />;
}

function Header({ onMenu }: { onMenu?: () => void }) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <View style={styles.header}>
      <IconAction
        icon={ChevronLeft}
        accessibilityLabel={t.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        testID="plan-back"
      />
      <AppText variant="bodyStrong" role="heading" style={styles.title} pointerEvents="none">
        {t.title}
      </AppText>
      {onMenu ? (
        <IconAction
          icon={Ellipsis}
          accessibilityLabel={t.menu}
          onPress={onMenu}
          testID="plan-menu"
        />
      ) : null}
    </View>
  );
}

type Sheet = 'menu' | 'block' | 'cancel';

function PlanDetail({ plan, onLeave }: { plan: PlanView; onLeave: () => void }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const session = useSession();
  const setBlock = useSetBlock();
  const closePlan = useClosePlan();
  const cancelPlan = useCancelPlan();
  const [sheet, setSheet] = useState<Sheet>();

  const accessState = session.data?.accessState;
  const isOwner = plan.author.view === 'member' && plan.author.id === session.data?.userId;
  const isMember = accessState === 'ACTIVE_MEMBER' || accessState === 'ACTIVE_MEMBER_EXPIRED';
  const authorName = plan.author.view === 'member' ? plan.author.name : undefined;
  const canCancel = plan.status !== 'cancelled' && plan.status !== 'past';

  const closeSheet = () => setSheet(undefined);
  const failed = () => toast(t.failed);
  const block = () => {
    closeSheet();
    if (plan.author.view !== 'member') return;
    setBlock.mutate(
      { target: { type: 'user', id: plan.author.id }, active: true },
      {
        onSuccess: () => {
          toast(strings.block.done);
          onLeave();
        },
        onError: () => toast(strings.block.failed),
      },
    );
  };
  const report = () => {
    closeSheet();
    router.push({ pathname: '/report', params: { targetType: 'plan', targetId: plan.id } });
  };

  let actions: SheetAction[];
  if (sheet === 'block') {
    actions = [
      { label: strings.block.confirm, danger: true, onPress: block, testID: 'sheet-confirm-block' },
    ];
  } else if (sheet === 'cancel') {
    actions = [
      {
        label: t.cancelConfirm,
        danger: true,
        onPress: () => {
          closeSheet();
          cancelPlan.mutate(plan.id, { onSuccess: () => toast(t.cancelDone), onError: failed });
        },
        testID: 'sheet-confirm-cancel',
      },
      { label: t.keep, onPress: closeSheet, testID: 'sheet-keep' },
    ];
  } else if (isOwner) {
    actions = [
      ...(plan.status === 'published'
        ? [
            {
              label: t.closePlan,
              onPress: () => {
                closeSheet();
                closePlan.mutate(plan.id, {
                  onSuccess: () => toast(t.closeDone),
                  onError: failed,
                });
              },
              testID: 'sheet-close-plan',
            },
          ]
        : []),
      ...(canCancel
        ? [
            {
              label: t.cancelPlan,
              danger: true,
              onPress: () => setSheet('cancel'),
              testID: 'sheet-cancel-plan',
            },
          ]
        : []),
    ];
  } else {
    actions = [
      { label: t.report, onPress: report, testID: 'sheet-report' },
      // A guest reports anonymously; blocking is between members.
      ...(isMember
        ? [{ label: t.block, onPress: () => setSheet('block'), testID: 'sheet-block' }]
        : []),
    ];
  }

  return (
    <Screen testID="screen-plan" withTabBar={false}>
      <Header onMenu={actions.length > 0 ? () => setSheet('menu') : undefined} />
      <Summary plan={plan} />
      <AuthorLink author={plan.author} />
      {plan.description ? (
        <View style={styles.section}>
          <AppText variant="bodyStrong">{t.about}</AppText>
          <AppText testID="plan-description">{plan.description}</AppText>
        </View>
      ) : null}
      {/* Who is looking decides the actions: nothing until the session is known. */}
      {!session.data ? null : isOwner ? <Responses plan={plan} /> : <RespondArea plan={plan} />}
      <ActionSheet
        visible={!!sheet}
        title={
          sheet === 'block' ? strings.block.title : sheet === 'cancel' ? t.cancelTitle : undefined
        }
        message={
          sheet === 'block'
            ? strings.block.hint(authorName)
            : sheet === 'cancel'
              ? t.cancelHint
              : undefined
        }
        actions={actions}
        onClose={closeSheet}
        testID="plan-sheet"
      />
    </Screen>
  );
}

function Summary({ plan }: { plan: PlanView }) {
  const styles = useStyles();
  const clock = useClock();
  const { colors } = useTheme();
  const time = plan.timeEnd ? `${plan.timeStart}–${plan.timeEnd}` : plan.timeStart;
  const line = (icon: Icon, text: string, testID?: string) => {
    const IconComponent = icon;
    return (
      <View style={styles.line} testID={testID}>
        <IconComponent size={18} color={colors.textMuted} strokeWidth={iconStroke.default} />
        <AppText style={styles.grow}>{text}</AppText>
      </View>
    );
  };
  return (
    <View style={styles.summary} testID="plan-summary">
      {plan.status !== 'published' ? (
        <View style={styles.badge} testID="plan-status">
          <AppText variant="caption">{t.status[plan.status]}</AppText>
        </View>
      ) : null}
      <AppText variant="title" role="heading">
        {`${meetingFormatLabels[plan.format]} · ${meetingGoalLabels[plan.goal]}`}
      </AppText>
      {line(Calendar, `${formatPlanDate(plan.date, clock)} · ${time}`)}
      {line(ClockIcon, strings.plan.minutes(plan.durationMinutes))}
      {line(
        MapPin,
        `${cityLabels[plan.city]}${plan.isPublicPlace ? ` · ${strings.plan.publicPlace}` : ''}`,
      )}
      {plan.place ? (
        line(MapPin, plan.place, 'plan-place')
      ) : (
        <AppText variant="caption" tone="textMuted" testID="plan-place-hidden">
          {t.placeHidden}
        </AppText>
      )}
      {line(Wallet, paymentPolicyLabels[plan.paymentPolicy])}
    </View>
  );
}

function AuthorLink({ author }: { author: AuthorView }) {
  const styles = useStyles();
  const router = useRouter();
  const content = (
    <>
      <Avatar avatar={author.avatar} size={40} />
      <View style={styles.grow}>
        <AuthorRow author={author} />
      </View>
    </>
  );
  if (author.view !== 'member') {
    return (
      <View style={styles.author} testID="plan-author">
        {content}
      </View>
    );
  }
  return (
    <Pressable
      role="link"
      aria-label={t.openAuthor(author.name)}
      onPress={() => router.push(`/member/${author.id}`)}
      style={({ pressed }) => [styles.author, pressed && styles.pressed]}
      testID="plan-author"
    >
      {content}
    </Pressable>
  );
}

/** What a visitor who is not the author can do: respond, follow up or withdraw. */
function RespondArea({ plan }: { plan: PlanView }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const { isMember, isExpired, allow } = useSocialGate();
  const respond = useRespondToPlan();
  const withdraw = useWithdrawResponse();
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [idempotencyKey, setKey] = useState(newIdempotencyKey);
  const mine = plan.myResponse;

  if (mine?.status === 'accepted') {
    return (
      <View style={styles.notice} testID="plan-matched">
        <AppText variant="bodyStrong">{t.matched}</AppText>
        <AppText tone="textMuted">{t.matchedText}</AppText>
        <PrimaryButton
          label={t.write}
          onPress={() => router.push({ pathname: '/chats/[id]', params: { id: plan.id } })}
          testID="plan-write"
        />
      </View>
    );
  }
  if (mine?.status === 'declined') {
    return (
      <View style={styles.notice} testID="plan-declined">
        <AppText tone="textMuted">{t.declined}</AppText>
      </View>
    );
  }
  if (mine?.status === 'pending') {
    return (
      <View style={styles.notice} testID="plan-pending">
        <AppText>{t.pending}</AppText>
        <SecondaryButton
          label={t.withdraw}
          loading={withdraw.isPending}
          onPress={() =>
            withdraw.mutate(mine.id, {
              onSuccess: () => toast(t.withdrawn),
              onError: () => toast(t.failed),
            })
          }
          testID="plan-withdraw"
        />
      </View>
    );
  }
  if (plan.status !== 'published') {
    return plan.status === 'closed' ? (
      <View style={styles.notice} testID="plan-closed">
        <AppText tone="textMuted">{t.closedText}</AppText>
      </View>
    ) : null;
  }
  if (!isMember) {
    // A guest joins, an expired member renews: the gate sends them there.
    return (
      <View style={styles.notice}>
        <AppText tone="textMuted">{isExpired ? t.expiredHint : t.guestHint}</AppText>
        <PrimaryButton label={t.respond} onPress={() => allow()} testID="plan-respond" />
      </View>
    );
  }
  if (!composing) {
    return (
      <PrimaryButton label={t.respond} onPress={() => setComposing(true)} testID="plan-respond" />
    );
  }
  const send = () =>
    respond.mutate(
      { planId: plan.id, message: message.trim() || undefined, idempotencyKey },
      {
        onSuccess: () => {
          toast(t.sent);
          setComposing(false);
          setMessage('');
          setKey(newIdempotencyKey());
        },
        onError: () => toast(t.failed),
      },
    );
  return (
    <View style={styles.notice} testID="plan-compose">
      <AppText tone="textMuted">{t.respondHint}</AppText>
      <TextArea
        label={t.messageLabel}
        value={message}
        onChangeText={setMessage}
        placeholder={t.messagePlaceholder}
        maxLength={LIMITS.commentText}
        testID="plan-message"
      />
      <PrimaryButton label={t.send} loading={respond.isPending} onPress={send} testID="plan-send" />
      <TextButton
        label={t.cancel}
        onPress={() => setComposing(false)}
        testID="plan-compose-cancel"
      />
    </View>
  );
}

/** The author's side: Отклики, waiting ones first, with «Принять» and «Отклонить». */
function Responses({ plan }: { plan: PlanView }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const list = usePlanResponses(plan.id, true);
  const accept = useAcceptResponse();
  const decline = useDeclineResponse();
  const [confirming, setConfirming] = useState<PlanResponseView>();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const decides = plan.status === 'published' || plan.status === 'closed';

  let body: React.ReactNode;
  if (list.isPending) body = <FeedSkeleton rows={1} />;
  else if (list.isError && items.length === 0)
    body = (
      <ErrorState
        testID="plan-responses-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => list.refetch(), testID: 'plan-responses-retry' }}
      />
    );
  else if (items.length === 0)
    body = (
      <EmptyState
        testID="plan-responses-empty"
        title={t.responsesEmpty}
        text={t.responsesEmptyText}
      />
    );
  else
    body = items.map((response) => (
      <View key={response.id} style={styles.response} testID={`plan-response-${response.id}`}>
        <AuthorLink author={response.author} />
        {response.message ? <AppText>{response.message}</AppText> : null}
        {response.status === 'pending' && decides ? (
          <View style={styles.decide}>
            <PrimaryButton
              label={t.accept}
              onPress={() => setConfirming(response)}
              testID={`plan-accept-${response.id}`}
            />
            <SecondaryButton
              label={t.decline}
              onPress={() => decline.mutate(response.id, { onError: () => toast(t.failed) })}
              testID={`plan-decline-${response.id}`}
            />
          </View>
        ) : (
          <AppText
            variant="caption"
            tone="textMuted"
            testID={`plan-response-status-${response.id}`}
          >
            {t.responseStatus[response.status]}
          </AppText>
        )}
        {response.status === 'accepted' ? (
          <PrimaryButton
            label={t.write}
            onPress={() => router.push({ pathname: '/chats/[id]', params: { id: plan.id } })}
            testID="plan-write"
          />
        ) : null}
      </View>
    ));

  const name = confirming?.author.view === 'member' ? confirming.author.name : undefined;
  return (
    <View style={styles.section} testID="plan-responses">
      <View style={styles.responsesHead}>
        <AppText variant="bodyStrong">{t.responses}</AppText>
        {plan.pendingResponses ? (
          <AppText variant="caption" tone="textMuted" testID="plan-waiting">
            {t.waiting(plan.pendingResponses)}
          </AppText>
        ) : null}
      </View>
      {body}
      {list.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={list.isFetchingNextPage}
          onPress={() => list.fetchNextPage()}
          testID="plan-responses-more"
        />
      ) : null}
      <ActionSheet
        visible={!!confirming}
        title={t.acceptTitle}
        message={t.acceptHint(name)}
        actions={[
          {
            label: t.acceptConfirm,
            onPress: () => {
              const chosen = confirming;
              setConfirming(undefined);
              if (chosen) accept.mutate(chosen.id, { onError: () => toast(t.failed) });
            },
            testID: 'sheet-confirm-accept',
          },
          { label: t.cancel, onPress: () => setConfirming(undefined), testID: 'sheet-keep' },
        ]}
        onClose={() => setConfirming(undefined)}
        testID="plan-accept-sheet"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  header: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: -spacing.sm },
  // Centred on the screen, not between the buttons.
  title: { position: 'absolute', left: 0, right: 0, top: 12, textAlign: 'center' },
  summary: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  section: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  notice: { gap: spacing.sm },
  responsesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  response: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  decide: { flexDirection: 'row', gap: spacing.sm },
}));
