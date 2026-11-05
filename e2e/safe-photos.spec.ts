import { expect, test } from '@playwright/test';

import { choosePhotos, joinAsMadina } from './helpers';

test.describe('Безопасные фото (v4 §26, §30 11–16, 117)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a guest sees a blurred stand-in, never the original, and is invited to verify', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/compose');
    await page.getByTestId('compose-input').fill('Прогулка по набережной');
    await choosePhotos(page, () => page.getByTestId('compose-photos-add').click(), ['ai']);
    await expect(page.getByTestId('compose-photos-ai-0')).toBeVisible();
    await page.getByTestId('compose-submit').click();
    await expect(page.getByTestId('toast')).toContainText('Опубликовано');

    const article = page
      .getByTestId('screen-home')
      .getByRole('article')
      .filter({ hasText: 'Прогулка по набережной' });
    const postId = (await article.getAttribute('data-testid'))!.replace(/^post-/, '');
    const original = await article.locator('img').first().getAttribute('src');

    await page.getByTestId('home-menu').click();
    await page.getByTestId('menu-logout').click();
    await expect(page.getByTestId('home-login')).toBeVisible();
    await page.goto(`/post/${postId}`);
    const blurred = page.getByTestId('screen-post').locator('[data-testid$="-0-blurred"]');
    await expect(blurred).toBeVisible();
    await expect(page.getByTestId('screen-post')).toContainText(
      'Фото видно верифицированным пользователям',
    );
    // The AI label stays; only the tiny copy reached the page.
    await expect(page.getByTestId('screen-post')).toContainText('Сгенерировано с ИИ');
    const html = await page.content();
    expect(original && html.includes(original)).toBe(false);
    const size = await blurred
      .locator('img')
      .first()
      .evaluate((img: HTMLImageElement) => ({
        w: img.naturalWidth,
        h: img.naturalHeight,
      }));
    expect(Math.max(size.w, size.h)).toBeLessThanOrEqual(24);

    await page.getByTestId('screen-post').locator('[data-testid$="-photos-0"]').click();
    await expect(page.getByTestId('access-passport')).toBeVisible();
  });
});
