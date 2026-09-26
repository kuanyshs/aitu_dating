import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isRepositoryError, type CommentSort, type CommentThread } from '@/contracts';
import { usePost, usePostComments } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import type { CommentAction } from '@/features/post/CommentRow';
import { CommentThreadView } from '@/features/post/CommentThreadView';
import { PostFooter } from '@/features/post/PostFooter';
import { usePostActions, useSocialGate } from '@/features/post/usePostActions';
import { IconAction } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { PostRow } from '@/ui/components/PostRow';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { ChevronLeft, Ellipsis } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const sorts: CommentSort[] = ['popular', 'new'];

/** Публикация: the whole post, its «Ответы · N» and the comment threads under it. */
export default function PostScreen() {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const { colors } = useTheme();
  const toast = useToast((s) => s.show);
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id);
  const t = strings.postDetail;

  const post = usePost(postId);
  const [sort, setSort] = useState<CommentSort>('popular');
  const comments = usePostComments(postId, sort);
  const threads = useMemo(
    () => comments.data?.pages.flatMap((p) => p.items) ?? [],
    [comments.data],
  );
  const { onAction, onOpen } = usePostActions();
  const { allow } = useSocialGate();

  const leave = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/')),
    [router],
  );

  // Liking replies and answering arrive with their own tickets; the gate already works.
  const onCommentAction = useCallback(
    (_action: CommentAction) => {
      if (allow()) toast(strings.post.comingSoon);
    },
    [allow, toast],
  );

  const renderItem = useCallback(
    ({ item }: { item: CommentThread }) => (
      <CommentThreadView thread={item} clock={clock} onAction={onCommentAction} />
    ),
    [clock, onCommentAction],
  );

  const unavailable = isRepositoryError(post.error) && post.error.code === 'NOT_FOUND';

  const header = (
    <View style={styles.header}>
      <IconAction
        icon={ChevronLeft}
        accessibilityLabel={t.back}
        onPress={leave}
        testID="post-back"
      />
      <AppText variant="bodyStrong" role="heading" style={styles.title}>
        {t.title}
      </AppText>
      {post.data ? (
        <IconAction
          icon={Ellipsis}
          accessibilityLabel={t.menu}
          onPress={() => router.push('/report')}
          testID="post-menu"
        />
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  if (unavailable) {
    return (
      <SafeAreaView edges={['top']} style={styles.root} testID="screen-post">
        {header}
        <EmptyState
          testID="post-unavailable"
          title={t.unavailableTitle}
          text={t.unavailableText}
          action={{ label: t.back, onPress: leave, testID: 'post-unavailable-back' }}
        />
      </SafeAreaView>
    );
  }

  if (!post.data) {
    return (
      <SafeAreaView edges={['top']} style={styles.root} testID="screen-post">
        {header}
        {post.isError ? (
          <ErrorState
            testID="post-error"
            title={t.postErrorTitle}
            text={t.errorText}
            action={{ label: t.retry, onPress: () => post.refetch(), testID: 'post-retry' }}
          />
        ) : (
          <FeedSkeleton rows={2} />
        )}
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View>
      <PostRow post={post.data} clock={clock} onAction={onAction} onOpen={onOpen} full />
      <View style={styles.repliesBar}>
        <AppText variant="bodyStrong" testID="post-replies-count">
          {t.replies(post.data.commentsCount)}
        </AppText>
        <View role="radiogroup" aria-label={t.sortLabel} style={styles.sorts}>
          {sorts.map((s) => (
            <Chip
              key={s}
              label={t.sort[s]}
              selected={s === sort}
              onPress={() => setSort(s)}
              testID={`comments-sort-${s}`}
            />
          ))}
        </View>
      </View>
    </View>
  );

  let body: React.ReactNode = null;
  if (comments.isPending) body = <FeedSkeleton rows={3} />;
  else if (comments.isError && threads.length === 0)
    body = (
      <ErrorState
        testID="comments-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => comments.refetch(), testID: 'comments-retry' }}
      />
    );
  else if (threads.length === 0)
    body = <EmptyState testID="comments-empty" title={t.emptyTitle} text={t.emptyText} />;

  return (
    <SafeAreaView edges={['top']} style={styles.root} testID="screen-post">
      {header}
      <View style={styles.list}>
        {body ? (
          <ScrollView>
            {listHeader}
            {body}
          </ScrollView>
        ) : (
          <FlashList
            data={threads}
            keyExtractor={(thread) => thread.comment.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            onEndReached={() => {
              if (comments.hasNextPage && !comments.isFetchingNextPage) comments.fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              comments.isFetchingNextPage ? (
                <ActivityIndicator
                  color={colors.textMuted}
                  style={styles.more}
                  aria-label={t.loadingMore}
                />
              ) : null
            }
          />
        )}
      </View>
      <PostFooter onCompose={() => toast(t.composerSoon)} />
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 44 },
  list: { flex: 1 },
  repliesBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sorts: { flexDirection: 'row', gap: spacing.xs },
  more: { paddingVertical: spacing.lg },
}));
