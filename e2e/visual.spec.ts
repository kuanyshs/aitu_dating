import { expect, test, type Page } from '@playwright/test';

import { expectMemberNames, expectNoMemberNames, joinAsMadina, signInAs } from './helpers';

/**
 * Visual baselines of the first slice in both themes (390×844). They are rendered and
 * compared in CI inside the Playwright image; see README → «Визуальные эталоны».
 */

const answers = [
  ['city', 'almaty'],
  ['intent', 'dating'],
  ['communication', 'messages_first'],
  ['pace', 'gradual'],
  ['firstMeeting', 'coffee_talk'],
  ['boundaries', 'public_place'],
  ['dateFormat', 'walk'],
] as const;

async function snap(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`);
}

/** Writes on the «Ответ» surface and waits until it has closed. */
async function reply(page: Page, text: string) {
  await page.getByTestId('reply-input').fill(text);
  await page.getByTestId('reply-submit').click();
  await expect(page.getByTestId('screen-reply')).toHaveCount(0);
}

test.describe('visual baselines @visual', () => {
  test('guest screens', async ({ page }) => {
    await page.goto('/');
    await expectNoMemberNames(page);
    await snap(page, 'home-guest');

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-access-prompt-join')).toBeVisible();
    await snap(page, 'profile-guest');
  });

  test('joining, member mode and the way back', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/access');
    await expect(page.getByTestId('candidate-passport-1')).toBeVisible();
    await snap(page, 'passport-step');

    await page.getByTestId('candidate-passport-1').click();
    await page.getByTestId('access-next').click();
    await page.getByTestId('rules-accept').click();
    await page.getByTestId('access-next').click();
    await page.getByTestId('membership-paid-3').click();
    await snap(page, 'membership-step');

    await page.getByTestId('access-next').click();
    await page.getByTestId('payment-pay').click();
    await expect(page.getByTestId('access-profile')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('profile-bio').fill('Люблю разговоры о книгах.');
    await page.getByTestId('interest-books').click();
    await page.getByTestId('profile-style-calm_dialogue').click();
    await page.getByTestId('access-next').click();
    for (const [question, answer] of answers) {
      await page.getByTestId(`question-${question}-${answer}`).click();
    }
    await expect(page.getByTestId('questionnaire-create')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await snap(page, 'questionnaire-7of7');

    await page.getByTestId('questionnaire-create').click();
    await expect(page.getByTestId('home-messages')).toBeVisible();
    await expectMemberNames(page);
    await snap(page, 'home-member');

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Айдана');
    // The counters load on their own after the card.
    await expect(page.getByTestId('profile-stat-followers')).toBeVisible();
    // «Встречи» load on their own too.
    await expect(page.getByTestId('my-plans-empty')).toBeVisible();
    await snap(page, 'profile-member');

    await page.getByRole('button', { name: 'Выйти в preview' }).click();
    await expect(page.getByTestId('profile-access-prompt-login')).toBeVisible();
    await snap(page, 'profile-guest-with-card');
  });

  test('restriction screen', async ({ page }) => {
    await page.goto('/settings');
    await page.getByTestId('demo-candidate-passport-2').click();
    await expect(page.getByTestId('demo-restrict')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('demo-restrict').click();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();
    await snap(page, 'restricted');
  });

  test('post screen: a guest in the safe view', async ({ page }) => {
    await page.goto('/post/p02');
    await expect(page.getByTestId('comment-c-p02-2')).toBeVisible();
    await expect(page.getByTestId('post-join')).toBeVisible();
    await snap(page, 'post-guest');
  });

  test('post screen: a member with a thread, likes and a deleted comment', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/post/p03');
    await expect(page.getByTestId('comments-empty')).toBeVisible();

    // A root with a reply, then the root is deleted: «Комментарий удалён» keeps the reply.
    await page.getByTestId('reply-composer').click();
    await reply(page, 'Сначала короткая прогулка, потом кофе.');
    const thread = page.getByTestId('comment-thread').first();
    await thread.getByTestId('comment-reply').click();
    await reply(page, 'Согласна, в движении говорить проще.');
    await thread.getByTestId('comment-menu').first().click();
    await page.getByTestId('sheet-delete').click();
    await page.getByTestId('sheet-confirm-delete').click();
    await expect(thread.getByTestId('comment-deleted')).toBeVisible();
    await expect(page.getByTestId('post-sheet')).toHaveCount(0);

    // A second root, liked, and a like on the surviving reply and on the post.
    await page.getByTestId('reply-composer').click();
    await reply(page, 'Мне важно, чтобы было тихо и можно было спокойно поговорить.');
    await page.getByTestId('comments-sort-new').click();
    const likes = page.getByTestId('comment-like');
    await expect(likes).toHaveCount(2);
    for (const like of await likes.all()) await like.click();
    // The feed stays mounted under the post screen: its like button has the same test id.
    const postLike = page.getByTestId('screen-post').getByTestId('post-like');
    await postLike.click();
    await expect(postLike).toHaveAttribute('aria-pressed', 'true');
    await expect(likes.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await snap(page, 'post-member');
  });

  test('post screen: an expired member is offered «Продлить»', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/post/p02');
    await expect(page.getByTestId('comment-c-p02-2')).toBeVisible();
    await expect(page.getByTestId('post-renew')).toBeVisible();
    await snap(page, 'post-expired');
  });

  test('the «Ответ» surface with text and its counter', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await page.getByTestId('comment-c-p02-2').getByTestId('comment-reply').click();
    await page.getByTestId('reply-input').fill('Мне тоже ближе прогулка: меньше пауз, больше тем.');
    await expect(page.getByTestId('reply-counter')).toHaveText('49 / 360');
    await expect(page.getByTestId('reply-avatar')).toBeVisible();
    await snap(page, 'reply-surface');
  });

  test('Создание: the empty editor', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await expect(page.getByTestId('home-messages')).toBeVisible();
    await page.getByTestId('tab-create').click();
    await expect(page.getByTestId('compose-avatar')).toBeVisible();
    await expect(page.getByTestId('compose-submit')).toHaveAttribute('aria-disabled', 'true');
    await snap(page, 'compose-empty');
  });

  test('Создание: a quote with a failed send', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    // The quoted post comes from what the feed loaded; offline then fails the send.
    await page.getByTestId('post-p02').getByTestId('post-open').click();
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('post-back').click();
    await page.getByTestId('tab-profile').click();
    await page.getByTestId('open-settings').click();
    await page.getByTestId('demo-offline').click();
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await page.getByTestId('settings-close').click();
    await page.getByTestId('tab-index').click();
    await page.getByTestId('post-p02').getByTestId('post-quote').click();
    await expect(page.getByTestId('compose-quoted-p02')).toBeVisible();
    await page.getByTestId('compose-input').fill('Мне ближе импровизация, но с запасным планом.');
    await page.getByTestId('compose-submit').click();
    await expect(page.getByTestId('compose-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('compose-avatar')).toBeVisible();
    await snap(page, 'compose-quote-error');
  });

  test('Создание: «Мои публикации» in the profile', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    for (const [kind, text] of [
      ['post', 'Первый пост Мадины'],
      ['question', 'Где в Алматы тихо поговорить?'],
    ] as const) {
      await expect(page.getByTestId('home-messages')).toBeVisible();
      await page.getByTestId('tab-create').click();
      await page.getByTestId(`compose-type-${kind}`).click();
      await page.getByTestId('compose-input').fill(text);
      await page.getByTestId('compose-submit').click();
      await expect(page.getByTestId('screen-compose')).toHaveCount(0);
    }
    await page.getByTestId('tab-profile').click();
    const section = page.getByTestId('my-posts');
    await expect(section.getByRole('article')).toHaveCount(2);
    await expect(page.getByTestId('profile-stat-followers')).toBeVisible();
    await expect(page.getByTestId('my-plans-empty')).toBeVisible();
    await section.getByRole('heading').scrollIntoViewIfNeeded();
    await snap(page, 'my-posts');
  });

  test('Жалоба: the form with a reason and details', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/report?targetType=post&targetId=p02');
    await expect(page.getByTestId('report-target').getByTestId('author-name')).toBeVisible();
    await page.getByTestId('report-reason-harassment').click();
    await page.getByTestId('report-details').fill('Резкие слова в ответ на вежливый вопрос.');
    await snap(page, 'report-form');
  });

  test('Жалоба: sent, with the offer to block', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/report?targetType=post&targetId=p02');
    await expect(page.getByTestId('report-target').getByTestId('author-name')).toBeVisible();
    await page.getByTestId('report-reason-spam').click();
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-block')).toBeVisible();
    await snap(page, 'report-sent');
  });

  test('Безопасность: a member with a block and reports', async ({ page }) => {
    test.setTimeout(90_000);
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
    await expect(page.getByTestId('report-status')).toBeVisible();
    await page.getByTestId('safety-blocked').scrollIntoViewIfNeeded();
    await snap(page, 'safety-member');
  });

  test('Безопасность: a guest', async ({ page }) => {
    await page.goto('/safety');
    await expect(page.getByTestId('safety-support')).toBeVisible();
    await snap(page, 'safety-guest');
  });

  test('Модерация: the queue of new reports', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-moderator').click();
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/moderator');
    await expect(page.getByTestId('moderation-report4')).toBeVisible();
    await snap(page, 'moderation-queue');
  });

  test('Модерация: a decision to confirm', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-moderator').click();
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/moderator');
    await page.getByTestId('moderation-report5').click();
    await page.getByTestId('moderation-decide-content_removed').click();
    await expect(page.getByTestId('moderation-confirm')).toBeVisible();
    // Opening took it into review: the tab underneath has reloaded without it.
    await expect(page.getByTestId('moderation-report5')).toHaveCount(0);
    await snap(page, 'moderation-confirm');
  });

  test('Профиль: another member in full', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/member/m01');
    await expect(page.getByTestId('member-card')).toBeVisible();
    await expect(page.getByTestId('member-posts').getByRole('article').first()).toBeVisible();
    await snap(page, 'member-profile');
  });

  test('Поиск: people nearby', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.getByTestId('tab-search').click();
    await expect(page.getByTestId('search-nearby')).toBeVisible();
    await expect(page.getByTestId('search-results').getByRole('link').first()).toBeVisible();
    await snap(page, 'search-people');
  });

  test('Поиск: posts by a Тема', async ({ page }) => {
    await page.goto('/search');
    await page.getByTestId('search-topic-meetings').click();
    await expect(page.getByTestId('search-results').getByRole('article').first()).toBeVisible();
    await snap(page, 'search-posts');
  });

  test('Профиль: editing the Карточка', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.getByTestId('tab-profile').click();
    await page.getByTestId('profile-edit-card').click();
    await expect(page.getByTestId('card-edit-passport')).toBeVisible();
    await snap(page, 'card-edit');
  });

  test('План: a member with the place and an Отклик being written', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/plan/plan1');
    await expect(page.getByTestId('plan-place')).toBeVisible();
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-message').fill('Люблю утренний кофе, буду рада компании.');
    await snap(page, 'plan-member');
  });

  test('План: the author with an Отклик to decide', async ({ page }) => {
    // One Отклик: the demo clock restarts on every load, so the order of two sent from
    // separate loads is not fixed.
    await signInAs(page, 'm02');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-message').fill('Давно хотел в эту кофейню.');
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();

    await signInAs(page, 'm06');
    await page.goto('/plan/plan1');
    await expect(page.getByTestId('plan-waiting')).toHaveText('Ждут ответа: 1');
    await expect(page.getByTestId('plan-accept-response-1')).toBeVisible();
    await snap(page, 'plan-author');
  });

  test('План: the form to create one', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/plan/new');
    await page.getByTestId('new-plan-date-2026-09-28').click();
    await page.getByTestId('new-plan-time-18:00').click();
    await expect(page.getByTestId('new-plan-time-18:00')).toHaveAttribute('aria-checked', 'true');
    await snap(page, 'plan-new');
  });

  test('Поиск: open plans', async ({ page }) => {
    await page.goto('/search');
    await page.getByTestId('search-kind-plans').click();
    await expect(page.getByTestId('search-results').getByRole('link')).toHaveCount(5);
    await snap(page, 'search-plans');
  });

  test('Сообщения: the chat list', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/chats');
    await expect(page.getByTestId('chat-row-chat1-unread')).toBeVisible();
    await expect(page.getByTestId('chat-row-chat2-context')).toBeVisible();
    await snap(page, 'chats-list');
  });

  test('Чат: a message that did not go', async ({ page }) => {
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
    await expect(page.getByTestId('chat-context')).toBeVisible();
    await snap(page, 'chat-failed');
  });

  test('О продукте: a guest', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByTestId('about-demo')).toBeVisible();
    await snap(page, 'about');
  });

  test('Membership: a member with free verified', async ({ page }) => {
    await joinAsMadina(page);
    // Through the menu: a reload would restart the demo clock before the join.
    await page.getByTestId('home-menu').click();
    await page.getByTestId('menu-membership').click();
    await expect(page.getByTestId('membership-left')).toHaveText('365 дней');
    await snap(page, 'membership');
  });

  test('Активность: new events of a seed author', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/activity');
    await expect(page.getByTestId('activity-list').getByRole('link').first()).toBeVisible();
    // Opening the tab marks it seen: wait for the dot to go, or the snapshot catches it.
    await expect(page.getByTestId('tab-activity-dot')).toHaveCount(0);
    await snap(page, 'activity');
  });
});
