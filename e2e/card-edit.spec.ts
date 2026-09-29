import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina } from './helpers';

async function openEditor(page: Page) {
  await page.getByTestId('tab-profile').click();
  await page.getByTestId('profile-edit-card').click();
  await expect(page.getByTestId('card-edit-bio')).toBeVisible();
}

test.describe('Редактирование Карточки', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('changes are saved and the Profile tab shows them', async ({ page }, testInfo) => {
    await joinAsMadina(page);
    await openEditor(page);
    await expect(page.getByTestId('card-edit-passport')).toContainText('Мадина');
    await expect(page.getByTestId('card-edit-save')).toHaveAttribute('aria-disabled', 'true');

    await page.getByTestId('card-edit-bio').fill('Теперь больше про кино и долгие прогулки.');
    await page.getByTestId('card-edit-interest-cinema').click();
    await page.getByTestId('card-edit-intent-dating').click();
    await testInfo.attach('card-edit', { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByTestId('card-edit-save').click();
    await expect(page.getByTestId('toast')).toContainText('Карточка сохранена');
    await expect(page.getByTestId('screen-card-edit')).toHaveCount(0);

    const card = page.getByTestId('profile-card');
    await expect(card.getByTestId('profile-bio-text')).toHaveText(
      'Теперь больше про кино и долгие прогулки.',
    );
    await expect(card).toContainText('кино');
    await expect(card).toContainText('Свидания');

    // Also after a restart.
    await page.reload();
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-bio-text')).toHaveText(
      'Теперь больше про кино и долгие прогулки.',
    );
  });

  test('leaving with changes asks first; without changes it just closes', async ({ page }) => {
    await joinAsMadina(page);
    await openEditor(page);
    await page.getByTestId('card-edit-cancel').click();
    await expect(page.getByTestId('screen-card-edit')).toHaveCount(0);

    await page.getByTestId('profile-edit-card').click();
    await page.getByTestId('card-edit-bio').fill('Черновик, который не сохранится.');
    await page.getByTestId('card-edit-cancel').click();
    await expect(page.getByTestId('card-edit-sheet')).toContainText('Отменить изменения?');
    await page.getByTestId('card-edit-keep').click();
    await expect(page.getByTestId('card-edit-bio')).toHaveValue('Черновик, который не сохранится.');

    await page.getByTestId('card-edit-cancel').click();
    await page.getByTestId('card-edit-discard').click();
    await expect(page.getByTestId('screen-card-edit')).toHaveCount(0);
    await expect(page.getByTestId('profile-bio-text')).toHaveText('Люблю книги и долгие прогулки.');
  });

  test('an empty «О себе» cannot be saved', async ({ page }) => {
    await joinAsMadina(page);
    await openEditor(page);
    await page.getByTestId('card-edit-bio').fill('');
    await expect(page.getByTestId('card-edit-save')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('alert').or(page.getByText('Напишите о себе'))).toBeVisible();
  });

  test('an expired member edits their card too', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/card-edit');
    await page.getByTestId('card-edit-bio').fill('Пишу и после окончания membership.');
    await page.getByTestId('card-edit-save').click();
    await expect(page.getByTestId('toast')).toContainText('Карточка сохранена');
  });

  test('a guest is invited to join', async ({ page }) => {
    await page.goto('/card-edit');
    await expect(page.getByTestId('card-edit-access-prompt')).toBeVisible();
  });
});
