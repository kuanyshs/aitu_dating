import { useMyProfile, useSession } from '@/data/hooks';
import { MyPosts } from '@/features/profile/MyPosts';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { strings } from '@/ui/strings';

const t = strings.profileSections;

/** «Мои публикации», opened from the own profile. */
export default function MyPostsScreen() {
  const expired = useSession().data?.accessState === 'ACTIVE_MEMBER_EXPIRED';
  const me = useMyProfile(true);
  return (
    <Screen testID="screen-my-posts" withTabBar={false}>
      <SheetHeader title={t.posts} closeLabel={t.close} testID="my-posts-close" />
      {me.data ? <MyPosts memberId={me.data.id} canWrite={!expired} /> : <FeedSkeleton rows={2} />}
    </Screen>
  );
}
