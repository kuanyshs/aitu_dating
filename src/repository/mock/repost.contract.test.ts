import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  RepostState,
  type QuestionnaireAnswers,
  type Session,
} from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';
import { loadSeed } from './seed';

const seed = loadSeed();
const seedReposts = (id: string) => seed.reposts.filter((r) => r.postId === id).length;

const answers: QuestionnaireAnswers = {
  city: 'almaty',
  intent: 'dating',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

/** m01 wrote p01. */
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
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-repost' });
  return repo;
}

describe('reposts', () => {
  it('toggle, and repeating the same value changes nothing', async () => {
    const repo = await join(repositoryOn());
    const reposted = RepostState.parse(await repo.setRepost({ postId: 'p02', active: true }));
    expect(reposted).toEqual({
      postId: 'p02',
      reposts: seedReposts('p02') + 1,
      repostedByMe: true,
    });
    expect(await repo.setRepost({ postId: 'p02', active: true })).toEqual(reposted);
    expect(await repo.setRepost({ postId: 'p02', active: false })).toEqual({
      postId: 'p02',
      reposts: seedReposts('p02'),
      repostedByMe: false,
    });
    expect(await repo.setRepost({ postId: 'p02', active: false })).toMatchObject({
      reposts: seedReposts('p02'),
    });
  });

  it('show in the post and the feed, and survive a restart', async () => {
    const store = createMemoryStore();
    await (await join(repositoryOn(store))).setRepost({ postId: 'p02', active: true });
    const restarted = repositoryOn(store);
    expect(await restarted.getPost({ postId: 'p02' })).toMatchObject({
      reposts: seedReposts('p02') + 1,
      repostedByMe: true,
    });
    const feed = await restarted.getHomeFeed({ tab: 'for_you', limit: 50 });
    expect(feed.items.find((p) => p.id === 'p02')?.repostedByMe).toBe(true);
    expect(feed.items.find((p) => p.id === 'p03')?.repostedByMe).toBe(false);
  });

  it('are refused for an own post', async () => {
    const author = repositoryOn(createMemoryStore(), seedAuthor);
    await expect(author.setRepost({ postId: 'p01', active: true })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect((await author.getPost({ postId: 'p01' })).reposts).toBe(seedReposts('p01'));
  });

  it('are refused to guests, expired and restricted members, and for hidden posts', async () => {
    const repost = { postId: 'p02', active: true } as const;
    await expect(repositoryOn().setRepost(repost)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const expired = await join(repositoryOn());
    await expired.expireMembership();
    await expect(expired.setRepost(repost)).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
    const restricted = await join(repositoryOn());
    await restricted.setCurrentRestricted(true);
    await expect(restricted.setRepost(repost)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const member = await join(repositoryOn());
    for (const postId of ['p14', 'nope']) {
      await expect(member.setRepost({ postId, active: true })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    }
  });

  it('are reported to active members only', async () => {
    expect((await repositoryOn().getPost({ postId: 'p02' })).repostedByMe).toBeUndefined();
    const expired = await join(repositoryOn());
    await expired.expireMembership();
    expect((await expired.getPost({ postId: 'p02' })).repostedByMe).toBeUndefined();
  });
});
