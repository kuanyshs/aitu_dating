import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { meetingFormatLabels } from '@/catalogs';
import type { ChatSummary } from '@/contracts';
import { useChats, usePlan, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { Avatar } from '@/ui/components/Avatar';
import { IconAction, SecondaryButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { RenewBanner } from '@/ui/components/RenewBanner';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { formatPlanDate, formatRelative } from '@/ui/format';
import { ChevronLeft } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.chats;

/**
 * «Сообщения»: the member's Контекстные чаты, latest message first, each with where it
 * started and how many messages wait. Expired members read them and are offered renewal.
 */
export default function ChatsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const session = useSession();
  const state = session.data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER' || state === 'ACTIVE_MEMBER_EXPIRED';

  return (
    <Screen testID="screen-chats" withTabBar={false}>
      <View style={styles.header}>
        <IconAction
          icon={ChevronLeft}
          accessibilityLabel={t.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          testID="chats-back"
        />
        <AppText variant="bodyStrong" role="heading" style={styles.title}>
          {t.title}
        </AppText>
        <View style={styles.spacer} />
      </View>
      {state === 'ACTIVE_MEMBER_EXPIRED' ? <RenewBanner testID="chats-renew" /> : null}
      {isMember ? (
        <ChatList />
      ) : state ? (
        <AccessPrompt text={t.guest} testID="chats-access-prompt" />
      ) : null}
    </Screen>
  );
}

function ChatList() {
  const list = useChats(true);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  if (list.isPending) return <FeedSkeleton rows={2} />;
  if (list.isError && items.length === 0)
    return (
      <ErrorState
        testID="chats-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => list.refetch(), testID: 'chats-retry' }}
      />
    );
  if (items.length === 0)
    return <EmptyState testID="chats-empty" title={t.emptyTitle} text={t.emptyText} />;
  return (
    <View testID="chats-list">
      {items.map((chat) => (
        <ChatRow key={chat.id} chat={chat} />
      ))}
      {list.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={list.isFetchingNextPage}
          onPress={() => list.fetchNextPage()}
          testID="chats-more"
        />
      ) : null}
    </View>
  );
}

function ChatRow({ chat }: { chat: ChatSummary }) {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const last = chat.lastMessage;
  const name = chat.peer.view === 'member' ? chat.peer.name : '';
  const preview = !last
    ? t.noMessages
    : last.status === 'failed'
      ? `${t.failed}: ${last.text}`
      : `${last.fromMe ? t.you : ''}${last.text}`;
  return (
    <Pressable
      role="link"
      aria-label={t.open(name)}
      onPress={() => router.push(`/chats/${chat.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`chat-row-${chat.id}`}
    >
      <Avatar avatar={chat.peer.avatar} size={48} />
      <View style={styles.grow}>
        <AuthorRow
          author={chat.peer}
          time={last ? formatRelative(last.createdAt, clock) : undefined}
        />
        <ContextLine chat={chat} />
        <View style={styles.previewRow}>
          <AppText
            numberOfLines={1}
            style={styles.grow}
            tone={chat.unreadCount ? undefined : 'textMuted'}
            variant={chat.unreadCount ? 'bodyStrong' : 'body'}
            testID={`chat-row-${chat.id}-preview`}
          >
            {preview}
          </AppText>
          {chat.unreadCount ? (
            <View
              style={styles.badge}
              aria-label={t.unread(chat.unreadCount)}
              testID={`chat-row-${chat.id}-unread`}
            >
              <AppText variant="caption" tone="onPrimary">
                {String(chat.unreadCount)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Where the chat started, in one line; a Встреча names its plan. */
function ContextLine({ chat }: { chat: ChatSummary }) {
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
    <AppText variant="caption" tone="textMuted" testID={`chat-row-${chat.id}-context`}>
      {text}
    </AppText>
  );
}

const useStyles = createStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', marginLeft: -spacing.sm },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: 44 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  grow: { flex: 1, gap: 2 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
}));
