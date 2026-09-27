import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { isRepositoryError, type PostView } from '@/contracts';
import { useSession, useSetReaction, useSetRepost } from '@/data/hooks';
import type { PostAction, PostTarget } from '@/ui/components/PostRow';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';

import { socialGate } from './socialGate';

/** Where a social action leads for someone who cannot take it yet. */
export function useSocialGate() {
  const router = useRouter();
  const state = useSession().data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER';
  const isExpired = state === 'ACTIVE_MEMBER_EXPIRED';
  /**
   * Guests go to the single access flow, expired members to Продление; a tap while the
   * session is still loading does nothing. Returns true only when the action may go on.
   */
  const allow = useCallback(() => {
    const gate = socialGate(state);
    if (gate === 'renew') router.push('/renew');
    if (gate === 'access') router.push('/access');
    return gate === 'allow';
  }, [state, router]);
  return { isMember, isExpired, allow };
}

/**
 * The actions of a post row, shared by the feed and the post screen: members like,
 * repost and quote for real; everyone else is sent on.
 */
export function usePostActions() {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const { mutate: likePost } = useSetReaction();
  const { mutate: repost } = useSetRepost();
  const { allow } = useSocialGate();

  const onAction = useCallback(
    (action: PostAction, post: PostView) => {
      if (!allow()) return;
      // 💬 opens the post with the reply surface already on top.
      if (action === 'comment') {
        return router.push({ pathname: '/post/[id]', params: { id: post.id, compose: '1' } });
      }
      // «Цитировать» starts a new post around this one.
      if (action === 'quote') {
        return router.push({ pathname: '/compose', params: { quote: post.id } });
      }
      const failed = (message: string) => (error: Error) =>
        isRepositoryError(error) && error.code === 'MEMBERSHIP_EXPIRED'
          ? router.push('/renew')
          : toast(message);
      if (action === 'repost') {
        if (post.mine) return;
        return repost(
          { postId: post.id, active: !post.repostedByMe },
          { onError: failed(strings.post.repostFailed) },
        );
      }
      likePost(
        { postId: post.id, active: !post.reactedByMe },
        { onError: failed(strings.post.reactionFailed) },
      );
    },
    [allow, likePost, repost, router, toast],
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
