import { describe, expect, it } from 'vitest';

import { questionKeys } from '@/catalogs';
import { fixedClock } from '@/clock';
import {
  CLUB_RULES_VERSION,
  FeedPage,
  MyProfile,
  PostView,
  type QuestionnaireAnswers,
} from '@/contracts';
import { createMemoryStore } from '@/storage';

import { createMockRepository } from './createMockRepository';

const safeKeys = ['age', 'avatar', 'city', 'gender', 'view'];

const answers: QuestionnaireAnswers = {
  city: 'almaty',
  intent: 'dating',
  communication: 'messages_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
};

/**
 * Flows A–D and the expiry part of flow G from the spec package
 * (`flows/access-and-demo.md`) as one sequence of calls on one persisted backend,
 * ending with a restart that must see the final state.
 */
describe('first slice: guest → member → logout → login → expiry → renewal', () => {
  it('runs end to end on the repository boundary', async () => {
    const store = createMemoryStore();
    const open = () => createMockRepository({ clock: fixedClock(), latency: 0, store });
    let repo = open();

    // Flow A — guest preview: the safe view only, social actions refused.
    expect(await repo.getSession()).toEqual({ accessState: 'GUEST_PREVIEW', roles: [] });
    const guestFeed = FeedPage.parse(await repo.getHomeFeed({ tab: 'for_you' }));
    for (const post of guestFeed.items) expect(Object.keys(post.author).sort()).toEqual(safeKeys);
    const firstPostId = guestFeed.items[0]!.id;
    const guestPost = PostView.parse(await repo.getPost({ postId: firstPostId }));
    expect(Object.keys(guestPost.author).sort()).toEqual(safeKeys);
    await expect(
      repo.setReaction({ postId: firstPostId, reaction: 'like', active: true }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    // Flow B — free verified onboarding as Айдана.
    await repo.startAccess();
    await repo.selectPassport({ candidateId: 'passport-1' });
    await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
    const free = await repo.selectMembership({ tier: 'free_verified', periodMonths: 12 });
    expect(free.step).toBe('profile'); // no payment step for free verified
    await repo.saveProfileStep({
      bio: 'Люблю разговоры о книгах.',
      interests: ['books', 'coffee'],
      communicationStyle: 'calm_dialogue',
    });
    for (const key of questionKeys.slice(0, -1)) {
      await repo.saveAnswer({ question: key, answer: answers[key] });
    }
    const last = questionKeys[questionKeys.length - 1]!;
    const aidana = MyProfile.parse(
      await repo.completeOnboarding({
        answers: { [last]: answers[last] },
        idempotencyKey: 'first-slice-onboard-1',
      }),
    );
    expect(aidana).toMatchObject({ name: 'Айдана', age: 27, city: 'almaty', verified: true });
    expect(aidana.card.questionnaire[last]).toBe(answers[last]);
    expect(aidana.card.intent).toBe(answers.intent);
    expect(aidana.membership).toMatchObject({ tier: 'free_verified', status: 'active' });
    expect((await repo.getSession()).accessState).toBe('ACTIVE_MEMBER');
    const memberFeed = await repo.getHomeFeed({ tab: 'for_you' });
    expect(memberFeed.items.every((p) => p.author.view === 'member')).toBe(true);

    // Flow D — «Выйти», restart, «Войти» without the Анкета.
    await repo.logout();
    expect((await repo.getHomeFeed({ tab: 'for_you' })).items[0]!.author.view).toBe('safe');
    repo = open();
    expect(await repo.getSession()).toMatchObject({ accessState: 'GUEST_PREVIEW', canLogin: true });
    expect(await repo.login()).toMatchObject({ accessState: 'ACTIVE_MEMBER', userId: aidana.id });
    expect(await repo.getAccessFlow()).toBeNull();
    expect(await repo.getMyProfile()).toEqual(aidana);

    // Flow C — paid membership as Тимур: exactly one period, mock payment, onboarding.
    await repo.switchCandidate('passport-2');
    await repo.startAccess();
    await repo.selectPassport({ candidateId: 'passport-2' });
    await repo.acceptRules({ rulesVersion: CLUB_RULES_VERSION });
    await repo.selectMembership({ tier: 'paid', periodMonths: 1 });
    const paid = await repo.selectMembership({ tier: 'paid', periodMonths: 3 });
    expect(paid.membership).toEqual({ tier: 'paid', periodMonths: 3 });
    expect(paid.step).toBe('payment');
    const afterPayment = await repo.confirmPayment({ idempotencyKey: 'first-slice-pay-1' });
    expect(afterPayment.payment?.amountKzt).toBe(4990);
    await repo.saveProfileStep({
      bio: 'Бегаю по утрам.',
      interests: ['sport'],
      communicationStyle: 'short_messages',
    });
    const timur = await repo.completeOnboarding({
      answers,
      idempotencyKey: 'first-slice-onboard-2',
    });
    expect(timur.membership).toMatchObject({ tier: 'paid', periodMonths: 3, status: 'active' });

    // Flow G — expiry sends social actions to Продление; renewal survives a network error.
    await repo.expireMembership();
    expect((await repo.getSession()).accessState).toBe('ACTIVE_MEMBER_EXPIRED');
    expect((await repo.getHomeFeed({ tab: 'for_you' })).items[0]!.author.view).toBe('safe');
    await expect(
      repo.setReaction({ postId: firstPostId, reaction: 'like', active: true }),
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_EXPIRED' });
    await repo.setDemoFlags({ networkErrorOnce: true });
    const renewal = {
      selection: { tier: 'paid', periodMonths: 1 },
      idempotencyKey: 'first-slice-renew-1',
    } as const;
    await expect(repo.renewMembership(renewal)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const renewed = await repo.renewMembership(renewal);
    expect(renewed.membership).toMatchObject({ periodMonths: 1, status: 'active' });
    expect(renewed.card).toEqual(timur.card);

    // Persisted end state, seen by a fresh backend instance.
    repo = open();
    expect(await repo.getSession()).toMatchObject({
      accessState: 'ACTIVE_MEMBER',
      userId: timur.id,
    });
    expect(await repo.getMyProfile()).toEqual(renewed);
    expect(await repo.listCandidateStatus()).toEqual([
      { candidateId: 'passport-1', name: 'Айдана', hasCard: true },
      { candidateId: 'passport-2', name: 'Тимур', hasCard: true },
      { candidateId: 'passport-3', name: 'Мадина', hasCard: false },
    ]);
    await repo.switchCandidate('passport-1');
    await repo.login();
    expect(await repo.getMyProfile()).toEqual(aidana);
  });
});
