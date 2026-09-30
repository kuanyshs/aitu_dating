import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cities, cityLabels, type City } from '@/catalogs';
import { isRepositoryError, type FeedTab, type PostView } from '@/contracts';
import {
  useDemoFlags,
  useHomeFeed,
  useLogin,
  useMyProfile,
  useSession,
  useUnreadMessages,
} from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { usePostActions } from '@/features/post/usePostActions';
import { IconAction, PrimaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { PostRow } from '@/ui/components/PostRow';
import { RenewBanner } from '@/ui/components/RenewBanner';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { Menu, MessageCircle } from '@/ui/icons';
import { useTabBarInset } from '@/ui/navigation/tabBarInset';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const guestTabs: FeedTab[] = ['for_you', 'popular', 'city', 'plans'];
const memberTabs: FeedTab[] = ['for_you', 'following', 'popular', 'city', 'plans'];
const cityChoices = cities.filter((c) => c !== 'other');

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
  const tabs = isMember ? memberTabs : guestTabs;

  const canLogin = !!session.data?.canLogin;
  const me = useMyProfile(isMember || isExpired);
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
  // «В городе» starts at the member's Passport city (Алматы for guests) until changed.
  const [chosenCity, setCity] = useState<City | undefined>(undefined);
  const city: City = chosenCity ?? (isMember || isExpired ? me.data?.city : undefined) ?? 'almaty';
  const feed = useHomeFeed(tab, city);
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
        aria-label={strings.home.filtersLabel}
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

      {tab === 'city' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          role="radiogroup"
          aria-label={strings.home.cityLabel}
        >
          {cityChoices.map((c) => (
            <Chip
              key={c}
              label={cityLabels[c]}
              selected={c === city}
              onPress={() => setCity(c)}
              testID={`feed-city-${c}`}
            />
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.divider} />
    </View>
  );

  let body: React.ReactNode = null;
  if (feed.isPending) {
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
    body = (
      <EmptyState
        testID="feed-empty"
        title={strings.feed.emptyTitle}
        text={tab === 'city' ? strings.feed.emptyCity : strings.feed.emptyDefault}
        action={{
          label: strings.feed.emptyAction,
          onPress: () => setTab('for_you'),
          testID: 'feed-empty-action',
        }}
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
  divider: { height: 1, backgroundColor: colors.line },
  footer: { paddingVertical: spacing.xl },
  end: { textAlign: 'center', paddingVertical: spacing.xl },
}));
