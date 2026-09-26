import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  CommentView,
  type CommentThread,
  type QuestionnaireAnswers,
} from '@/contracts';
import { createMemoryStore, storageKeys } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';

const answers: QuestionnaireAnswers = {
  city: 'almaty',
  intent: 'dating',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

function repositoryOn(store = createMemoryStore()) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store });
}

async function join(repo: MockRepository) {
  await repo.startAccess();
  await repo.selectPassport({ candidateId: 'passport-1' });
  await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
  await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
  await repo.saveProfileStep({
    bio: 'Коротко о себе.',
    interests: ['coffee'],
    communicationStyle: 'short_messages',
  });
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-comment-create' });
  return repo;
}

async function threads(repo: MockRepository, postId: string) {
  const all: CommentThread[] = [];
  let cursor: string | undefined;
  do {
    const page = await repo.listComments({ postId, sort: 'new', cursor });
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

describe('Flow F: comment, reply, no third level', () => {
  it('runs as one sequence', async () => {
    const repo = await join(repositoryOn());
    const before = (await repo.getPost({ postId: 'p03' })).commentsCount;

    const root = CommentView.parse(
      await repo.createComment({
        postId: 'p03',
        text: 'Хороший вопрос, подумаю.',
        idempotencyKey: 'flow-f-root-1',
      }),
    );
    expect(root).toMatchObject({ postId: 'p03', mine: true, deleted: false, reactions: 0 });
    expect(root.parentId).toBeUndefined();
    expect(root.author).toMatchObject({ view: 'member', name: 'Айдана' });

    const reply = await repo.createComment({
      postId: 'p03',
      parentId: root.id,
      text: 'И ещё мысль вдогонку.',
      idempotencyKey: 'flow-f-reply-1',
    });
    expect(reply.parentId).toBe(root.id);

    await expect(
      repo.createComment({
        postId: 'p03',
        parentId: reply.id,
        text: 'Ответ на ответ',
        idempotencyKey: 'flow-f-third-1',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', fieldErrors: { parentId: 'reply_depth' } });

    const thread = (await threads(repo, 'p03')).find((t) => t.comment.id === root.id);
    expect(thread?.replies.map((r) => r.id)).toEqual([reply.id]);
    expect((await repo.getPost({ postId: 'p03' })).commentsCount).toBe(before + 2);
  });
});

describe('creating comments', () => {
  it('validates the text: required and at most 360 characters', async () => {
    const repo = await join(repositoryOn());
    await expect(
      repo.createComment({ postId: 'p01', text: '   ', idempotencyKey: 'empty-text-1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { text: 'required' } });
    await expect(
      repo.createComment({ postId: 'p01', text: 'а'.repeat(361), idempotencyKey: 'long-text-1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { text: 'too_long' } });
    const ok = await repo.createComment({
      postId: 'p01',
      text: 'а'.repeat(360),
      idempotencyKey: 'max-text-1',
    });
    expect(ok.text).toHaveLength(360);
  });

  it('publishes once per idempotency key, even after a network error', async () => {
    const repo = await join(repositoryOn());
    const input = { postId: 'p01', text: 'Согласна!', idempotencyKey: 'retry-comment-1' };
    await repo.setDemoFlags({ networkErrorOnce: true });
    await expect(repo.createComment(input)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const first = await repo.createComment(input);
    const again = await repo.createComment(input);
    expect(again.id).toBe(first.id);
    const mine = (await threads(repo, 'p01')).filter((t) => t.comment.mine);
    expect(mine).toHaveLength(1);
  });

  it('refuses unknown posts and deleted parents', async () => {
    const repo = await join(repositoryOn());
    await expect(
      repo.createComment({ postId: 'p14', text: 'Привет', idempotencyKey: 'hidden-post-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      repo.createComment({
        postId: 'p01',
        parentId: 'c-p01-2',
        text: 'Привет',
        idempotencyKey: 'deleted-parent-1',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('is for active members only', async () => {
    const input = { postId: 'p01', text: 'Привет', idempotencyKey: 'gate-comment-1' };
    await expect(repositoryOn().createComment(input)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const expired = await join(repositoryOn());
    await expired.expireMembership();
    await expect(expired.createComment(input)).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
  });

  it('survives a restart and shows others the author in the safe view', async () => {
    const store = createMemoryStore();
    const created = await (
      await join(repositoryOn(store))
    ).createComment({ postId: 'p03', text: 'Сохранится?', idempotencyKey: 'restart-comment-1' });
    const restarted = repositoryOn(store);
    await restarted.logout();
    const guestView = (await threads(restarted, 'p03')).find((t) => t.comment.id === created.id);
    expect(guestView?.comment.text).toBe('Сохранится?');
    expect(Object.keys(guestView?.comment.author ?? {}).sort()).toEqual([
      'age',
      'avatar',
      'city',
      'gender',
      'view',
    ]);
  });
});

describe('state migration to v9', () => {
  it('keeps v8 state without a reset', async () => {
    const v8 = {
      version: 8,
      data: {
        demoFlags: { networkErrorOnce: false, offline: false, failedMessageOnce: false },
        accessFlow: null,
        payments: {},
        members: [],
        onboardings: {},
        parkedFlows: {},
        reactions: [],
        renewals: {},
        expiredMemberships: {},
        restrictedSubjects: [],
        settings: {},
        comments: [],
        deletedCommentIds: [],
        deletedPostIds: [],
        commentReactions: [],
        reposts: [],
      },
    };
    const repo = repositoryOn(createMemoryStore({ [storageKeys.state]: JSON.stringify(v8) }));
    expect((await repo.getSession()).accessState).toBe('GUEST_PREVIEW');
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
