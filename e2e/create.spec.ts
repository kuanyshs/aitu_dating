import { expect, test } from '@playwright/test';

import { joinAsMadina } from './helpers';

test.describe('Создать', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'the screen does not depend on the theme');
  });

  test('«＋» offers exactly «Создать пост» and «Создать встречу» (v4 §30, 38–40)', async ({
    page,
  }) => {
    await joinAsMadina(page);
    await expect(page.getByTestId('home-member')).toBeVisible();
    await page.getByTestId('tab-create').click();
    const sheet = page.getByTestId('create-sheet');
    await expect(sheet.getByRole('menuitem')).toHaveText(['Создать пост', 'Создать встречу']);
    await expect(sheet).not.toContainText('Вопрос');
    await expect(sheet).not.toContainText('Цитата');
    await page.getByTestId('create-sheet-cancel').click();
    await expect(page.getByTestId('create-sheet')).toHaveCount(0);

    await page.getByTestId('tab-create').click();
    await page.getByTestId('create-post').click();
    await expect(page.getByRole('heading', { name: 'Новый пост' })).toBeVisible();
    await expect(page.getByTestId('screen-compose')).not.toContainText('Вопрос');
    await page.getByTestId('compose-cancel').click();

    await page.getByTestId('tab-create').click();
    await page.getByTestId('create-plan').click();
    await expect(page.getByTestId('new-plan-city-chosen-351010000')).toBeVisible();
  });

  test('a link offers the same two, each opening its form', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/create');
    const screen = page.getByTestId('screen-create');
    await expect(screen.getByRole('heading', { name: 'Создать' })).toBeVisible();
    await expect(page.getByTestId('create-post')).toContainText('наблюдение');
    await expect(page.getByTestId('create-question')).toHaveCount(0);
    await expect(page.getByTestId('create-plan')).toContainText('публичном месте');
    await page.getByTestId('create-plan').click();
    await expect(page.getByTestId('new-plan-city-chosen-351010000')).toBeVisible();
  });

  test('a guest is shown the way in', async ({ page }) => {
    await page.goto('/create');
    await expect(page.getByTestId('create-access-prompt')).toBeVisible();
    await expect(page.getByTestId('create-post')).toHaveCount(0);
  });
});
