import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { activityCategories, activityCategoryLabels, type ActivityCategory } from '@/catalogs';
import type { ActivityItem } from '@/contracts';
import { useActivity, useMarkActivitySeen, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { Avatar } from '@/ui/components/Avatar';
import { SecondaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { ShieldCheck } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.activity;
// There are no mentions in the product yet, so the category has no chip.
const categories = activityCategories.filter((c) => c !== 'mentions');

/**
 * «Активность»: what happened around the member, newest first, by category. Opening the
 * tab marks everything so far as seen; for the rest of the visit whatever came after the
 * previous look stays marked as new, in any category.
 */
export default function ActivityScreen() {
  const styles = useStyles();
  const session = useSession();
  const state = session.data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER' || state === 'ACTIVE_MEMBER_EXPIRED';
  const [category, setCategory] = useState<ActivityCategory>('all');
  const since = useActivityVisit(isMember);

  if (state && !isMember) {
    return (
      <Screen testID="screen-activity">
        <AccessPrompt text={strings.access.prompt.activity} testID="activity-access-prompt" />
      </Screen>
    );
  }
  return (
    <Screen testID="screen-activity">
      <AppText variant="display" role="heading">
        {t.title}
      </AppText>
      <View role="radiogroup" aria-label={t.categoriesLabel} style={styles.chips}>
        {categories.map((c) => (
          <Chip
            key={c}
            label={activityCategoryLabels[c]}
            selected={c === category}
            onPress={() => setCategory(c)}
            testID={`activity-category-${c}`}
          />
        ))}
      </View>
      {isMember ? <ActivityList category={category} since={since} /> : null}
    </Screen>
  );
}

/**
 * The previous look for this visit: `null` on the very first one (everything is new),
 * `undefined` until the tab has been marked seen (the list's own `read` applies).
 * Every focus is a new visit.
 */
type Since = string | null | undefined;

function useActivityVisit(isMember: boolean): Since {
  const { mutateAsync: markSeen } = useMarkActivitySeen();
  const [since, setSince] = useState<Since>(undefined);
  useFocusEffect(
    useCallback(() => {
      if (!isMember) return;
      let current = true;
      markSeen().then(
        (seen) => current && setSince(seen.previousSeenAt ?? null),
        () => undefined,
      );
      return () => {
        current = false;
        setSince(undefined);
      };
    }, [isMember, markSeen]),
  );
  return since;
}

function isNew(item: ActivityItem, since: Since): boolean {
  if (since === undefined) return !item.read;
  if (since === null) return true;
  return new Date(item.createdAt).getTime() > new Date(since).getTime();
}

function ActivityList({ category, since }: { category: ActivityCategory; since: Since }) {
  const list = useActivity(category, true);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  if (list.isPending) return <FeedSkeleton rows={2} />;
  if (list.isError && items.length === 0)
    return (
      <ErrorState
        testID="activity-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => list.refetch(), testID: 'activity-retry' }}
      />
    );
  if (items.length === 0)
    return <EmptyState testID="activity-empty" title={t.emptyTitle} text={t.emptyText} />;
  return (
    <View testID="activity-list">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} fresh={isNew(item, since)} />
      ))}
      {list.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={list.isFetchingNextPage}
          onPress={() => list.fetchNextPage()}
          testID="activity-more"
        />
      ) : null}
    </View>
  );
}

/** Where an event leads: the post, the plan, the person or renewal. */
function targetOf(item: ActivityItem): string | undefined {
  if (item.kind === 'membership_expiring') return '/renew';
  if (item.planId) return `/plan/${item.planId}`;
  if (item.postId) return `/post/${item.postId}`;
  if (item.actor?.view === 'member') return `/member/${item.actor.id}`;
  return undefined;
}

function ActivityRow({ item, fresh }: { item: ActivityItem; fresh: boolean }) {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const { colors } = useTheme();
  const target = targetOf(item);
  const time = formatRelative(item.createdAt, clock);
  return (
    <Pressable
      role="link"
      aria-label={t.kind[item.kind]}
      disabled={!target}
      onPress={() => target && router.push(target)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`activity-${item.id}`}
    >
      {item.actor ? (
        <Avatar avatar={item.actor.avatar} size={40} />
      ) : (
        <View style={styles.systemIcon}>
          <ShieldCheck size={20} color={colors.text} strokeWidth={1.75} aria-hidden />
        </View>
      )}
      <View style={styles.grow}>
        {item.actor ? (
          <AuthorRow author={item.actor} time={time} />
        ) : (
          <AppText variant="bodyStrong">{`${t.system} · ${time}`}</AppText>
        )}
        <AppText tone={fresh ? 'text' : 'textMuted'} testID={`activity-${item.id}-text`}>
          {t.kind[item.kind]}
        </AppText>
      </View>
      {fresh ? (
        <View style={styles.dot} aria-label={t.fresh} testID={`activity-${item.id}-new`} />
      ) : null}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
  systemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
}));
