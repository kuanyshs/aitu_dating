import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { MyAction, MyActionCategory } from '@/contracts';
import { useMyActions } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { Avatar } from '@/ui/components/Avatar';
import { SecondaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { formatRelative, fullName } from '@/ui/format';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.myActions;
const categories = Object.keys(t.categories) as MyActionCategory[];

/** «Мои действия»: what the member did themselves, newest first, by kind. */
export default function MyActionsScreen() {
  const styles = useStyles();
  const [category, setCategory] = useState<MyActionCategory>('all');
  return (
    <Screen testID="screen-my-actions" withTabBar={false}>
      <SheetHeader title={t.title} closeLabel={t.close} testID="my-actions-close" />
      <View role="radiogroup" aria-label={t.categoriesLabel} style={styles.chips}>
        {categories.map((c) => (
          <Chip
            key={c}
            label={t.categories[c]}
            selected={c === category}
            onPress={() => setCategory(c)}
            testID={`my-actions-category-${c}`}
          />
        ))}
      </View>
      <List category={category} />
    </Screen>
  );
}

function List({ category }: { category: MyActionCategory }) {
  const list = useMyActions(category);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  if (list.isPending) return <FeedSkeleton rows={2} />;
  if (list.isError && items.length === 0)
    return (
      <ErrorState
        testID="my-actions-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => list.refetch(), testID: 'my-actions-retry' }}
      />
    );
  if (items.length === 0)
    return <EmptyState testID="my-actions-empty" title={t.emptyTitle} text={t.emptyText} />;
  return (
    <View testID="my-actions-list">
      {items.map((item) => (
        <Row key={item.id} item={item} />
      ))}
      {list.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={list.isFetchingNextPage}
          onPress={() => list.fetchNextPage()}
          testID="my-actions-more"
        />
      ) : null}
    </View>
  );
}

function Row({ item }: { item: MyAction }) {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const person = item.person;
  const name = person?.view === 'member' ? fullName(person) : undefined;
  const open = () => {
    if (item.postId) router.push(`/post/${item.postId}`);
    else if (person?.view === 'member') router.push(`/member/${person.id}`);
  };
  return (
    <Pressable
      role="link"
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`my-action-${item.id}`}
    >
      {person ? <Avatar avatar={person.avatar} size={40} /> : null}
      <View style={styles.grow}>
        <AppText variant="bodyStrong">
          {name ? `${t.kind[item.kind]} · ${name}` : t.kind[item.kind]}
        </AppText>
        {item.excerpt ? (
          <AppText tone="textMuted" numberOfLines={2}>
            {item.excerpt}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="textMuted">
          {formatRelative(item.createdAt, clock)}
        </AppText>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  grow: { flex: 1, gap: 2 },
}));
