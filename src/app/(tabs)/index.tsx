import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cities, cityLabels, type City } from '@/catalogs';
import { isRepositoryError, type FeedTab, type PostView } from '@/contracts';
import { useHomeFeed, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { IconAction, PrimaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { PostRow, type PostAction } from '@/ui/components/PostRow';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { Info } from '@/ui/icons';
import { useTabBarInset } from '@/ui/navigation/tabBarInset';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
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
  const tabs = isMember ? memberTabs : guestTabs;

  const [tab, setTab] = useState<FeedTab>('for_you');
  const [city, setCity] = useState<City>('almaty');
  const feed = useHomeFeed(tab, city);
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  const openAccess = useCallback(() => router.push('/access'), [router]);
  // Guests: every social action leads into the single access flow.
  const onAction = useCallback(
    (_action: PostAction, _post: PostView) => openAccess(),
    [openAccess],
  );

  const renderItem = useCallback(
    ({ item }: { item: PostView }) => <PostRow post={item} clock={clock} onAction={onAction} />,
    [clock, onAction],
  );

  const header = (
    <View>
      <View style={styles.header}>
        <IconAction
          icon={Info}
          accessibilityLabel={strings.home.about}
          onPress={() => router.push('/about')}
          testID="home-about"
        />
        <View style={styles.brand}>
          <AppText variant="title" role="heading">
            {strings.home.brand}
          </AppText>
          <AppText variant="caption" tone="textMuted">
            {isMember ? strings.home.descriptorMember : strings.home.descriptorGuest}
          </AppText>
        </View>
        {isMember ? (
          <View style={styles.headerSide} />
        ) : (
          <PrimaryButton
            label={strings.home.join}
            onPress={openAccess}
            testID="home-join"
            style={styles.join}
          />
        )}
      </View>

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
  } else if (feed.isError) {
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
          data={posts}
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
  headerSide: { width: 44 },
  join: { minHeight: 40, paddingHorizontal: spacing.lg },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.line },
  footer: { paddingVertical: spacing.xl },
  end: { textAlign: 'center', paddingVertical: spacing.xl },
}));
