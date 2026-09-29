import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import type { City } from '@/catalogs';
import type {
  AccessFlowState,
  CommentPage,
  CommentSort,
  CommentView,
  CreatePostInput,
  CreateReportInput,
  FeedTab,
  SetBlockInput,
  MembershipSelection,
  PartialAnswers,
  PostView,
  ProfileStepInput,
  ProfileView,
  ReportStatus,
  ResolveReportInput,
  RenewMembershipInput,
  SaveAnswerInput,
} from '@/contracts';
import { drafts } from '@/drafts';
import type { DemoFlags } from '@/repository/mock';

import { useDemoControls, useRepository } from './RepositoryProvider';

export const queryKeys = {
  session: ['session'] as const,
  feed: (tab: FeedTab, city: City | undefined) => ['feed', tab, city ?? null] as const,
  demoFlags: ['demo', 'flags'] as const,
  accessFlow: ['access', 'flow'] as const,
  candidates: ['access', 'candidates'] as const,
  myProfile: ['me', 'profile'] as const,
  candidateStatus: ['demo', 'candidates'] as const,
  post: (postId: string) => ['post', postId] as const,
  comments: (postId: string, sort: CommentSort) => ['comments', postId, sort] as const,
  profilePosts: (memberId: string) => ['profile-posts', memberId] as const,
  myReports: ['my-reports'] as const,
  blocked: ['blocked'] as const,
  profile: (memberId: string) => ['profile', memberId] as const,
  moderation: (status: ReportStatus) => ['moderation', status] as const,
};

export function useSession() {
  const repository = useRepository();
  return useQuery({ queryKey: queryKeys.session, queryFn: () => repository.getSession() });
}

export function useHomeFeed(tab: FeedTab, city?: City) {
  const repository = useRepository();
  return useInfiniteQuery({
    queryKey: queryKeys.feed(tab, city),
    queryFn: ({ pageParam }) =>
      repository.getHomeFeed({ tab, city: tab === 'city' ? city : undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });
}

const noFlags: DemoFlags = { networkErrorOnce: false, offline: false, failedMessageOnce: false };

/** Current demo switches; all off when demo tools are disabled. */
export function useDemoFlags(): DemoFlags {
  const demo = useDemoControls();
  const query = useQuery({
    queryKey: queryKeys.demoFlags,
    queryFn: () => demo!.getDemoFlags(),
    enabled: !!demo,
  });
  return query.data ?? noFlags;
}

/** Flips demo switches and refetches every active query so screens react right away. */
export function useSetDemoFlags() {
  const demo = useDemoControls();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<DemoFlags>) => demo!.setDemoFlags(patch),
    onSuccess: async (flags) => {
      client.setQueryData(queryKeys.demoFlags, flags);
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'demo' });
    },
  });
}

/** Back to a fresh guest preview: clears the mock backend and every cached response. */
export function useResetDemo() {
  const demo = useDemoControls();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await demo!.resetDemo();
      await drafts.clearAll();
    },
    // Everything cached belongs to the old demo, including the access flow.
    onSuccess: async () => {
      await client.resetQueries();
    },
  });
}

export function useAccessFlow() {
  const repository = useRepository();
  return useQuery({ queryKey: queryKeys.accessFlow, queryFn: () => repository.getAccessFlow() });
}

export function usePassportCandidates() {
  const repository = useRepository();
  return useQuery({
    queryKey: queryKeys.candidates,
    queryFn: () => repository.listPassportCandidates(),
    staleTime: Infinity,
  });
}

