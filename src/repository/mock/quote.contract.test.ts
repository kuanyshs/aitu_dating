import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { CLUB_RULES_VERSION, PostView, type QuestionnaireAnswers, type Session } from '@/contracts';
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

/** m01 wrote p01, which the seed quote p11 (by m08) points to. */
const seedAuthor: Session = { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm01' };

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
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-quote' });
  return repo;
}

let keys = 0;
const quote = (repo: MockRepository, quotedPostId: string) =>
  repo.createPost({
    type: 'quote',
    text: 'Хорошая мысль.',
    topics: [],
    quotedPostId,
    idempotencyKey: `quote-key-${(keys += 1)}`,
  });

describe('quoting', () => {
  it('works for someone else’s post, one’s own, a plan’s post and another quote', async () => {
    const member = await join(repositoryOn());
    const others = PostView.parse(await quote(member, 'p02'));
    expect(others).toMatchObject({ type: 'quote', quoted: { id: 'p02' }, mine: true });
    expect(others.quotedUnavailable).toBeUndefined();

    const plan = await quote(member, 'p-plan1');
    expect(plan.quoted?.id).toBe('p-plan1');

    // A quote of a quote shows one level: the quoted quote, without what it quotes.
    const nested = await quote(member, 'p11');
    expect(nested.quoted).toEqual({
      id: 'p11',
      text: expect.any(String),
      author: expect.objectContaining({ view: 'member' }),
    });

    const author = repositoryOn(createMemoryStore(), seedAuthor);
    expect((await quote(author, 'p01')).quoted?.id).toBe('p01');
  });

  it('shows guests the quoted author in the safe view', async () => {
    const store = createMemoryStore();
    const created = await quote(await join(repositoryOn(store)), 'p02');
    const guest = repositoryOn(store);
    await guest.logout();
    const seen = await guest.getPost({ postId: created.id });
    expect(Object.keys(seen.quoted?.author ?? {}).sort()).toEqual([
      'age',
      'avatar',
      'city',
      'gender',
      'view',
    ]);
  });
});

describe('a quote whose original is gone', () => {
  it('stays and says «Публикация недоступна» when the original is deleted', async () => {
    const store = createMemoryStore();
    const author = repositoryOn(store, seedAuthor);
    const own = await quote(author, 'p01');
    await author.deletePost({ postId: 'p01' });

    for (const postId of ['p11', own.id]) {
      const post = await author.getPost({ postId });
      expect(post.quotedUnavailable).toBe(true);
      expect(post.quoted).toBeUndefined();
    }
    const feed = await repositoryOn(store).getHomeFeed({ tab: 'for_you', limit: 50 });
    expect(feed.items.find((p) => p.id === 'p11')?.quotedUnavailable).toBe(true);
  });

  it('does the same when the original’s author is restricted', async () => {
    const store = createMemoryStore();
    const author = repositoryOn(store, seedAuthor);
    await author.setCurrentRestricted(true);
    const reader = repositoryOn(store);
    const p11 = await reader.getPost({ postId: 'p11' });
    expect(p11).toMatchObject({ quotedUnavailable: true });
    expect(p11.quoted).toBeUndefined();
  });

  it('is not marked while the original is there', async () => {
    const p11 = await repositoryOn().getPost({ postId: 'p11' });
    expect(p11.quoted?.id).toBe('p01');
    expect(p11.quotedUnavailable).toBeUndefined();
  });
});
