import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  CommentPage,
  PlanView,
  PostView,
  ProfileView,
  type QuestionnaireAnswers,
} from '@/contracts';
import { createMemoryStore } from '@/storage';

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
  return repo.completeOnboarding({ answers, idempotencyKey: 'onboard-reads' });
}

const safeKeys = ['age', 'avatar', 'city', 'gender', 'view'];

describe('post', () => {
  it('reaches a guest with the author in the safe view only', async () => {
    const post = PostView.parse(await repositoryOn().getPost({ postId: 'p01' }));
    expect(Object.keys(post.author).sort()).toEqual(safeKeys);
    expect(post.reactedByMe).toBeUndefined();
  });

  it('shows the full author to a member', async () => {
    const repo = repositoryOn();
    await join(repo);
    const post = await repo.getPost({ postId: 'p01' });
    expect(post.author).toMatchObject({ view: 'member', id: 'm01' });
  });

  it('is not found when its author is restricted', async () => {
    await expect(repositoryOn().getPost({ postId: 'p14' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('comments', () => {
  it('come as root threads with replies, oldest reply first', async () => {
    const page = CommentPage.parse(
      await repositoryOn().listComments({ postId: 'p01', sort: 'new', limit: 50 }),
    );
    expect(page.items.length).toBeGreaterThan(0);
    for (const thread of page.items) {
      expect(thread.comment.parentId).toBeUndefined();
      for (const reply of thread.replies) expect(reply.parentId).toBe(thread.comment.id);
      const times = thread.replies.map((r) => r.createdAt);
      expect(times).toEqual([...times].sort());
      expect(Object.keys(thread.comment.author).sort()).toEqual(safeKeys);
    }
    const roots = page.items.map((t) => t.comment.createdAt);
    expect(roots).toEqual([...roots].sort().reverse());
  });

  it('page through with a cursor and keep the total', async () => {
    const repo = repositoryOn();
    const all = await repo.listComments({ postId: 'p01', sort: 'popular', limit: 50 });
    const first = await repo.listComments({ postId: 'p01', sort: 'popular', limit: 2 });
    expect(first.hasMore).toBe(true);
    const second = await repo.listComments({
      postId: 'p01',
      sort: 'popular',
      limit: 50,
      cursor: first.nextCursor,
    });
    expect([...first.items, ...second.items]).toEqual(all.items);
  });

  it('mark the member’s own comments', async () => {
    const repo = repositoryOn();
    await join(repo);
    const page = await repo.listComments({ postId: 'p01', sort: 'new' });
    expect(page.items.every((t) => t.comment.mine === false)).toBe(true);
  });
});

describe('profile', () => {
  it('is for members: guests never address a person', async () => {
    await expect(repositoryOn().getProfile({ memberId: 'm01' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('shows an active member the card, stats and relation', async () => {
    const repo = repositoryOn();
    await join(repo);
    const profile = ProfileView.parse(await repo.getProfile({ memberId: 'm01' }));
    expect(profile.person).toMatchObject({ view: 'member', id: 'm01' });
    expect(profile.card?.interests.length).toBeGreaterThan(0);
    expect(profile.relation).toEqual({ following: false, followsMe: false, blocked: false });
    const posts = await repo.listProfilePosts({ memberId: 'm01', limit: 50 });
    expect(profile.stats.posts).toBe(posts.items.length);
    expect(posts.items.every((p) => p.author.view === 'member' && p.author.id === 'm01')).toBe(
      true,
    );
  });

  it('gives an expired member only the safe view, without the card', async () => {
    const repo = repositoryOn();
    await join(repo);
    await repo.expireMembership();
    const profile = await repo.getProfile({ memberId: 'm01' });
    expect(Object.keys(profile.person).sort()).toEqual(safeKeys);
    expect(profile.card).toBeUndefined();
    expect(profile.relation).toBeUndefined();
  });

  it('is not found for a restricted member', async () => {
    const repo = repositoryOn();
    await join(repo);
    await expect(repo.getProfile({ memberId: 'm11' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('plan', () => {
  it('hides the exact place from guests', async () => {
    const plan = PlanView.parse(await repositoryOn().getPlan({ planId: 'plan1' }));
    expect(plan.place).toBeUndefined();
    expect(plan.isPublicPlace).toBe(true);
    expect(Object.keys(plan.author).sort()).toEqual(safeKeys);
  });

  it('shows the place to an active member', async () => {
    const repo = repositoryOn();
    await join(repo);
    const plan = await repo.getPlan({ planId: 'plan1' });
    expect(plan.place).toBeTruthy();
    expect(plan.postId).toBeTruthy();
    expect(plan.pendingResponses).toBeUndefined();
  });
});

describe('own card and settings', () => {
  it('edits the card, also while expired, with field errors by step', async () => {
    const repo = repositoryOn();
    await join(repo);
    await repo.expireMembership();
    await expect(
      repo.updateMyCard({ bio: '', interests: ['coffee'], communicationStyle: 'short_messages' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { 'profile.bio': 'required' },
    });
    const me = await repo.updateMyCard({
      bio: 'Теперь про книги.',
      interests: ['books'],
      communicationStyle: 'calm_dialogue',
    });
    expect(me.card).toMatchObject({ bio: 'Теперь про книги.', interests: ['books'] });
    expect(me.card.questionnaire).toEqual(answers);
  });

  it('keeps settings per member across restarts', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(store);
    await join(repo);
    expect((await repo.getSettings()).notifications.follows).toBe(true);
    await repo.updateSettings({ notifications: { follows: false } });
    const settings = await repositoryOn(store).getSettings();
    expect(settings.notifications).toMatchObject({ follows: false, messages: true });
  });

  it('are refused to guests', async () => {
    await expect(repositoryOn().getSettings()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
