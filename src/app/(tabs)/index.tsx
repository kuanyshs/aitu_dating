import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isRepositoryError,
  type FeedContent,
  type FeedFilters,
  type FeedTab,
  type PostView,
} from '@/contracts';
import {
  useDemoFlags,
  useFeedFilters,
  useHomeFeed,
  useLogin,
  useSession,
  useUnreadMessages,
} from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { usePostActions } from '@/features/post/usePostActions';
import { useSettings } from '@/settings';
import { IconAction, PrimaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { PostRow } from '@/ui/components/PostRow';
import { RenewBanner } from '@/ui/components/RenewBanner';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { Menu, MessageCircle, Search, SlidersHorizontal } from '@/ui/icons';
import { useTabBarInset } from '@/ui/navigation/tabBarInset';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const tabs: FeedTab[] = ['for_you', 'popular', 'following'];
const contents: FeedContent[] = ['all', 'posts', 'plans'];

const chosenCount = (filters?: FeedFilters | null) =>
  filters ? Object.values(filters).filter((options) => options.length > 0).length : 0;

export default function HomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const { colors } = useTheme();
  const tabBarInset = useTabBarInset();

  const session = useSession();
  const isMember = session.data?.accessState === 'ACTIVE_MEMBER';
  const unread = useUnreadMessages(isMember);
  const isExpired = session.data?.accessState === 'ACTIVE_MEMBER_EXPIRED';

  const canLogin = !!session.data?.canLogin;
  const login = useLogin();
  const toast = useToast((s) => s.show);

  const [tab, setTab] = useState<FeedTab>('for_you');
  // After publishing, the editor sends the author back to «Для вас», where the post leads.
  const { feed: requestedTab } = useLocalSearchParams<{ feed?: string }>();
  const [seenRequest, setSeenRequest] = useState(requestedTab);
  if (requestedTab !== seenRequest) {
    setSeenRequest(requestedTab);
    if (requestedTab === 'for_you') setTab('for_you');
  }
  // The new post leads the feed: show the top, not where the reader had scrolled to.
  const list = useRef<FlashListRef<PostView>>(null);
  useEffect(() => {
    if (!requestedTab) return;
    list.current?.scrollToOffset({ offset: 0, animated: false });
    router.setParams({ feed: undefined });
  }, [requestedTab, router]);
  const content = useSettings((s) => s.feedContent[tab]);
  const setFeedContent = useSettings((s) => s.setFeedContent);
  const guestFilters = useSettings((s) => s.guestFilters);
  const hasCard = isMember || isExpired;
  const memberFilters = useFeedFilters(hasCard);
  const filtersCount = chosenCount(hasCard ? memberFilters.data : guestFilters);
  // «Подписки» are for members; a guest gets an invitation instead of a request.
  const guestFollowing = tab === 'following' && !hasCard && !!session.data;
  // A member's filters live with their account; a guest's travel with each request.
  const feed = useHomeFeed(tab, {
    content,
    filters: !hasCard && tab === 'for_you' ? (guestFilters ?? undefined) : undefined,
    enabled: !guestFollowing,
  });
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  // Offline keeps showing the last loaded feed under the global banner; any other
  // failure (or offline with nothing cached) shows the error with a retry.
  const { offline } = useDemoFlags();
  const showError = feed.isError && (posts.length === 0 || !offline);

  const openAccess = useCallback(() => router.push('/access'), [router]);
  const { onAction, onOpen } = usePostActions();

  const renderItem = useCallback(
    ({ item }: { item: PostView }) => (
      <PostRow post={item} clock={clock} onAction={onAction} onOpen={onOpen} />
    ),
    [clock, onAction, onOpen],
  );

  const header = (
    <View>
      <View style={styles.header}>
        <IconAction
          icon={Menu}
          accessibilityLabel={strings.menu.open}
          onPress={() => router.push('/menu')}
          testID="home-menu"
        />
        <View style={styles.brand}>
          <AppText variant="title" role="heading">
            {strings.home.brand}
          </AppText>
          <AppText variant="caption" tone="textMuted">
            {isMember
              ? strings.home.descriptorMember
              : isExpired
                ? strings.home.descriptorExpired
                : strings.home.descriptorGuest}
          </AppText>
        </View>
        {isMember ? (
          <View>
            <IconAction
              icon={MessageCircle}
              accessibilityLabel={
                unread ? strings.home.messagesUnread(unread) : strings.home.messages
              }
              onPress={() => router.push('/chats')}
              testID="home-messages"
            />
            {unread ? (
              <View style={styles.unread} pointerEvents="none" testID="home-messages-unread">
                <AppText variant="caption" tone="onPrimary">
                  {String(unread)}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : isExpired ? (
          <PrimaryButton
            label={strings.renew.short}
            accessibilityLabel={strings.renew.action}
            onPress={() => router.push('/renew')}
            testID="home-renew"
            style={styles.join}
          />
        ) : canLogin ? (
          <PrimaryButton
            label={strings.session.login}
            accessibilityLabel={strings.session.loginLabel}
            loading={login.isPending}
            onPress={() =>
              login.mutate(undefined, {
                onSuccess: () => toast(strings.session.loggedIn),
                onError: () => toast(strings.session.failed),
              })
            }
            testID="home-login"
            style={styles.join}
          />
        ) : (
          <PrimaryButton
            label={strings.home.join}
            onPress={openAccess}
            testID="home-join"
            style={styles.join}
          />
        )}
      </View>

      {isExpired ? (
        <View style={styles.banner}>
          <RenewBanner testID="home-renew-banner" />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        role="radiogroup"
        aria-label={strings.home.feedsLabel}
      >
        {tabs.map((t) => (
          <Chip
            key={t}
            label={strings.home.tabs[t]}
            selected={t === tab}
            onPress={() => setTab(t)}
            testID={`feed-tab-${t}`}
          />
        ))}
      </ScrollView>

      <View style={styles.contentRow} role="radiogroup" aria-label={strings.home.contentLabel}>
        {contents.map((c) => (
          <Chip
            key={c}
            label={strings.home.content[c]}
            selected={c === content}
            onPress={() => setFeedContent(tab, c)}
            testID={`feed-content-${c}`}
          />
        ))}
      </View>

      {tab === 'for_you' ? (
        <View style={styles.tools}>
          <Pressable
            role="link"
            aria-label={strings.home.search}
            onPress={() => router.push('/search')}
            style={styles.search}
            testID="home-search"
          >
            <Search size={18} color={colors.textMuted} />
            <AppText tone="textMuted" numberOfLines={1} style={styles.searchText}>
              {strings.home.search}
            </AppText>
          </Pressable>
          <Pressable
            role="button"
            aria-label={
              filtersCount ? strings.home.filtersCount(filtersCount) : strings.home.filters
            }
            onPress={() => router.push('/feed-filters')}
            style={styles.filters}
            testID="home-filters"
          >
            <SlidersHorizontal size={18} color={colors.text} />
            <AppText variant="bodyStrong">{strings.home.filters}</AppText>
            {filtersCount ? (
              <View style={styles.count} testID="home-filters-count">
                <AppText variant="caption" tone="onPrimary">
                  {String(filtersCount)}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : null}

      <View style={styles.divider} />
    </View>
  );

  let body: React.ReactNode = null;
  if (guestFollowing) {
    body = (
      <EmptyState
        testID="feed-empty"
        title={strings.feed.emptyFollowingTitle}
        text={strings.feed.guestFollowing}
        action={{ label: strings.home.join, onPress: openAccess, testID: 'feed-empty-action' }}
      />
    );
  } else if (feed.isPending) {
    body = <FeedSkeleton />;
  } else if (showError) {
    const network = isRepositoryError(feed.error) && feed.error.code === 'NETWORK_ERROR';
    body = (
      <ErrorState
        testID="feed-error"
        title={strings.feed.errorTitle}
        text={network ? strings.feed.errorNetwork : strings.feed.errorDefault}
        action={{ label: strings.feed.retry, onPress: () => feed.refetch(), testID: 'feed-retry' }}
      />
    );
  } else if (posts.length === 0) {
    body =
      content !== 'all' ? (
        <EmptyState
          testID="feed-empty"
          title={strings.feed.emptyTitle}
          text={strings.feed.emptyContent}
          action={{
            label: strings.feed.showAll,
            onPress: () => setFeedContent(tab, 'all'),
            testID: 'feed-empty-action',
          }}
        />
      ) : tab === 'following' ? (
        <EmptyState
          testID="feed-empty"
          title={strings.feed.emptyFollowingTitle}
          text={strings.feed.emptyFollowing}
          action={{
            label: strings.feed.findPeople,
            onPress: () => router.push('/search'),
            testID: 'feed-empty-action',
          }}
        />
      ) : (
        <EmptyState
          testID="feed-empty"
          title={strings.feed.emptyTitle}
          text={strings.feed.emptyDefault}
        />
      );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root} testID="screen-home">
      {body ? (
        <ScrollView contentContainerStyle={{ paddingBottom: tabBarInset }}>
          {header}
          {body}
        </ScrollView>
      ) : (
        <FlashList
          ref={list}
          data={posts}
          // A post that arrives on top (one's own, just published) must be seen, not
          // pushed above the fold to keep the current row in place.
          maintainVisibleContentPosition={{ disabled: true }}
          keyExtractor={(post) => post.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: tabBarInset }}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => feed.refetch()}
              tintColor={colors.textMuted}
            />
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator
                color={colors.textMuted}
                style={styles.footer}
                aria-label={strings.feed.loadingMore}
              />
            ) : !feed.hasNextPage ? (
              <AppText variant="caption" tone="textMuted" style={styles.end}>
                {strings.feed.endOfFeed}
              </AppText>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  brand: { flex: 1, alignItems: 'center' },
  banner: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  join: { minHeight: 40, paddingHorizontal: spacing.lg },
  unread: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  contentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchText: { flex: 1 },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  divider: { height: 1, backgroundColor: colors.line },
  footer: { paddingVertical: spacing.xl },
  end: { textAlign: 'center', paddingVertical: spacing.xl },
}));
