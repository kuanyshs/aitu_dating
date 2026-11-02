import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina, openDemoPanel, signInAs } from './helpers';

/**
 * Screens for the product guide (`docs/product-guide.html`): one test per screenshot, each
 * from a fresh demo. Not part of `pnpm e2e`; run with `pnpm guide`.
 */

// Playwright creates the folder; `scripts/build-guide.mjs` reads the same one.
const dir = process.env.GUIDE_SHOTS ?? 'docs/guide-shots';

async function shot(page: Page, name: string, { keepToast = false } = {}) {
  // A toast from the previous step would cover the screen: wait it out unless it is the point.
  if (!keepToast) await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 15_000 });
  // Let sheets and lists settle before the picture.
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${name}.jpg`, type: 'jpeg', quality: 82 });
}

const answers = [
  ['city', 'almaty'],
  ['intent', 'dating'],
  ['communication', 'messages_first'],
  ['pace', 'gradual'],
  ['firstMeeting', 'coffee_talk'],
  ['boundaries', 'public_place'],
] as const;

async function demoToggle(page: Page, id: string, settled: string) {
  await page.goto('/settings');
  await page.getByTestId(id).click();
  await expect(page.getByTestId(settled)).toBeVisible();
}

test.describe('guide @guide', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'the guide is shot in the light theme');
    test.setTimeout(120_000);
  });

  // 1. Guest
  test('guest-home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('post-type').first()).toBeVisible();
    await shot(page, 'guest-home');
  });

  test('guest-plans-feed', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('feed-content-plans').click();
    await expect(page.getByTestId('plan-card').first()).toBeVisible();
    await shot(page, 'guest-plans-feed');
  });

  test('guest-filters', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-filters').click();
    await expect(page.getByTestId('feed-filters-guest-note')).toBeVisible();
    await shot(page, 'guest-filters');
  });

  test('guest-post', async ({ page }) => {
    await page.goto('/post/p02');
    await expect(page.getByTestId('comment-c-p02-2')).toBeVisible();
    await expect(page.getByTestId('post-join')).toBeVisible();
    await shot(page, 'guest-post');
  });

  test('guest-plan', async ({ page }) => {
    await page.goto('/plan/plan1');
    await expect(page.getByTestId('plan-place-hidden')).toBeVisible();
    await shot(page, 'guest-plan');
  });

  test('guest-activity', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-activity').click();
    await expect(page.getByTestId('activity-access-prompt')).toBeVisible();
    await shot(page, 'guest-activity');
  });

  test('guest-profile', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-access-prompt-join')).toBeVisible();
    await shot(page, 'guest-profile');
  });

  test('menu-guest', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-menu').click();
    await expect(page.getByTestId('menu-about')).toBeVisible();
    await shot(page, 'menu-guest');
  });

  // 2. Joining
  test('join-steps', async ({ page }) => {
    await page.goto('/access');
    await expect(page.getByTestId('candidate-passport-1')).toBeVisible();
    await page.getByTestId('candidate-passport-1').click();
    await shot(page, 'join-passport');
    await page.getByTestId('access-next').click();
    await expect(page.getByTestId('access-rules')).toBeVisible();
    await page.getByTestId('rules-accept').click();
    await shot(page, 'join-rules');
    await page.getByTestId('access-next').click();
    await page.getByTestId('membership-paid-3').click();
    await shot(page, 'join-membership');
    await page.getByTestId('access-next').click();
    await expect(page.getByTestId('access-payment')).toBeVisible();
    await shot(page, 'join-payment');
    await page.getByTestId('payment-pay').click();
    await expect(page.getByTestId('access-profile')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('profile-bio').fill('Люблю разговоры о книгах и долгие прогулки.');
    await page.getByTestId('interest-books').click();
    await page.getByTestId('interest-walks').click();
    await page.getByTestId('profile-style-calm_dialogue').click();
    await shot(page, 'join-card');
    await page.getByTestId('access-next').click();
    for (const [question, answer] of answers) {
      await page.getByTestId(`question-${question}-${answer}`).click();
    }
    await page.getByTestId('question-dateFormat-walk').click();
    await shot(page, 'join-questionnaire');
    await page.getByTestId('questionnaire-create').click();
    await expect(page.getByTestId('access-welcome')).toBeVisible();
    await page.getByTestId('welcome-feed').click();
    await expect(page.getByTestId('home-member')).toBeVisible();
    await expect(page.getByTestId('author-name').first()).toBeVisible();
    await shot(page, 'member-home');
  });

  // 3. Posts and replies
  test('post-member', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await expect(page.getByTestId('comment-c-p02-2')).toBeVisible();
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await shot(page, 'post-member');
  });

  test('reply-surface', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await page.getByTestId('comment-c-p02-2').getByTestId('comment-reply').click();
    await page.getByTestId('reply-input').fill('Мне тоже ближе прогулка: меньше пауз, больше тем.');
    await expect(page.getByTestId('reply-avatar')).toBeVisible();
    await shot(page, 'reply-surface');
  });

  test('comment-sheet', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await page.getByTestId('comment-c-p02-2').getByTestId('comment-menu').first().click();
    await expect(page.getByTestId('post-sheet')).toBeVisible();
    await shot(page, 'comment-sheet');
  });

  test('thread-deleted', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p03');
    await expect(page.getByTestId('comments-empty')).toBeVisible();
    const send = async (text: string) => {
      await page.getByTestId('reply-input').fill(text);
      await page.getByTestId('reply-submit').click();
      await expect(page.getByTestId('screen-reply')).toHaveCount(0);
    };
    await page.getByTestId('reply-composer').click();
    await send('Сначала короткая прогулка, потом кофе.');
    const thread = page.getByTestId('comment-thread').first();
    await thread.getByTestId('comment-reply').click();
    await send('Согласна, в движении говорить проще.');
    await thread.getByTestId('comment-menu').first().click();
    await page.getByTestId('sheet-delete').click();
    await page.getByTestId('sheet-confirm-delete').click();
    await expect(thread.getByTestId('comment-deleted')).toBeVisible();
    await expect(page.getByTestId('post-sheet')).toHaveCount(0);
    await shot(page, 'thread-deleted');
  });

  test('feed-liked', async ({ page }) => {
    await joinAsMadina(page);
    const post = page.getByTestId('post-p02');
    await post.getByTestId('post-like').click();
    await post.getByTestId('post-repost').click();
    await expect(post.getByTestId('post-like')).toHaveAttribute('aria-pressed', 'true');
    await expect(post.getByTestId('post-repost')).toHaveAttribute('aria-pressed', 'true');
    await post.scrollIntoViewIfNeeded();
    await shot(page, 'feed-liked');
  });

  // 4. Creating
  test('compose-question', async ({ page }) => {
    await joinAsMadina(page);
    await expect(page.getByTestId('home-member')).toBeVisible();
    await page.getByTestId('tab-create').click();
    await page.getByTestId('compose-type-question').click();
    await page.getByTestId('compose-topic-city').click();
    await page.getByTestId('compose-topic-meetings').click();
    await page.getByTestId('compose-input').fill('Где в Алматы можно тихо поговорить за кофе?');
    await shot(page, 'compose-question');
    await page.getByTestId('compose-submit').click();
    await expect(page.getByTestId('toast')).toContainText('Опубликовано');
    await shot(page, 'compose-published', { keepToast: true });
  });

  test('compose-quote', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('post-p02').getByTestId('post-quote').click();
    await expect(page.getByTestId('compose-quoted-p02')).toBeVisible();
    await page.getByTestId('compose-input').fill('Мне ближе импровизация, но с запасным планом.');
    await shot(page, 'compose-quote');
  });

  test('compose-draft', async ({ page }) => {
    await joinAsMadina(page);
    await expect(page.getByTestId('home-member')).toBeVisible();
    await page.getByTestId('tab-create').click();
    await page.getByTestId('compose-input').fill('Черновик: о чём поговорить на первой встрече');
    await page.getByTestId('compose-cancel').click();
    await expect(page.getByTestId('compose-sheet')).toBeVisible();
    await shot(page, 'compose-draft');
  });

  test('create-choice', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/create');
    await expect(page.getByTestId('create-plan')).toBeVisible();
    await shot(page, 'create-choice');
  });

  // 5. Profiles
  test('own-profile', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-stat-followers')).toBeVisible();
    await expect(page.getByTestId('my-plans-empty')).toBeVisible();
    await shot(page, 'own-profile');
  });

  test('card-edit', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('tab-profile').click();
    await page.getByTestId('profile-edit-card').click();
    await expect(page.getByTestId('card-edit-passport')).toBeVisible();
    await shot(page, 'card-edit');
  });

  test('member-profile', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/member/m01');
    await expect(page.getByTestId('member-card')).toBeVisible();
    await page.getByTestId('member-follow').click();
    await expect(page.getByTestId('member-follow')).toHaveText('Вы подписаны');
    await shot(page, 'member-profile');
  });

  test('member-mutual', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/member/m09');
    await expect(page.getByTestId('member-mutual')).toBeVisible();
    await expect(page.getByTestId('member-write')).toBeVisible();
    await shot(page, 'member-mutual');
  });

  test('follows-list', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/member/m09');
    await page.getByTestId('member-stat-followers').click();
    await expect(page.getByTestId('follows-list').getByRole('link').first()).toBeVisible();
    await shot(page, 'follows-list');
  });

  // 6. Search
  test('search-people', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('feed-tab-for_you').click();
    await page.getByTestId('home-search').click();
    await expect(page.getByTestId('search-results').getByRole('link').first()).toBeVisible();
    await shot(page, 'search-people');
  });

  test('search-posts', async ({ page }) => {
    await page.goto('/search');
    await page.getByTestId('search-topic-meetings').click();
    await expect(page.getByTestId('search-results').getByRole('article').first()).toBeVisible();
    await shot(page, 'search-posts');
  });

  test('search-plans', async ({ page }) => {
    await page.goto('/search');
    await page.getByTestId('search-kind-plans').click();
    await expect(page.getByTestId('search-results').getByRole('link').first()).toBeVisible();
    await shot(page, 'search-plans');
  });

  // 7. Plans
  test('plan-new', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/plan/new');
    await page.getByTestId('new-plan-date-2026-09-28').click();
    await page.getByTestId('new-plan-time-18:00').click();
    await shot(page, 'plan-new');
  });

  test('plan-member', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/plan/plan1');
    await expect(page.getByTestId('plan-place-area')).toBeVisible();
    await shot(page, 'plan-member');
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-message').fill('Люблю утренний кофе, буду рада компании.');
    await shot(page, 'plan-respond');
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();
    await shot(page, 'plan-pending');
  });

  test('plan-author-and-match', async ({ page }) => {
    for (const [userId, text] of [
      ['m02', 'Давно хотел в эту кофейню.'],
      ['m03', 'С удовольствием составлю компанию.'],
    ] as const) {
      await signInAs(page, userId);
      await page.goto('/plan/plan1');
      await page.getByTestId('plan-respond').click();
      await page.getByTestId('plan-message').fill(text);
      await page.getByTestId('plan-send').click();
      await expect(page.getByTestId('plan-pending')).toBeVisible();
    }
    await signInAs(page, 'm06');
    await page.goto('/plan/plan1');
    await expect(page.getByTestId('plan-waiting')).toHaveText('Ждут ответа: 2');
    await page.getByTestId('plan-responses').scrollIntoViewIfNeeded();
    await shot(page, 'plan-author');
    await page.getByTestId('plan-accept-response-1').click();
    await expect(page.getByTestId('plan-accept-sheet')).toBeVisible();
    await shot(page, 'plan-accept');
    await page.getByTestId('sheet-confirm-accept').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Встреча договорена');
    await shot(page, 'plan-matched');
    await page.getByTestId('plan-menu').click();
    await shot(page, 'plan-author-menu');
  });

  test('my-plans', async ({ page }) => {
    await signInAs(page, 'm06');
    await page.goto('/profile');
    await expect(page.getByTestId('my-plans')).toBeVisible();
    await page.getByTestId('my-plans').scrollIntoViewIfNeeded();
    await shot(page, 'my-plans');
  });

  // 8. Chats
  test('chats-list', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/chats');
    await expect(page.getByTestId('chat-row-chat1-unread')).toBeVisible();
    await shot(page, 'chats-list');
  });

  test('chat', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/chats/chat1');
    await expect(page.getByTestId('chat-messages')).toBeVisible();
    await page.getByTestId('chat-input').fill('Как насчёт субботы?');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('message-message-1-status')).toHaveText('Отправлено');
    await shot(page, 'chat');
  });

  test('chat-message-report', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/chats/chat1');
    await page.getByTestId('message-chat1-m25-bubble').click();
    await expect(page.getByTestId('sheet-report-message')).toBeVisible();
    await shot(page, 'chat-message-report');
  });

  test('chat-meeting-cancelled', async ({ page }) => {
    // m02 and m06 talk already (a mutual Подписка); a Встреча joins, then is cancelled.
    await signInAs(page, 'm02');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();
    await signInAs(page, 'm06');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-accept-response-1').click();
    await page.getByTestId('sheet-confirm-accept').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Встреча договорена');
    await page.getByTestId('plan-write').click();
    await expect(page.getByTestId('screen-chat')).toBeVisible();
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-menu').click();
    await page.getByTestId('sheet-cancel-plan').click();
    await page.getByTestId('sheet-confirm-cancel').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Отменён');
    await page.goto('/chats/chat3');
    await expect(page.getByTestId('chat-context')).toContainText('Встреча отменена');
    await shot(page, 'chat-meeting-cancelled');
  });

  test('chat-failed', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/settings');
    await page.getByTestId('demo-failed-message-once').click();
    await expect(page.getByTestId('demo-failed-message-once')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.goto('/chats/chat2');
    await page.getByTestId('chat-input').fill('Это не дойдёт с первого раза');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('message-message-1-retry')).toBeVisible();
    await shot(page, 'chat-failed');
  });

  test('chat-write-from-comment', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await page.getByTestId('comment-c-p02-2').getByTestId('comment-menu').first().click();
    await page.getByTestId('sheet-write').click();
    await expect(page.getByTestId('chat-context')).toHaveText('Из комментария');
    await shot(page, 'chat-from-comment');
  });

  // 9. Activity
  test('activity', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await expect(page.getByTestId('tab-activity-dot')).toBeVisible();
    await shot(page, 'activity-dot');
    await page.getByTestId('tab-activity').click();
    await expect(page.getByTestId('activity-list').getByRole('link').first()).toBeVisible();
    await expect(page.getByTestId('tab-activity-dot')).toHaveCount(0);
    await shot(page, 'activity');
    await page.getByTestId('activity-category-follows').click();
    await expect(page.getByTestId('activity-follow-m09-new')).toBeVisible();
    await shot(page, 'activity-follows');
  });

  test('activity-plans', async ({ page }) => {
    await signInAs(page, 'm02');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();
    await signInAs(page, 'm06');
    await page.goto('/activity');
    await page.getByTestId('activity-category-plans').click();
    await expect(page.getByTestId('activity-response-response-1')).toBeVisible();
    await shot(page, 'activity-plans');
  });

  // 10. Safety
  test('report', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/report?targetType=post&targetId=p02');
    await expect(page.getByTestId('report-target').getByTestId('author-name')).toBeVisible();
    await page.getByTestId('report-reason-harassment').click();
    await page.getByTestId('report-details').fill('Резкие слова в ответ на вежливый вопрос.');
    await shot(page, 'report-form');
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-block')).toBeVisible();
    await shot(page, 'report-sent');
  });

  test('block-confirm', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-block').click();
    await expect(page.getByTestId('sheet-confirm-block')).toBeVisible();
    await shot(page, 'block-confirm');
  });

  test('safety-member', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-block').click();
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('screen-post')).toHaveCount(0);
    await page.goto('/report?targetType=post&targetId=p03');
    await page.getByTestId('report-reason-harassment').click();
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-sent')).toBeVisible();
    await page.goto('/safety');
    await expect(page.getByTestId('blocked-name')).toBeVisible();
    await page.getByTestId('safety-blocked').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('report-status')).toBeVisible();
    await shot(page, 'safety-member');
  });

  test('moderation', async ({ page }) => {
    await joinAsMadina(page);
    await demoToggle(page, 'demo-moderator', 'demo-panel');
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/moderator');
    await expect(page.getByTestId('moderation-report4')).toBeVisible();
    await shot(page, 'moderation-queue');
    await page.getByTestId('moderation-report5').click();
    await shot(page, 'moderation-report');
    await page.getByTestId('moderation-decide-content_removed').click();
    await expect(page.getByTestId('moderation-confirm')).toBeVisible();
    await shot(page, 'moderation-confirm');
    await page.getByTestId('moderation-sheet-cancel').click();
    await page.getByTestId('moderation-report5').click();
    await page.getByTestId('moderation-decide-member_restricted').click();
    await expect(page.getByTestId('moderation-term-days_7')).toBeVisible();
    await shot(page, 'moderation-term');
  });

  test('appeal', async ({ page }) => {
    await page.goto('/settings');
    await page.getByTestId('demo-candidate-passport-2').click();
    await page.getByTestId('demo-restrict').click();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();
    await page.getByTestId('restricted-appeal-open').click();
    await page
      .getByTestId('restricted-appeal-text')
      .fill('Я ничего не нарушал: человек сам предложил обменяться контактами.');
    await shot(page, 'restricted-appeal-form');
    await page.getByTestId('restricted-appeal-send').click();
    await expect(page.getByTestId('restricted-appeal-status')).toHaveText(
      'Апелляция на рассмотрении',
    );
    await page.getByTestId('restricted-support').scrollIntoViewIfNeeded();
    await page.getByTestId('restricted-support-text').fill('Как долго рассматривают апелляцию?');
    await page.getByTestId('restricted-support-send').click();
    await expect(page.getByTestId('restricted-support-sent')).toBeVisible();
    await shot(page, 'restricted-support');

    // A moderator elsewhere sees it in «Апелляции».
    await signInAs(page, 'm05');
    await demoToggle(page, 'demo-moderator', 'demo-panel');
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/moderator');
    await page.getByTestId('moderation-tab-appeals').click();
    await expect(page.getByTestId('appeal-appeal-1')).toBeVisible();
    await shot(page, 'moderation-appeals');
  });

  test('support', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/safety');
    await page.getByTestId('safety-support-button').click();
    await page.getByTestId('support-topic-safety').click();
    await page
      .getByTestId('support-text')
      .fill('На встрече человек настаивал на поездке в другое место.');
    await page.getByTestId('support-send').click();
    await expect(page.getByTestId('support-sent')).toBeVisible();
    await shot(page, 'support');
  });

  test('restricted', async ({ page }) => {
    await page.goto('/settings');
    await page.getByTestId('demo-candidate-passport-2').click();
    await expect(page.getByTestId('demo-restrict')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('demo-restrict').click();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();
    await shot(page, 'restricted');
  });

  // 11. Membership
  test('membership', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('home-menu').click();
    await shot(page, 'menu-member');
    await page.getByTestId('menu-membership').click();
    await expect(page.getByTestId('membership-left')).toBeVisible();
    await shot(page, 'membership');
  });

  test('expired', async ({ page }) => {
    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.getByTestId('settings-close').click();
    await page.getByTestId('tab-index').click();
    await expect(page.getByTestId('home-renew-banner')).toBeVisible();
    await shot(page, 'expired-home');
    await page.goto('/post/p02');
    await expect(page.getByTestId('post-renew')).toBeVisible();
    await shot(page, 'expired-post');
    await page.goto('/renew');
    await expect(page.getByTestId('renew-choose')).toBeVisible();
    await page.getByTestId('renew-paid-3').click();
    await shot(page, 'renew');
  });

  test('expired-chat', async ({ page }) => {
    await signInAs(page, 'm01');
    await demoToggle(page, 'demo-expire', 'demo-restore');
    await page.goto('/chats/chat1');
    await expect(page.getByTestId('chat-read-only')).toBeVisible();
    await shot(page, 'expired-chat');
  });

  // 12. About, settings, demo
  test('about-and-rules', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByTestId('about-demo')).toBeVisible();
    await shot(page, 'about');
    await page.getByTestId('about-rules').click();
    await expect(page.getByTestId('rules-list')).toBeVisible();
    await shot(page, 'rules');
  });

  test('settings-demo', async ({ page }) => {
    await joinAsMadina(page);
    await openDemoPanel(page);
    await shot(page, 'settings');
    await page.getByTestId('demo-panel').scrollIntoViewIfNeeded();
    await page.getByTestId('demo-reset').scrollIntoViewIfNeeded();
    await shot(page, 'demo-panel');
  });

  test('offline', async ({ page }) => {
    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-offline').click();
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await page.getByTestId('settings-close').click();
    await page.getByTestId('tab-index').click();
    await shot(page, 'offline');
  });
});

test.describe('guide dark @guide', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'dark', 'dark samples only');
    test.setTimeout(120_000);
  });

  test('dark-home', async ({ page }) => {
    await joinAsMadina(page);
    await expect(page.getByTestId('author-name').first()).toBeVisible();
    await shot(page, 'dark-home');
  });

  test('dark-plan', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/plan/plan1');
    await expect(page.getByTestId('plan-place-area')).toBeVisible();
    await shot(page, 'dark-plan');
  });

  test('dark-chat', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/chats/chat1');
    await expect(page.getByTestId('chat-messages')).toBeVisible();
    await shot(page, 'dark-chat');
  });
});
