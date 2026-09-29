import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useMyPosts } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { usePostActions } from '@/features/post/usePostActions';
import { SecondaryButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { PostRow } from '@/ui/components/PostRow';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

/**
 * «Мои публикации» on the Profile tab: the member's own posts, newest first. A post
 * opens its screen, where «•••» deletes it; the list then loads afresh. With `other`, the
 * same list on another member's profile, under «Публикации».
 */
export function MyPosts({
  memberId,
  canWrite,
  other,
}: {
  memberId: string;
  canWrite: boolean;
  other?: boolean;
}) {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const posts = useMyPosts(memberId);
  const { onAction, onOpen } = usePostActions();
  const t = other ? { ...strings.myPosts, ...strings.memberPosts } : strings.myPosts;
  const id = other ? 'member-posts' : 'my-posts';
  const items = posts.data?.pages.flatMap((p) => p.items) ?? [];

  let body: React.ReactNode;
  if (posts.isPending) body = <FeedSkeleton rows={2} />;
  else if (posts.isError && items.length === 0)
    body = (
      <ErrorState
        testID={`${id}-error`}
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => posts.refetch(), testID: `${id}-retry` }}
      />
    );
  else if (items.length === 0)
    body = (
      <EmptyState
        testID={`${id}-empty`}
        title={t.emptyTitle}
        text={t.emptyText}
        action={
          canWrite && !other
            ? { label: t.write, onPress: () => router.push('/compose'), testID: `${id}-write` }
            : undefined
        }
      />
    );
  else
    body = (
      <View>
        <View style={styles.list}>
          {items.map((post) => (
            <PostRow key={post.id} post={post} clock={clock} onAction={onAction} onOpen={onOpen} />
          ))}
        </View>
        {posts.hasNextPage ? (
          <SecondaryButton
            label={t.more}
            loading={posts.isFetchingNextPage}
            onPress={() => posts.fetchNextPage()}
            testID={`${id}-more`}
          />
        ) : null}
      </View>
    );

  return (
    <View style={styles.section} testID={id}>
      <AppText variant="title" role="heading">
        {t.title}
      </AppText>
      {body}
    </View>
  );
}

const useStyles = createStyles(() => ({
  section: { gap: spacing.sm, marginTop: spacing.xl },
  // Rows carry their own side padding, as in the feed: span the screen's padding.
  list: { marginHorizontal: -spacing.lg },
}));
