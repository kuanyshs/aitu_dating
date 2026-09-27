import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  PostView,
  type CreatePostInput,
  type QuestionnaireAnswers,
  type Session,
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

/** m01 wrote p01; another seed member reads the same feed. */
const otherMember: Session = { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm02' };

function repositoryOn(store = createMemoryStore(), session?: Session) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
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
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-post-create' });
  return repo;
}

const question: CreatePostInput = {
  type: 'question',
  text: 'Где в Алматы спокойно поговорить после работы?',
  topics: ['meetings', 'city'],
  idempotencyKey: 'question-key-1',
};

describe('creating a post', () => {
  it('publishes a post and a question with topics, marked as mine', async () => {
    const repo = await join(repositoryOn());
    const created = PostView.parse(await repo.createPost(question));
    expect(created).toMatchObject({
      type: 'question',
      text: question.text,
      topics: ['meetings', 'city'],
      mine: true,
      reactions: 0,
      reposts: 0,
      commentsCount: 0,
    });
    expect(created.author).toMatchObject({ view: 'member', name: 'Айдана' });

    const post = await repo.createPost({
      type: 'post',
      text: '  Сегодня был хороший день.  ',
      topics: [],
      idempotencyKey: 'post-key-1',
    });
    expect(post).toMatchObject({ type: 'post', text: 'Сегодня был хороший день.', topics: [] });
    expect(post.id).not.toBe(created.id);
  });

  it('validates the text and the topics', async () => {
    const repo = await join(repositoryOn());
    const base = { type: 'post' as const, topics: [], idempotencyKey: 'validate-key-1' };
    await expect(repo.createPost({ ...base, text: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { text: 'required' },
    });
    await expect(repo.createPost({ ...base, text: 'а'.repeat(1001) })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { text: 'too_long' },
    });
    await expect(
      repo.createPost({
        ...base,
        text: 'Темы',
        topics: ['conversation', 'meetings', 'city', 'thoughts', 'city'],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { topics: 'too_many' } });
    const longest = await repo.createPost({ ...base, text: 'а'.repeat(1000) });
    expect(longest.text).toHaveLength(1000);
  });

  it('publishes once per idempotency key, even after a network error', async () => {
    const repo = await join(repositoryOn());
    await repo.setDemoFlags({ networkErrorOnce: true });
    await expect(repo.createPost(question)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const first = await repo.createPost(question);
    const again = await repo.createPost(question);
    expect(again.id).toBe(first.id);
    const feed = await repo.getHomeFeed({ tab: 'for_you', limit: 50 });
    expect(feed.items.filter((p) => p.mine)).toHaveLength(1);
  });

  it('is for active members only', async () => {
    await expect(repositoryOn().createPost(question)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const expired = await join(repositoryOn());
    await expired.expireMembership();
    await expect(expired.createPost(question)).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
    const restricted = await join(repositoryOn());
    await restricted.setCurrentRestricted(true);
    await expect(restricted.createPost(question)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses to quote a post that is gone', async () => {
    const repo = await join(repositoryOn());
    for (const quotedPostId of ['p14', 'nope']) {
      await expect(
        repo.createPost({
          type: 'quote',
          text: 'Согласна',
          topics: [],
          quotedPostId,
          idempotencyKey: `quote-${quotedPostId}-1`,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });
});

describe('a new post in the feed', () => {
  it('leads «Для вас» for its author, and is ranked for everyone else', async () => {
    const store = createMemoryStore();
    const author = await join(repositoryOn(store));
    const created = await author.createPost(question);
    const own = await author.getHomeFeed({ tab: 'for_you', limit: 50 });
    expect(own.items[0]?.id).toBe(created.id);

    // Everyone else gets it ranked like any post (fresh posts rank high on recency).
    const other = repositoryOn(store, otherMember);
    const theirs = await other.getHomeFeed({ tab: 'for_you', limit: 50 });
    expect(theirs.items.map((p) => p.id)).toContain(created.id);
  });

  it('shows on the post screen and the profile, and survives a restart', async () => {
    const store = createMemoryStore();
    const author = await join(repositoryOn(store));
    const created = await author.createPost(question);
    const restarted = repositoryOn(store);
    expect(await restarted.getPost({ postId: created.id })).toMatchObject({
      id: created.id,
      mine: true,
    });
    const me = await restarted.getMyProfile();
    const profile = await restarted.listProfilePosts({ memberId: me.id });
    expect(profile.items.map((p) => p.id)).toEqual([created.id]);
  });

  it('leaves the profile when deleted', async () => {
    const repo = await join(repositoryOn());
    const created = await repo.createPost(question);
    await repo.deletePost({ postId: created.id });
    const me = await repo.getMyProfile();
    expect((await repo.listProfilePosts({ memberId: me.id })).items).toEqual([]);
  });
});

describe('state migration to v10', () => {
  it('keeps v9 state without a reset', async () => {
    const v9 = {
      version: 9,
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
        commentKeys: {},
      },
    };
    const repo = repositoryOn(createMemoryStore({ [storageKeys.state]: JSON.stringify(v9) }));
    expect((await repo.getHomeFeed({ tab: 'for_you' })).items.length).toBeGreaterThan(0);
    expect(await repo.takeResetNotice()).toBeUndefined();
  });
});
