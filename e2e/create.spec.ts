import { expect, test } from '@playwright/test';

import { joinAsMadina } from './helpers';

test.describe('Создать', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'the screen does not depend on the theme');
  });

  test('a link offers Пост, Вопрос and План, each opening its form', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/create');
    const screen = page.getByTestId('screen-create');
    await expect(screen.getByRole('heading', { name: 'Создать' })).toBeVisible();
    await expect(page.getByTestId('create-post')).toContainText('наблюдение');
    await expect(page.getByTestId('create-question')).toContainText('Ответы придут');
    await expect(page.getByTestId('create-plan')).toContainText('публичном месте');

    await page.getByTestId('create-post').click();
    await expect(page.getByRole('heading', { name: 'Новый пост' })).toBeVisible();
    await page.getByTestId('compose-cancel').click();

    await page.getByTestId('create-question').click();
    await expect(page.getByRole('heading', { name: 'Новый вопрос' })).toBeVisible();
    await expect(page.getByTestId('compose-type-question')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('compose-cancel').click();

    await page.getByTestId('create-plan').click();
    await expect(page.getByTestId('new-plan-city-karaganda')).toBeVisible();
  });

  test('a guest is shown the way in', async ({ page }) => {
    await page.goto('/create');
    await expect(page.getByTestId('create-access-prompt')).toBeVisible();
    await expect(page.getByTestId('create-post')).toHaveCount(0);
  });
});