/** Wraps an access-flow step: the server's answer becomes the cached flow state. */
function useFlowMutation<TInput>(run: (input: TInput) => Promise<AccessFlowState>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (flow) => {
      client.setQueryData(queryKeys.accessFlow, flow);
      void client.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useStartAccess() {
  const repository = useRepository();
  return useFlowMutation((_: void) => repository.startAccess());
}

export function useSelectPassport() {
  const repository = useRepository();
  return useFlowMutation((candidateId: string) => repository.selectPassport({ candidateId }));
}

export function useAcceptRules() {
  const repository = useRepository();
  return useFlowMutation((rulesVersion: string) => repository.acceptRules({ rulesVersion }));
}

export function useSelectMembership() {
  const repository = useRepository();
  return useFlowMutation((selection: MembershipSelection) =>
    repository.selectMembership(selection),
  );
}

export function useConfirmPayment() {
  const repository = useRepository();
  return useFlowMutation((idempotencyKey: string) => repository.confirmPayment({ idempotencyKey }));
}

export function useSaveProfileStep() {
  const repository = useRepository();
  return useFlowMutation((input: ProfileStepInput) => repository.saveProfileStep(input));
}

export function useSaveAnswer() {
  const repository = useRepository();
  return useFlowMutation((input: SaveAnswerInput) => repository.saveAnswer(input));
}

/** Publishes the card; afterwards every cached response belongs to the guest and is reset. */
export function useCompleteOnboarding() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { answers: PartialAnswers; idempotencyKey: string }) =>
      repository.completeOnboarding(input),
    onSuccess: async (me) => {
      await client.resetQueries();
      client.setQueryData(queryKeys.myProfile, me);
    },
  });
}

export function useMyProfile(enabled = true) {
  const repository = useRepository();
  return useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: () => repository.getMyProfile(),
    enabled,
  });
}

/** Session switches change what every screen may see, so all cached data is dropped. */
function useSessionSwitch(run: () => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await client.resetQueries();
    },
  });
}

export function useLogout() {
  const repository = useRepository();
  return useSessionSwitch(() => repository.logout());
}

export function useLogin() {
  const repository = useRepository();
  return useSessionSwitch(() => repository.login());
}

export function useSwitchCandidate() {
  const demo = useDemoControls();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: string) => demo!.switchCandidate(candidateId),
    onSuccess: async () => {
      await client.resetQueries();
    },
  });
}

export function useCandidateStatus() {
  const demo = useDemoControls();
  return useQuery({
    queryKey: queryKeys.candidateStatus,
    queryFn: () => demo!.listCandidateStatus(),
    enabled: !!demo,
  });
}

/** Продление changes what the member may see, so every cached response is reset. */
export function useRenewMembership() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RenewMembershipInput) => repository.renewMembership(input),
    onSuccess: async (me) => {
      await client.resetQueries();
      client.setQueryData(queryKeys.myProfile, me);
    },
  });
}

type FeedData = InfiniteData<{ items: PostView[] }>;

type CommentsData = InfiniteData<CommentPage>;
type PostPatch = Partial<Pick<PostView, 'reactions' | 'reactedByMe' | 'reposts' | 'repostedByMe'>>;

/** Writes a post's new like or repost state into every cached feed page and the post itself. */
function patchPost(client: QueryClient, postId: string, patch: PostPatch) {
  client.setQueriesData<FeedData>({ queryKey: ['feed'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
          })),
        }
      : data,
  );
  client.setQueryData<PostView>(queryKeys.post(postId), (post) =>
    post ? { ...post, ...patch } : post,
  );
}

function findPost(client: QueryClient, postId: string): PostView | undefined {
  const cached = client.getQueryData<PostView>(queryKeys.post(postId));
  if (cached) return cached;
  for (const [, data] of client.getQueriesData<FeedData>({ queryKey: ['feed'] })) {
    const found = data?.pages.flatMap((p) => p.items).find((p) => p.id === postId);
    if (found) return found;
  }
  return undefined;
}

/** Like / unlike a post: shown at once everywhere, rolled back if the server refuses. */
export function useSetReaction() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: string; active: boolean }) =>
      repository.setReaction({ ...input, reaction: 'like' }),
    onMutate: async ({ postId, active }) => {
      await client.cancelQueries({ queryKey: queryKeys.post(postId) });
      const before = findPost(client, postId);
      if (before && before.reactedByMe !== active) {
        patchPost(client, postId, {
          reactedByMe: active,
          reactions: Math.max(0, before.reactions + (active ? 1 : -1)),
        });
      }
      return { before };
    },
    onError: (_error, { postId }, context) => {
      if (context?.before) {
        const { reactions, reactedByMe } = context.before;
        patchPost(client, postId, { reactions, reactedByMe });
      }
    },
    onSuccess: (result) =>
      patchPost(client, result.postId, {
        reactions: result.reactions,
        reactedByMe: result.reactedByMe,
      }),
  });
}

