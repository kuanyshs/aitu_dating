import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { AuthorView } from '@/contracts';
import { useCachedProfile, useFollowList, useSession } from '@/data/hooks';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { Avatar } from '@/ui/components/Avatar';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { IconAction, SecondaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { RenewBanner } from '@/ui/components/RenewBanner';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { ChevronLeft } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.follows;
type Tab = 'followers' | 'following';
const tabs: Tab[] = ['followers', 'following'];

/** «Подписчики» and «Подписки» of a member, for active members. */
export default function FollowsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ memberId: string; tab?: string }>();
  const memberId = String(params.memberId);
  const tab: Tab = params.tab === 'following' ? 'following' : 'followers';
  const session = useSession();
  const state = session.data?.accessState;
  const owner = useCachedProfile(memberId)?.person;
  const title = owner?.view === 'member' ? owner.name : t.title;

  let body: React.ReactNode;
  if (state === 'ACTIVE_MEMBER') body = <FollowList memberId={memberId} tab={tab} />;
  else if (state === 'ACTIVE_MEMBER_EXPIRED') body = <RenewBanner testID="follows-renew" />;
  else if (state)
    body = <AccessPrompt text={strings.access.prompt.member} testID="follows-access-prompt" />;

  return (
    <Screen testID="screen-follows" withTabBar={false}>
      <View style={styles.header}>
        <IconAction
          icon={ChevronLeft}
          accessibilityLabel={t.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          testID="follows-back"
        />
        <AppText variant="bodyStrong" role="heading" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        <View style={styles.spacer} />
      </View>
      <View role="radiogroup" aria-label={t.tabsLabel} style={styles.tabs}>
        {tabs.map((item) => (
          <Chip
            key={item}
            label={t.tabs[item]}
            selected={item === tab}
            onPress={() => router.setParams({ tab: item })}
            testID={`follows-tab-${item}`}
          />
        ))}
      </View>
      {body}
    </Screen>
  );
}

function FollowList({ memberId, tab }: { memberId: string; tab: Tab }) {
  const list = useFollowList(memberId, tab);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  if (list.isPending) return <FeedSkeleton rows={2} />;
  if (list.isError && items.length === 0)
    return (
      <ErrorState
        testID="follows-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => list.refetch(), testID: 'follows-retry' }}
      />
    );
  if (items.length === 0)
    return (
      <EmptyState
        testID="follows-empty"
        title={tab === 'followers' ? t.emptyFollowers : t.emptyFollowing}
        text={t.emptyText}
      />
    );
  return (
    <View testID="follows-list">
      {items.map((person, index) => (
        <PersonRow key={person.view === 'member' ? person.id : index} person={person} />
      ))}
      {list.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={list.isFetchingNextPage}
          onPress={() => list.fetchNextPage()}
          testID="follows-more"
        />
      ) : null}
    </View>
  );
}

function PersonRow({ person }: { person: AuthorView }) {
  const styles = useStyles();
  const router = useRouter();
  const content = (
    <>
      <Avatar avatar={person.avatar} size={40} />
      <View style={styles.grow}>
        <AuthorRow author={person} />
        {/* The row above names the city; the age goes under it. */}
        <AppText variant="caption" tone="textMuted">
          {t.age(person.age)}
        </AppText>
      </View>
    </>
  );
  if (person.view !== 'member') return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      role="link"
      aria-label={t.openMember(person.name)}
      // One's own id opens the Profile tab from there.
      onPress={() => router.push(`/member/${person.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`follows-person-${person.id}`}
    >
      {content}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', marginLeft: -spacing.sm },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: 44 },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  grow: { flex: 1, gap: 2 },
}));
