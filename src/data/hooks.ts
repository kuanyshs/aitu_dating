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
  FeedTab,
  MembershipSelection,
  PartialAnswers,
  PostView,
  ProfileStepInput,
  RenewMembershipInput,
  SaveAnswerInput,
} from '@/contracts';
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
    mutationFn: () => demo!.resetDemo(),
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
type PostPatch = Pick<PostView, 'reactions' | 'reactedByMe'>;

/** Writes a post's new like state into every cached feed page and the post itself. */
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
export function usePost(postId: string) {
  const repository = useRepository();
  const client = useQueryClient();
  return useQuery({
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