/** Repost / undo it: shown at once everywhere, rolled back if the server refuses. */
export function useSetRepost() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: string; active: boolean }) => repository.setRepost(input),
    onMutate: async ({ postId, active }) => {
      await client.cancelQueries({ queryKey: queryKeys.post(postId) });
      const before = findPost(client, postId);
      if (before && before.repostedByMe !== active) {
        patchPost(client, postId, {
          repostedByMe: active,
          reposts: Math.max(0, before.reposts + (active ? 1 : -1)),
        });
      }
      return { before };
    },
    onError: (_error, { postId }, context) => {
      if (context?.before) {
        const { reposts, repostedByMe } = context.before;
        patchPost(client, postId, { reposts, repostedByMe });
      }
    },
    onSuccess: (result) =>
      patchPost(client, result.postId, {
        reposts: result.reposts,
        repostedByMe: result.repostedByMe,
      }),
  });
}

type CommentPatch = Pick<CommentView, 'reactions' | 'reactedByMe'>;

function patchComment(
  data: CommentsData,
  commentId: string,
  patch: (c: CommentView) => CommentPatch,
) {
  const apply = (c: CommentView) => (c.id === commentId ? { ...c, ...patch(c) } : c);
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((t) => ({ comment: apply(t.comment), replies: t.replies.map(apply) })),
    })),
  };
}

/**
 * Like / unlike a comment on a post screen. The heart changes at once in every sort; the
 * «Популярные» order is refreshed on the next load, so rows never jump under a finger.
 */
export function useSetCommentReaction(postId: string) {
  const repository = useRepository();
  const client = useQueryClient();
  const key = ['comments', postId];
  return useMutation({
    mutationFn: (input: { commentId: string; active: boolean }) =>
      repository.setCommentReaction(input),
    onMutate: async ({ commentId, active }) => {
      await client.cancelQueries({ queryKey: key });
      const snapshot = client.getQueriesData<CommentsData>({ queryKey: key });
      client.setQueriesData<CommentsData>({ queryKey: key }, (data) =>
        data
          ? patchComment(data, commentId, (c) =>
              c.reactedByMe === active
                ? c
                : { reactedByMe: active, reactions: Math.max(0, c.reactions + (active ? 1 : -1)) },
            )
          : data,
      );
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      for (const [queryKey, data] of context?.snapshot ?? []) client.setQueryData(queryKey, data);
    },
    onSuccess: (result) => {
      client.setQueriesData<CommentsData>({ queryKey: key }, (data) =>
        data
          ? patchComment(data, result.commentId, () => ({
              reactions: result.reactions,
              reactedByMe: result.reactedByMe,
            }))
          : data,
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: key, refetchType: 'none' }),
  });
}

export function useSetRestricted() {
  const demo = useDemoControls();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (restricted: boolean) => demo!.setCurrentRestricted(restricted),
    onSuccess: async () => {
      await client.resetQueries();
    },
  });
}

export function useSetModeratorRole() {
  const demo = useDemoControls();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => demo!.setModeratorRole(enabled),
    onSuccess: async () => {
      await client.resetQueries();
    },
  });
}

export function useExpireMembership() {
  const demo = useDemoControls();
  return useSessionSwitch(() => demo!.expireMembership());
}

export function useRestoreMembership() {
  const demo = useDemoControls();
  return useSessionSwitch(() => demo!.restoreMembership());
}

/** A post by id; starts from the copy already in a cached feed page, so offline shows it. */
export function usePost(postId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const repository = useRepository();
  const client = useQueryClient();
  return useQuery({
    enabled,
    queryKey: queryKeys.post(postId),
    queryFn: () => repository.getPost({ postId }),
    initialData: () => {
      for (const [, data] of client.getQueriesData<FeedData>({ queryKey: ['feed'] })) {
        const found = data?.pages.flatMap((p) => p.items).find((p) => p.id === postId);
        if (found) return found;
      }
      return undefined;
    },
    initialDataUpdatedAt: 0,
  });
}

