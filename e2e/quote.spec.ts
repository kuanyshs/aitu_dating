import { expect, test } from '@playwright/test';

import { joinAsMadina, signInAsSeedAuthor, topFeedArticle } from './helpers';

test.describe('Создание: a quote', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('«Цитировать» publishes a quote that leads «Для вас» and opens its original', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    // From the feed, as a member would: publishing then closes the post screen too.
    await page.getByTestId('post-p02').getByTestId('post-open').click();
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('screen-post').getByTestId('post-quote').click();

    await expect(page.getByRole('heading', { name: 'Цитата' })).toBeVisible();
    await expect(page.getByTestId('compose-quoted-p02')).toBeVisible();
    await expect(page.getByTestId('compose-type-post')).toHaveCount(0);
    await page.getByTestId('compose-input').fill('Мне ближе импровизация, но с запасным планом.');
    await testInfo.attach('compose-quote', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('compose-submit').click();

    await expect(page.getByTestId('toast')).toContainText('Опубликовано');
    await expect(page.getByTestId('screen-post')).toHaveCount(0);
    const text = 'Мне ближе импровизация, но с запасным планом.';
    await expect.poll(async () => (await topFeedArticle(page))?.text ?? '').toContain(text);
    const created = page.getByTestId('screen-home').getByRole('article').filter({ hasText: text });
    // Home shows the top of the feed again, even if the reader had scrolled down to p02.
    await expect(created).toBeInViewport({ ratio: 0.9 });
    await expect(created.getByTestId('post-type')).toHaveText('Цитата');
    await created.getByTestId('quoted-post').click();
    await expect(page.getByTestId('screen-post').getByTestId('post-p02')).toBeVisible();
  });

  test('a direct link to the editor still shows the quoted post', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/compose?quote=p02');
    await expect(page.getByTestId('compose-quoted-p02')).toBeVisible();
    await expect(page.getByTestId('compose-submit')).toHaveAttribute('aria-disabled', 'true');
  });

  test('a quote of a post that is gone cannot be published', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/compose?quote=p14');
    await expect(page.getByTestId('compose-quoted-unavailable')).toHaveText(
      'Публикация недоступна',
    );
    await page.getByTestId('compose-input').fill('Не уйдёт');
    await expect(page.getByTestId('compose-error')).toBeVisible();
    await expect(page.getByTestId('compose-submit')).toHaveAttribute('aria-disabled', 'true');
  });

  test('when the original is deleted, the quote says «Публикация недоступна»', async ({
    page,
  }, testInfo) => {
    await signInAsSeedAuthor(page);
    await page.goto('/post/p01');
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-delete').click();
    await page.getByTestId('sheet-confirm-delete').click();
    await expect(page.getByTestId('toast')).toBeVisible();

    await page.goto('/post/p11');
    const card = page.getByTestId('screen-post').getByTestId('quoted-unavailable');
    await expect(card).toHaveText('Публикация недоступна');
    await expect(page.getByTestId('screen-post').getByTestId('quoted-post')).toHaveCount(0);
    await testInfo.attach('quote-unavailable', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
