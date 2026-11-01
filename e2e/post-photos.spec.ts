import { expect, test } from '@playwright/test';

import { choosePhotos, joinAsMadina } from './helpers';

test.describe('Фото в публикации', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a post with two Фото is published and opens on the whole screen', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/compose');
    await expect(page.getByTestId('screen-compose')).toBeVisible();
    await page.getByTestId('compose-input').fill('Две фотографии с вечерней прогулки');

    await choosePhotos(page, () => page.getByTestId('compose-photos-add').click(), [
      'red',
      'blue',
      'green',
    ]);
    // Only two fit; the third is not taken and «Добавить фото» is gone.
    await expect(page.getByTestId('compose-photos-slot-1')).toBeVisible();
    await expect(page.getByTestId('compose-photos-slot-2')).toHaveCount(0);
    await expect(page.getByTestId('compose-photos-add')).toHaveCount(0);
    await page.getByTestId('compose-photos-later-0').click();
    await expect(page.getByTestId('compose-submit')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('compose-submit').click();
    await expect(page.getByTestId('toast')).toContainText('Опубликовано');

    const post = page
      .getByTestId('screen-home')
      .getByRole('article')
      .filter({ hasText: 'Две фотографии с вечерней прогулки' });
    await expect(post.getByRole('button', { name: 'Открыть фото 2 из 2' })).toBeVisible();
    await post.getByRole('button', { name: 'Открыть фото 1 из 2' }).click();
    await expect(page.getByTestId('photo-position')).toHaveText('1 из 2');
    await page.getByTestId('photo-close').click();
  });

  test('closing with only Фото offers to keep a draft, and the draft brings them back', async ({
    page,
  }) => {
    await joinAsMadina(page);
    await page.goto('/compose');
    await choosePhotos(page, () => page.getByTestId('compose-photos-add').click(), ['red']);
    await expect(page.getByTestId('compose-photos-remove-0')).toHaveAttribute(
      'aria-label',
      'Удалить фото',
    );
    await page.getByTestId('compose-cancel').click();
    await page.getByTestId('draft-save').click();

    await page.goto('/compose');
    await expect(page.getByTestId('compose-photos-slot-0')).toBeVisible();
  });
});