/** Comment threads of a post, ten root threads per page. */
export function usePostComments(postId: string, sort: CommentSort) {
  const repository = useRepository();
  return useInfiniteQuery({
    queryKey: queryKeys.comments(postId, sort),
    queryFn: ({ pageParam }) => repository.listComments({ postId, sort, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });
}

/**
 * Publishes a Комментарий or an Ответ. Not optimistic: the reply surface shows
 * «Отправляем…» and keeps the text until the server confirms; then the thread reloads
 * and every cached copy of the post counts one more reply.
 */
export function useCreateComment(postId: string) {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { parentId?: string; text: string; idempotencyKey: string }) =>
      repository.createComment({ postId, ...input }),
    onSuccess: async () => {
      const bump = (post: PostView) =>
        post.id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post;
      client.setQueriesData<FeedData>({ queryKey: ['feed'] }, (data) =>
        data
          ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map(bump) })) }
          : data,
      );
      client.setQueryData<PostView>(queryKeys.post(postId), (post) => (post ? bump(post) : post));
      await client.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}

/** Publishes a Пост, Вопрос or Цитата; the feed and the author's posts load it afresh. */
export function useCreatePost() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => repository.createPost(input),
    onSuccess: async (post) => {
      client.setQueryData(queryKeys.post(post.id), post);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['feed'] }),
        client.invalidateQueries({ queryKey: ['profile-posts'] }),
      ]);
    },
  });
}

/** Sends a Жалоба; «Мои жалобы» then load afresh. */
export function useCreateReport() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportInput) => repository.createReport(input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.myReports }),
  });
}

/**
 * Sets or lifts a Блокировка. Whatever was loaded may now show or hide the other person,
 * so every content query reloads; an open screen of theirs reads «недоступна».
 */
