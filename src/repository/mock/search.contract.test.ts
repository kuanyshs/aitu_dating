import { describe, expect, it } from 'vitest';

import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  SearchPage,
  type QuestionnaireAnswers,
  type Session,
} from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository, type MockRepository } from './createMockRepository';
import { loadSeed } from './seed';

const seed = loadSeed();
const member = (id: string) => seed.members.find((m) => m.id === id)!;
const as = (userId: string): Session => ({
  accessState: 'ACTIVE_MEMBER',
  roles: ['member'],
  userId,
});

function on(store = createMemoryStore(), session?: Session) {
  return createMockRepository({ clock: fixedClock(), latency: 0, store, session });
}

const answers: QuestionnaireAnswers = {
  city: 'almaty',
  intent: 'dating',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

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
  await repo.completeOnboarding({ answers, idempotencyKey: 'onboard-search' });
  return repo;
}

const personIds = (page: SearchPage) =>
  page.items.map((hit) =>
    hit.kind === 'person' && hit.person.view === 'member' ? hit.person.id : undefined,
  );
const postIds = (page: SearchPage) =>
  page.items.map((hit) => (hit.kind === 'post' ? hit.post.id : undefined));

describe('Поиск людей', () => {
  it('finds a member by name with their Карточка, never oneself', async () => {
    const repo = on(createMemoryStore(), as('m02'));
    const m01 = member('m01');
    const page = SearchPage.parse(
      await repo.search({ kind: 'people', text: m01.name.toLowerCase() }),
    );
    expect(personIds(page)[0]).toBe('m01');
    const hit = page.items[0]!;
    expect(hit.kind === 'person' && hit.card?.bio).toBe(m01.card.bio);

    const self = await repo.search({ kind: 'people', text: member('m02').name, limit: 50 });
    expect(personIds(self)).not.toContain('m02');
  });

  it('with nothing asked lists the viewer’s city', async () => {
    const viewer = member('m02');
    const repo = on(createMemoryStore(), as('m02'));
    const page = await repo.search({ kind: 'people', limit: 50 });
    const expected = seed.members
      .filter((m) => m.city === viewer.city && m.id !== 'm02' && !m.restricted)
      .map((m) => m.id)
      .sort();
    expect([...personIds(page)].sort()).toEqual(expected);
  });

  it('leaves out restricted and blocked people', async () => {
    const store = createMemoryStore();
    const repo = on(store, as('m02'));
    expect(
      personIds(await repo.search({ kind: 'people', text: member('m11').name })),
    ).not.toContain('m11');
    await repo.setBlock({ target: { type: 'user', id: 'm01' }, active: true });
    expect(
      personIds(await on(store, as('m02')).search({ kind: 'people', text: member('m01').name })),
    ).not.toContain('m01');
  });

  it('is for active members only', async () => {
    await expect(on().search({ kind: 'people', text: 'кофе' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const expired = await join(on());
    await expired.expireMembership();
    await expect(expired.search({ kind: 'people', text: 'кофе' })).rejects.toMatchObject({
      code: 'MEMBERSHIP_EXPIRED',
    });
    const restricted = await join(on());
    await restricted.setCurrentRestricted(true);
    await expect(restricted.search({ kind: 'posts', text: 'кофе' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('pages the results', async () => {
    const repo = on(createMemoryStore(), as('m02'));
    const all = await repo.search({ kind: 'people', city: 'almaty', limit: 50 });
    const first = await repo.search({ kind: 'people', city: 'almaty', limit: 2 });
    expect(first.items).toHaveLength(Math.min(2, all.items.length));
    if (all.items.length > 2) {
      const second = await repo.search({
        kind: 'people',
        city: 'almaty',
        limit: 2,
        cursor: first.nextCursor,
      });
      expect(personIds(second)).toEqual(personIds(all).slice(2, 4));
    }
  });
});

describe('Поиск публикаций', () => {
  it('finds posts by text and by Тема, newest first', async () => {
    const repo = on(createMemoryStore(), as('m02'));
    const p01 = seed.posts.find((p) => p.id === 'p01')!;
    const word = p01.text.split(' ').find((w) => w.length > 5)!;
    expect(postIds(await repo.search({ kind: 'posts', text: word, limit: 50 }))).toContain('p01');

    const page = await repo.search({ kind: 'posts', topics: ['meetings'], limit: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    const posts = page.items.flatMap((hit) => (hit.kind === 'post' ? [hit.post] : []));
    expect(posts.every((p) => p.topics.includes('meetings'))).toBe(true);
    const dates = posts.map((p) => p.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('guests and expired members search posts in the safe view', async () => {
    const guest = await on().search({ kind: 'posts', topics: ['meetings'] });
    expect(guest.items.every((hit) => hit.kind === 'post' && hit.post.author.view === 'safe')).toBe(
      true,
    );
    const expired = await join(on());
    await expired.expireMembership();
    const page = await expired.search({ kind: 'posts', topics: ['meetings'] });
    expect(page.items.length).toBeGreaterThan(0);
  });

  it('leaves out deleted posts and those of restricted authors', async () => {
    const store = createMemoryStore();
    const author = on(store, as('m01'));
    await author.deletePost({ postId: 'p01' });
    const p01 = seed.posts.find((p) => p.id === 'p01')!;
    const reader = on(store, as('m02'));
    expect(
      postIds(await reader.search({ kind: 'posts', text: p01.text.slice(0, 20) })),
    ).not.toContain('p01');
    const p14 = seed.posts.find((p) => p.id === 'p14')!;
    expect(
      postIds(await reader.search({ kind: 'posts', text: p14.text.slice(0, 20) })),
    ).not.toContain('p14');
  });

  it('needs two characters or a Тема', async () => {
    const repo = on(createMemoryStore(), as('m02'));
    await expect(repo.search({ kind: 'posts', text: 'к' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { text: 'too_short' },
    });
  });
});

describe('searching plans', () => {
  const planIds = (page: SearchPage) =>
    page.items.map((hit) => (hit.kind === 'plan' ? hit.plan.id : `not-a-plan:${hit.kind}`));

  it('finds open future plans by the description, nearest first', async () => {
    const guest = on();
    const found = SearchPage.parse(await guest.search({ kind: 'plans', text: 'КОФЕ' }));
    expect(planIds(found)).toEqual(['plan1', 'plan5']);
    // A guest sees no exact place, a member does.
    const first = found.items[0];
    expect(first?.kind === 'plan' && first.plan.place).toBeFalsy();
    const member = await on(createMemoryStore(), as('m02')).search({ kind: 'plans', text: 'кофе' });
    const hit = member.items[0];
    expect(hit?.kind === 'plan' && hit.plan.place).toBe('Кофейня на Панфилова');
  });

  it('lists every open plan without text; a Встреча is not open', async () => {
    const all = await on(createMemoryStore(), as('m02')).search({ kind: 'plans' });
    expect(planIds(all)).toEqual(['plan1', 'plan2', 'plan3', 'plan5', 'plan6']);
  });

  it('narrows by city, goal and format', async () => {
    const repo = on(createMemoryStore(), as('m02'));
    expect(planIds(await repo.search({ kind: 'plans', city: 'astana' }))).toEqual([
      'plan2',
      'plan5',
    ]);
    expect(planIds(await repo.search({ kind: 'plans', goal: 'talk' }))).toEqual(['plan3', 'plan5']);
    expect(
      planIds(await repo.search({ kind: 'plans', city: 'karaganda', format: 'walk' })),
    ).toEqual(['plan3', 'plan6']);
  });

  it('leaves out own, closed, past and hidden plans', async () => {
    const store = createMemoryStore();
    expect(planIds(await on(store, as('m06')).search({ kind: 'plans' }))).not.toContain('plan1');
    await on(store, as('m03')).closePlan({ planId: 'plan2' });
    await on(store, as('m02')).setBlock({ target: { type: 'user', id: 'm04' }, active: true });
    expect(planIds(await on(store, as('m02')).search({ kind: 'plans' }))).toEqual([
      'plan1',
      'plan5',
      'plan6',
    ]);
    // 2026-09-27 11:00 in Almaty: plan1 has started.
    const later = createMockRepository({
      clock: fixedClock('2026-09-27T06:00:00Z'),
      latency: 0,
      store: createMemoryStore(),
    });
    expect(planIds(await later.search({ kind: 'plans' }))).not.toContain('plan1');
  });
});
