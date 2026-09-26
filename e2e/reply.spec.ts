import { expect, test } from '@playwright/test';

import { joinAsMadina } from './helpers';

test.describe('reply surface', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member comments on a post and replies to a comment (Flow F)', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p03');
    await expect(page.getByTestId('comments-empty')).toBeVisible();
    await expect(page.getByTestId('post-replies-count')).toHaveText('Ответы · 0');

    await page.getByTestId('reply-composer').click();
    await expect(page.getByTestId('reply-context')).toContainText('Ответ на публикацию');
    const submit = page.getByTestId('reply-submit');
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('reply-input').fill('Хороший вопрос, подумаю.');
    await expect(page.getByTestId('reply-counter')).toHaveText('24 / 360');
    await submit.click();

    await expect(page.getByTestId('screen-reply')).toHaveCount(0);
    await expect(page.getByTestId('toast')).toContainText('Ответ опубликован');
    await expect(page.getByTestId('post-replies-count')).toHaveText('Ответы · 1');
    const thread = page.getByTestId('comment-thread').first();
    await expect(thread).toContainText('Хороший вопрос, подумаю.');
    await expect(thread).toContainText('Мадина');

    await thread.getByTestId('comment-reply').click();
    await expect(page.getByTestId('reply-context')).toContainText('Ответ на комментарий · Мадина');
    await page.getByTestId('reply-input').fill('И ещё мысль вдогонку.');
    await page.getByTestId('reply-submit').click();
    await expect(page.getByTestId('post-replies-count')).toHaveText('Ответы · 2');
    await expect(thread).toContainText('И ещё мысль вдогонку.');
    // An Ответ has no «Ответить»: only the root comment in the thread can be answered.
    await expect(thread.getByTestId('comment-reply')).toHaveCount(1);

    await page.getByTestId('post-back').click();
    await page.goto('/');
    await page.reload();
    await page.goto('/post/p03');
    await expect(page.getByTestId('post-replies-count')).toHaveText('Ответы · 2');
  });

  test('a failed send keeps the text and the retry publishes once', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-network-error-once').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await page.goto('/reply?postId=p03');
    await expect(page.getByTestId('screen-reply')).toBeVisible();
    await page.getByTestId('reply-input').fill('Текст не должен пропасть');
    await page.getByTestId('reply-submit').click();
    await expect(page.getByTestId('reply-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('reply-input')).toHaveValue('Текст не должен пропасть');
    await page.getByTestId('reply-retry').click();
    await expect(page.getByTestId('screen-reply')).toHaveCount(0, { timeout: 10_000 });
    await page.goto('/post/p03');
    await expect(page.getByTestId('post-replies-count')).toHaveText('Ответы · 1');
  });

  test('💬 in the feed opens the post with the reply surface', async ({ page }) => {
    await joinAsMadina(page);
    await page
      .getByRole('button', { name: /^Комментарии/ })
      .first()
      .click();
    await expect(page.getByTestId('screen-reply')).toBeVisible();
    await page.getByTestId('reply-cancel').click();
    await expect(page.getByTestId('post-text')).toBeVisible();
  });
});