export function useSetBlock() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SetBlockInput) => repository.setBlock(input),
    onSuccess: () =>
      Promise.all(
        ['feed', 'post', 'comments', 'profile', 'profile-posts', 'follows', 'blocked'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

/** A comment already loaded on any post screen, found by its id alone. */
export function useCachedCommentById(commentId: string): CommentView | undefined {
  const client = useQueryClient();
  for (const [, data] of client.getQueriesData<CommentsData>({ queryKey: ['comments'] })) {
    for (const page of data?.pages ?? []) {
      for (const thread of page.items) {
        const found = [thread.comment, ...thread.replies].find((c) => c.id === commentId);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/** A post already loaded by the feed or the post screen; never fetches on its own. */
export function useCachedPost(postId: string): PostView | undefined {
  const client = useQueryClient();
  return findPost(client, postId);
}

/** A comment already loaded on the post screen, to show as the reply's context. */
export function useCachedComment(postId: string, commentId: string | undefined) {
  const client = useQueryClient();
  if (!commentId) return undefined;
  for (const [, data] of client.getQueriesData<CommentsData>({ queryKey: ['comments', postId] })) {
    for (const page of data?.pages ?? []) {
      for (const thread of page.items) {
        const found = [thread.comment, ...thread.replies].find((c) => c.id === commentId);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/** Deletes an own comment; the thread reloads and every copy of the post counts one less. */
export function useDeleteComment(postId: string) {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => repository.deleteComment({ commentId }),
    onSuccess: async () => {
      const drop = (post: PostView) =>
        post.id === postId ? { ...post, commentsCount: Math.max(0, post.commentsCount - 1) } : post;
      client.setQueriesData<FeedData>({ queryKey: ['feed'] }, (data) =>
        data
          ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map(drop) })) }
          : data,
      );
      client.setQueryData<PostView>(queryKeys.post(postId), (post) => (post ? drop(post) : post));
      await client.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}

/** Deletes an own post and removes it from every cached feed page at once. */
export function useDeletePost() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => repository.deletePost({ postId }),
    onSuccess: (_result, postId) => {
      client.setQueriesData<FeedData>({ queryKey: ['feed'] }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((p) => ({
                ...p,
                items: p.items.filter((post) => post.id !== postId),
              })),
            }
          : data,
      );
      // The open screen is leaving; a later visit reloads and finds it unavailable.
      void client.invalidateQueries({ queryKey: queryKeys.post(postId), refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['comments', postId], refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['profile-posts'] });
    },
  });
}

/** A member's own posts, newest first, a page at a time («Мои публикации»). */
export function useMyPosts(memberId: string | undefined) {
  const repository = useRepository();
  return useInfiniteQuery({
    queryKey: queryKeys.profilePosts(memberId ?? ''),
    queryFn: ({ pageParam }) =>
      repository.listProfilePosts({ memberId: memberId ?? '', cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: !!memberId,
  });
}

/** «Заблокированные»: the member's own Блокировки, newest first. */
export function useBlocked(enabled: boolean) {
  const repository = useRepository();
  return useInfiniteQuery({
    queryKey: queryKeys.blocked,
    queryFn: ({ pageParam }) => repository.listBlocked({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled,
  });
}

/** «Мои жалобы»: the member's own reports with status and outcome, newest first. */
export function useMyReports(enabled: boolean) {
  const repository = useRepository();
  return useInfiniteQuery({
    queryKey: queryKeys.myReports,
    queryFn: ({ pageParam }) => repository.listMyReports({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled,
  });
}

/** Очередь модерации: one tab of reports, newest first. */
export function useModerationQueue(status: ReportStatus) {
  const repository = useRepository();
  return useInfiniteQuery({
    queryKey: queryKeys.moderation(status),
    queryFn: ({ pageParam }) => repository.listReports({ status, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });
}

/** Opening a new report takes it into review; the tabs reload. */
export function useOpenReport() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => repository.openReport({ reportId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['moderation'] }),
  });
}

/** A decision may remove content or restrict a person: the queue and content reload. */
export function useResolveReport() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveReportInput) => repository.resolveReport(input),
    onSuccess: () =>
      Promise.all(
        ['moderation', 'feed', 'post', 'comments', 'profile-posts', 'my-reports'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

/** Another member's profile, in the view the session may see. */
export function useProfile(memberId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const repository = useRepository();
  return useQuery({
    queryKey: queryKeys.profile(memberId),
    queryFn: () => repository.getProfile({ memberId }),
    enabled,
  });
}

/**
 * Подписка on or off. The button and the follower count answer at once; a failure puts
 * them back. The «Подписки» feed and the lists reload afterwards.
 */
export function useSetFollow() {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; active: boolean }) => repository.setFollow(input),
    onMutate: async ({ memberId, active }) => {
      const key = queryKeys.profile(memberId);
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<ProfileView>(key);
      if (before?.relation && before.relation.following !== active) {
        client.setQueryData<ProfileView>(key, {
          ...before,
          relation: { ...before.relation, following: active },
          stats: {
            ...before.stats,
            followers: Math.max(0, before.stats.followers + (active ? 1 : -1)),
          },
        });
      }
      return { before };
    },
    onError: (_error, { memberId }, context) => {
      if (context?.before) client.setQueryData(queryKeys.profile(memberId), context.before);
    },
    onSuccess: (result) => {
      client.setQueryData<ProfileView>(queryKeys.profile(result.memberId), (profile) =>
        profile?.relation
          ? {
              ...profile,
              relation: { ...profile.relation, following: result.following },
              stats: { ...profile.stats, followers: result.followers },
            }
          : profile,
      );
      void client.invalidateQueries({ queryKey: ['feed', 'following'] });
      void client.invalidateQueries({ queryKey: ['follows'] });
      // The follower's own «Подписки» count changes too.
      void client.invalidateQueries({
        queryKey: ['profile'],
        predicate: (query) => query.queryKey[1] !== result.memberId,
      });
    },
  });
}

/** A profile already loaded by its screen; never fetches on its own. */
export function useCachedProfile(memberId: string): ProfileView | undefined {
  const client = useQueryClient();
  return memberId ? client.getQueryData<ProfileView>(queryKeys.profile(memberId)) : undefined;
}

/** «Подписчики» or «Подписки» of a member, newest first, a page at a time. */
export function useFollowList(memberId: string, tab: 'followers' | 'following') {
  const repository = useRepository();
  return useInfiniteQuery({
    queryKey: ['follows', tab, memberId],
    queryFn: ({ pageParam }) =>
      tab === 'followers'
        ? repository.listFollowers({ memberId, cursor: pageParam })
        : repository.listFollowing({ memberId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });
}
