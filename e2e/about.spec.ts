import { expect, test } from '@playwright/test';

import { joinAsMadina } from './helpers';

test.describe('О продукте', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'the screen does not depend on the theme');
  });

  test('a guest reads the principles and follows the links', async ({ page }) => {
    await page.goto('/about');
    const screen = page.getByTestId('screen-about');
    await expect(screen.getByRole('heading', { name: 'О продукте' })).toBeVisible();
    await expect(page.getByTestId('about-intro')).toContainText('verified-сообщество');
    const principles = page.getByTestId('about-principles');
    await expect(principles).toContainText('Aitu Passport');
    await expect(principles).toContainText('Первая встреча — в публичном месте');
    await expect(principles).toContainText('Жалобы и блокировка');
    await expect(page.getByTestId('about-demo')).toHaveText('Демо-прототип, данные вымышлены.');
    await expect(page.getByTestId('tab-index')).toBeHidden();

    await page.getByTestId('about-rules').click();
    await expect(page.getByTestId('screen-rules')).toBeVisible();
    await expect(page.getByTestId('rules-list')).toContainText(
      'Первая встреча — только в публичном месте.',
    );
    await page.getByTestId('rules-close').click();
    await expect(page.getByTestId('screen-about')).toBeVisible();

    await page.getByTestId('about-safety').click();
    await expect(page.getByTestId('screen-safety')).toBeVisible();
    await page.getByTestId('safety-close').click();
    await page.getByTestId('about-close').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();
  });

  test('a member opens it from the Home menu', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('home-menu').click();
    await page.getByTestId('menu-about').click();
    await expect(page.getByTestId('screen-about')).toBeVisible();
    await page.getByTestId('about-close').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();
  });
});
