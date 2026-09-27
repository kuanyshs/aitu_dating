import { expect, test, type Page } from '@playwright/test';

import { expectMemberNames, expectNoMemberNames, joinAsMadina } from './helpers';

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
    await page.getByTestId('post-like').click();
    await expect(page.getByTestId('post-like')).toHaveAttribute('aria-pressed', 'true');
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
});
