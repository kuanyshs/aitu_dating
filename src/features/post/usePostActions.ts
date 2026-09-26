import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { isRepositoryError, type PostView } from '@/contracts';
import { useSession, useSetReaction } from '@/data/hooks';
import type { PostAction, PostTarget } from '@/ui/components/PostRow';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';

/** Where a social action leads for someone who cannot take it yet. */
export function useSocialGate() {
  const router = useRouter();
  const state = useSession().data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER';
  const isExpired = state === 'ACTIVE_MEMBER_EXPIRED';
  /** Guests go to the single access flow, expired members to Продление. Returns false then. */
  const allow = useCallback(() => {
    if (isExpired) {
      router.push('/renew');
      return false;
    }
    if (!isMember) {
      router.push('/access');
      return false;
    }
    return true;
  }, [isExpired, isMember, router]);
  return { isMember, isExpired, allow };
}

/**
 * The actions of a post row, shared by the feed and the post screen: members like for
 * real and get honest feedback on what is still to come; everyone else is sent on.
 */
export function usePostActions() {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const { mutate: likePost } = useSetReaction();
  const { allow } = useSocialGate();

  const onAction = useCallback(
    (action: PostAction, post: PostView) => {
      if (!allow()) return;
      // 💬 opens the post with the reply surface already on top.
      if (action === 'comment') {
        return router.push({ pathname: '/post/[id]', params: { id: post.id, compose: '1' } });
      }
      if (action !== 'reaction') return toast(strings.post.comingSoon);
      likePost(
        { postId: post.id, active: !post.reactedByMe },
        {
          onError: (error) =>
            isRepositoryError(error) && error.code === 'MEMBERSHIP_EXPIRED'
              ? router.push('/renew')
              : toast(strings.post.reactionFailed),
        },
      );
    },
    [allow, likePost, router, toast],
  );

  const onOpen = useCallback(
    (target: PostTarget) =>
      router.push(
        target.kind === 'post'
          ? `/post/${target.id}`
          : target.kind === 'plan'
            ? `/plan/${target.id}`
            : `/member/${target.id}`,
      ),
    [router],
  );

  return { onAction, onOpen };
}
