import { expect, test } from '@playwright/test';

import { joinAsMadina, openDemoPanel } from './helpers';

test.describe('Ограничение', () => {
  test('a restricted member sees only the restriction screen until it is lifted', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-restrict').click();

    const restricted = page.getByTestId('screen-restricted');
    await expect(restricted).toBeVisible();
    await expect(restricted).toContainText('Правила клуба');
    await expect(restricted).toContainText('Поддержка');
    await expect(page.getByTestId('screen-home')).toBeHidden();
    await expect(page.getByTestId('tab-index')).toBeHidden();
    await testInfo.attach(`restricted-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.reload();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();
    await page.getByTestId('restricted-support').click();
    await expect(page.getByTestId('toast')).toBeVisible();

    await page.getByTestId('screen-restricted').getByTestId('demo-unrestrict').click();
    await expect(page.getByTestId('screen-restricted')).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByTestId('home-messages')).toBeVisible();
    await expect(page.getByTestId('author-name').first()).toBeVisible();
  });

  test('a restricted guest identity returns to preview', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await page.goto('/settings');
    await expect(page.getByTestId('demo-restrict')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('demo-candidate-passport-2').click();
    await page.getByTestId('demo-restrict').click();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();
    await page.getByTestId('screen-restricted').getByTestId('demo-unrestrict').click();
    await expect(page.getByTestId('screen-restricted')).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByTestId('home-join')).toBeVisible();
  });
});

test.describe('moderator role', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('the moderator modal opens only with the role', async ({ page }) => {
    await page.goto('/moderator');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('screen-moderator')).toHaveCount(0);

    await page.goto('/settings');
    await page.getByTestId('demo-moderator').click();
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/');
    await page.getByTestId('home-menu').click();
    await page.getByTestId('menu-moderator').click();
    await expect(page.getByTestId('screen-moderator')).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('demo-moderator').click();
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('demo-moderator')).not.toHaveAttribute('aria-disabled', 'true');
    await page.goto('/moderator');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await page.getByTestId('home-menu').click();
    await expect(page.getByTestId('menu-moderator')).toHaveCount(0);
  });
});
