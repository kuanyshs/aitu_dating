import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import type { Session } from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';
import { loadSeed } from './seed';

const seed = loadSeed();
const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function repositoryOn(session?: Session, store = createMemoryStore()) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

// Алия (m01) shows her surname; Руслан (m02) keeps the default and hides his.
const aliya = seed.members.find((m) => m.id === 'm01')!;
const ruslan = seed.members.find((m) => m.id === 'm02')!;

describe('surname from Passport', () => {
  it('reaches other active members only when its owner shows it', async () => {
    const repo = repositoryOn(as('m03'));
    const shown = await repo.getProfile({ memberId: 'm01' });
    expect(shown.person).toMatchObject({ view: 'member', surname: aliya.surname });
    const hidden = await repo.getProfile({ memberId: 'm02' });
    expect(hidden.person.view).toBe('member');
    expect(hidden.person).not.toHaveProperty('surname');
  });

  it('never reaches a guest, whatever the setting', async () => {
    const repo = repositoryOn();
    const feed = await repo.getHomeFeed({ tab: 'popular' });
    expect(JSON.stringify(feed)).not.toContain(aliya.surname!);
  });

  it('is always in the owner’s own profile, and the owner turns it on', async () => {
    const store = createMemoryStore();
    const own = repositoryOn(as('m02'), store);
    const me = await own.getMyProfile();
    expect(me).toMatchObject({ surname: ruslan.surname, card: { showSurname: false } });

    const updated = await own.updateMyCard({
      bio: me.card.bio,
      interests: me.card.interests,
      communicationStyle: me.card.communicationStyle,
      showSurname: true,
    });
    expect(updated.card.showSurname).toBe(true);

    const other = repositoryOn(as('m03'), store);
    expect((await other.getProfile({ memberId: 'm02' })).person).toMatchObject({
      surname: ruslan.surname,
    });
  });
});
