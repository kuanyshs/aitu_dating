import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isRepositoryError,
  LIMITS,
  PHOTO_LIMITS,
  type ChatSummary,
  type MessageView,
} from '@/contracts';
import {
  useChat,
  useMarkChatRead,
  useMessages,
  useRetryMessage,
  useSendMessage,
  useSession,
  useSetBlock,
} from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { PhotoGallery } from '@/features/photo/PhotoGallery';
import { PhotoSlotsEditor } from '@/features/photo/PhotoSlotsEditor';
import { usePhotoSlots } from '@/features/photo/usePhotoSlots';
import { newIdempotencyKey } from '@/features/access/steps';
import { ContextLine, ContextText } from '@/features/chat/ContextLine';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { ActionSheet, type SheetAction } from '@/ui/components/ActionSheet';
import { Avatar } from '@/ui/components/Avatar';
import { IconAction, PrimaryButton, SecondaryButton, TextButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { ChevronLeft, Ellipsis, ImagePlus } from '@/ui/icons';
import { useReportFooter } from '@/ui/navigation/statusInset';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.chat;

/**
 * A Контекстный чат: the history (older on top, «Показать ранние»), sending with
 * «Повторить» for a message that did not go, and «прочитано». Expired members read and
 * are offered renewal; «•••» reports or blocks the other side.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = String(id);
  const router = useRouter();
  const session = useSession();
  const state = session.data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER' || state === 'ACTIVE_MEMBER_EXPIRED';
  const chat = useChat(chatId, isMember);
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/chats'));

  if (state && !isMember) {
    return (
      <Screen testID="screen-chat" withTabBar={false}>
        <AccessPrompt text={t.guest} testID="chat-access-prompt" />
      </Screen>
    );
  }
  if (isRepositoryError(chat.error) && chat.error.code === 'NOT_FOUND') {
    return (
      <Screen testID="screen-chat" withTabBar={false}>
        <EmptyState
          testID="chat-unavailable"
          title={t.unavailableTitle}
          text={t.unavailableText}
          action={{ label: t.back, onPress: leave, testID: 'chat-unavailable-back' }}
        />
      </Screen>
    );
  }
  if (!chat.data) {
    return (
      <Screen testID="screen-chat" withTabBar={false}>
        {chat.isError ? (
          <ErrorState
            testID="chat-error"
            title={t.errorTitle}
            text={t.errorText}
            action={{ label: t.reload, onPress: () => chat.refetch(), testID: 'chat-reload' }}
          />
        ) : (
          <FeedSkeleton rows={2} />
        )}
      </Screen>
    );
  }
  return <Conversation chat={chat.data} onLeave={leave} />;
}

type Sheet = 'menu' | 'block';

function Conversation({ chat, onLeave }: { chat: ChatSummary; onLeave: () => void }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const reportFooter = useReportFooter();
  const messages = useMessages(chat.id, true);
  const markRead = useMarkChatRead(chat.id);
  const setBlock = useSetBlock();
  const scroll = useRef<ScrollView>(null);
  const [sheet, setSheet] = useState<Sheet>();
  const peer = chat.peer;
  const name = peer.view === 'member' ? peer.name : undefined;

  // Pages go back in time; on screen the oldest comes first.
  const items = [...(messages.data?.pages ?? [])].reverse().flatMap((p) => p.items);

  // The chat reads up to the last unread message only once that one has been on screen.
  const lastUnread = items.findLast((m) => !m.fromMe && m.status === 'sent');
  const lastUnreadId = chat.unreadCount > 0 ? lastUnread?.id : undefined;
  const { mutate: read } = markRead;
  const viewport = useRef({ y: 0, height: 0 });
  const unreadBox = useRef<{ id: string; y: number; height: number }>(undefined);
  const marked = useRef<string>(undefined);
  const readIfShown = () => {
    const box = unreadBox.current;
    const { y, height } = viewport.current;
    if (!lastUnreadId || !box || box.id !== lastUnreadId || height === 0) return;
    if (marked.current === lastUnreadId) return;
    const shown = box.y < y + height && box.y + box.height > y;
    if (!shown) return;
    marked.current = lastUnreadId;
    read(lastUnreadId);
  };
  // A new last unread message may already be in view when it arrives.
  useEffect(() => readIfShown());
  const onViewport = (e: LayoutChangeEvent) => {
    viewport.current = { ...viewport.current, height: e.nativeEvent.layout.height };
    readIfShown();
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    viewport.current = {
      y: e.nativeEvent.contentOffset.y,
      height: e.nativeEvent.layoutMeasurement.height,
    };
    readIfShown();
  };
  const onUnreadLayout = (id: string) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    unreadBox.current = { id, y, height };
    readIfShown();
  };

  const block = () => {
    setSheet(undefined);
    if (peer.view !== 'member') return;
    // The chat reloads as unavailable and this view unmounts, so per-call callbacks of
    // `mutate` would never run: the promise settles regardless.
    setBlock.mutateAsync({ target: { type: 'user', id: peer.id }, active: true }).then(
      () => {
        toast(strings.block.done);
        onLeave();
      },
      () => toast(strings.block.failed),
    );
  };
  const actions: SheetAction[] =
    sheet === 'block'
      ? [
          {
            label: strings.block.confirm,
            danger: true,
            onPress: block,
            testID: 'sheet-confirm-block',
          },
        ]
      : [
          {
            label: t.report,
            onPress: () => {
              setSheet(undefined);
              if (peer.view !== 'member') return;
              router.push({
                pathname: '/report',
                params: { targetType: 'user', targetId: peer.id },
              });
            },
            testID: 'sheet-report',
          },
          { label: t.block, onPress: () => setSheet('block'), testID: 'sheet-block' },
        ];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-chat">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <IconAction
            icon={ChevronLeft}
            accessibilityLabel={t.back}
            onPress={onLeave}
            testID="chat-back"
          />
          <Pressable
            role="link"
            aria-label={name ? t.openPeer(name) : undefined}
            disabled={peer.view !== 'member'}
            onPress={() => peer.view === 'member' && router.push(`/member/${peer.id}`)}
            style={styles.peer}
            testID="chat-peer"
          >
            <Avatar avatar={peer.avatar} size={36} />
            <View style={styles.grow}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {name ?? ''}
              </AppText>
              <ContextLine chat={chat} testID="chat-context" />
            </View>
          </Pressable>
          <IconAction
            icon={Ellipsis}
            accessibilityLabel={t.menu}
            onPress={() => setSheet('menu')}
            testID="chat-menu"
          />
        </View>
        {chat.contexts.length > 1 ? (
          <View
            style={styles.contexts}
            aria-label={strings.chats.contextsLabel}
            testID="chat-contexts"
          >
            {chat.contexts.map((context, i) => (
              <ContextText key={i} context={context} testID={`chat-contexts-${i}`} />
            ))}
          </View>
        ) : null}

        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          // New messages arrive at the bottom: keep them in view.
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          onLayout={onViewport}
          onScroll={onScroll}
          scrollEventThrottle={100}
          testID="chat-messages"
        >
          {messages.hasNextPage ? (
            <TextButton
              label={t.earlier}
              onPress={() => messages.fetchNextPage()}
              testID="chat-earlier"
            />
          ) : null}
          {messages.isPending ? (
            <FeedSkeleton rows={2} />
          ) : items.length === 0 ? (
            <AppText tone="textMuted" style={styles.empty} testID="chat-empty">
              {t.empty}
            </AppText>
          ) : (
            items.map((message) => (
              <Bubble
                key={message.id}
                message={message}
                chatId={chat.id}
                onLayout={message.id === lastUnreadId ? onUnreadLayout(message.id) : undefined}
              />
            ))
          )}
        </ScrollView>

        <View style={styles.footer} onLayout={reportFooter}>
          {chat.readOnly ? (
            <View style={styles.readOnly} testID="chat-read-only">
              <AppText tone="textMuted">{t.readOnly}</AppText>
              <PrimaryButton
                label={t.renew}
                onPress={() => router.push('/renew')}
                testID="chat-renew"
              />
            </View>
          ) : (
            <Composer chatId={chat.id} />
          )}
        </View>
      </KeyboardAvoidingView>

      <ActionSheet
        visible={!!sheet}
        title={sheet === 'block' ? strings.block.title : undefined}
        message={sheet === 'block' ? strings.block.hint(name) : undefined}
        actions={actions}
        onClose={() => setSheet(undefined)}
        testID="chat-sheet"
      />
    </SafeAreaView>
  );
}

function Bubble({
  message,
  chatId,
  onLayout,
}: {
  message: MessageView;
  chatId: string;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const styles = useStyles();
  const clock = useClock();
  const toast = useToast((s) => s.show);
  const retry = useRetryMessage(chatId);
  const mine = message.fromMe;
  const failed = message.status === 'failed';
  return (
    <View
      style={[styles.line, mine ? styles.lineMine : null]}
      onLayout={onLayout}
      testID={`message-${message.id}`}
    >
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {message.photo ? (
          <View style={styles.bubblePhoto}>
            <PhotoGallery
              photos={[message.photo]}
              testID={`message-${message.id}-photo`}
              height={180}
            />
          </View>
        ) : null}
        {message.text ? <AppText tone={mine ? 'onPrimary' : 'text'}>{message.text}</AppText> : null}
      </View>
      <View style={styles.meta}>
        <AppText variant="caption" tone="textMuted">
          {formatRelative(message.createdAt, clock)}
        </AppText>
        {mine ? (
          <AppText
            variant="caption"
            tone={failed ? 'danger' : 'textMuted'}
            testID={`message-${message.id}-status`}
          >
            {t.status[message.status]}
          </AppText>
        ) : null}
        {mine && failed ? (
          <TextButton
            label={t.retry}
            loading={retry.isPending}
            onPress={() => retry.mutate(message.id, { onError: () => toast(t.failedToast) })}
            testID={`message-${message.id}-retry`}
          />
        ) : null}
      </View>
    </View>
  );
}

function Composer({ chatId }: { chatId: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast((s) => s.show);
  const send = useSendMessage(chatId);
  const [text, setText] = useState('');
  const [idempotencyKey, setKey] = useState(newIdempotencyKey);
  const photo = usePhotoSlots(PHOTO_LIMITS.message);
  const photoId = photo.photoIds[0];
  // Text, a Фото or both; a Фото still uploading or failed holds the message back.
  const ready =
    (text.trim().length > 0 || !!photoId) && !photo.busy && !photo.failed && !send.isPending;

  const submit = () => {
    if (!ready) return;
    send.mutate(
      { text: text.trim(), idempotencyKey, ...(photoId ? { photoId } : {}) },
      {
        // A message that did not go is already in the chat with «Повторить», Фото included.
        onSuccess: () => {
          setText('');
          photo.reset([]);
          setKey(newIdempotencyKey());
        },
        onError: () => toast(t.failedToast),
      },
    );
  };

  return (
    <View style={styles.composerBox}>
      {photo.slots.length ? (
        <PhotoSlotsEditor
          slots={photo.slots}
          max={PHOTO_LIMITS.message}
          onAdd={photo.add}
          onRemove={photo.remove}
          onMove={photo.move}
          onRetry={photo.retry}
          testID="chat-photo"
        />
      ) : null}
      <View style={styles.composer}>
        {photo.full ? null : (
          <IconAction
            icon={ImagePlus}
            accessibilityLabel={strings.photo.add}
            onPress={() => void photo.add()}
            testID="chat-photo-add"
          />
        )}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t.placeholder}
          placeholderTextColor={colors.textMuted}
          aria-label={t.inputLabel}
          multiline
          maxLength={LIMITS.messageText}
          style={styles.input}
          testID="chat-input"
        />
        <SecondaryButton
          label={t.send}
          onPress={submit}
          disabled={!ready}
          loading={send.isPending}
          testID="chat-send"
        />
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  composerBox: { gap: spacing.sm },
  bubblePhoto: { width: 200, marginBottom: spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  contexts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  peer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  messages: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { textAlign: 'center' },
  line: { alignItems: 'flex-start', gap: 2 },
  lineMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.surface },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  readOnly: { gap: spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    ...typography.body,
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
  },
}));
