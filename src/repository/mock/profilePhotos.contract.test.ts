import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import { CLUB_RULES_VERSION, type Session } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';

const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function repositoryOn(session?: Session, store = createMemoryStore()) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

const dataUrl = (n: number) => `data:image/jpeg;base64,PHOTO${n}`;

async function upload(repo: MockRepository, n: number) {
  return repo.uploadPhoto({
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    dataUrl: dataUrl(n),
    idempotencyKey: `profile-photo-${n}`,
  });
}

describe('profile Фото', () => {
  it('keep their order, and the first is the main one and the avatar', async () => {
    const repo = repositoryOn(as('m01'));
    const a = await upload(repo, 1);
    const b = await upload(repo, 2);
    const me = await repo.updateMyPhotos({ photoIds: [b.id, a.id] });
    expect(me.photos.map((p) => p.id)).toEqual([b.id, a.id]);
    expect(me.avatar).toEqual({ kind: 'photo', url: dataUrl(2) });

    const removed = await repo.updateMyPhotos({ photoIds: [a.id] });
    expect(removed.photos.map((p) => p.id)).toEqual([a.id]);
    expect(removed.avatar).toEqual({ kind: 'photo', url: dataUrl(1) });
  });

  it('stop at four, own and different ones', async () => {
    const store = createMemoryStore();
    const repo = repositoryOn(as('m01'), store);
    const ids = [];
    for (const n of [1, 2, 3, 4, 5]) ids.push((await upload(repo, n)).id);
    await expect(repo.updateMyPhotos({ photoIds: ids })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(repo.updateMyPhotos({ photoIds: [ids[0]!, ids[0]!] })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    const other = repositoryOn(as('m02'), store);
    await expect(other.updateMyPhotos({ photoIds: [ids[0]!] })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { photoIds: 'unknown' },
    });
    expect((await repo.updateMyPhotos({ photoIds: ids.slice(0, 4) })).photos).toHaveLength(4);
  });

  it('reach active members only; a guest gets the neutral silhouette', async () => {
    const store = createMemoryStore();
    const owner = repositoryOn(as('m01'), store);
    const a = await upload(owner, 1);
    await owner.updateMyPhotos({ photoIds: [a.id] });

    const member = await repositoryOn(as('m03'), store).getProfile({ memberId: 'm01' });
    expect(member.photos?.map((p) => p.id)).toEqual([a.id]);
    expect(member.person.avatar).toEqual({ kind: 'photo', url: dataUrl(1) });

    const guest = repositoryOn(undefined, store);
    const feed = await guest.getHomeFeed({ tab: 'popular' });
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items.every((p) => p.author.avatar.kind === 'neutral')).toBe(true);
    expect(JSON.stringify(feed)).not.toContain('PHOTO1');
  });

  it('can be added on the card step of Вступление', async () => {
    const repo = repositoryOn();
    await repo.startAccess();
    await repo.selectPassport({ candidateId: 'passport-1' });
    await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
    await expect(upload(repo, 9)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await repo.selectMembership({ tier: 'paid', periodMonths: 1 });
    await repo.confirmPayment({ idempotencyKey: 'join-checkout' });
    const photo = await upload(repo, 9);
    await repo.saveProfileStep({
      bio: 'Коротко о себе.',
      interests: ['coffee'],
      communicationStyle: 'short_messages',
      photoIds: [photo.id],
    });
    const me = await repo.completeOnboarding({
      answers: {
        city: 'almaty',
        intent: 'dating',
        communication: 'messages_first',
        pace: 'gradual',
        firstMeeting: 'coffee_talk',
        boundaries: 'public_place',
        dateFormat: 'walk',
      },
      idempotencyKey: 'onboard-photo',
    });
    expect(me.photos.map((p) => p.id)).toEqual([photo.id]);
  });
});
