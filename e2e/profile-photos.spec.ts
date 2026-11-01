import { expect, test } from '@playwright/test';

import { choosePhotos, joinAsMadina, signInAs } from './helpers';

test.describe('Фото профиля', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member adds, orders and removes Фото; others see them in full', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/card-edit');
    await page.getByTestId('card-edit-photos').click();
    await expect(page.getByTestId('screen-profile-photos')).toBeVisible();

    await choosePhotos(page, () => page.getByTestId('profile-photos-add').click(), ['red', 'blue']);
    await expect(page.getByTestId('profile-photos-main')).toBeVisible();
    await expect(page.getByTestId('profile-photos-make-main-1')).toBeVisible();

    // The second becomes the main one, then the other is removed after a confirmation.
    await page.getByTestId('profile-photos-make-main-1').click();
    await page.getByTestId('profile-photos-remove-1').click();
    await expect(page.getByTestId('profile-photos-sheet')).toContainText('Удалить фото?');
    await page.getByTestId('sheet-confirm-remove-photo').click();
    await expect(page.getByTestId('profile-photos-slot-1')).toHaveCount(0);

    // A third upload fills the set again; four is the limit.
    await choosePhotos(page, () => page.getByTestId('profile-photos-add').click(), [
      'green',
      'red',
      'blue',
    ]);
    await expect(page.getByTestId('profile-photos-slot-3')).toBeVisible();
    await expect(page.getByTestId('profile-photos-add')).toHaveCount(0);
    await page.waitForTimeout(1000);

    await page.goto('/profile');
    await expect(page.getByTestId('profile-photos-gallery-3')).toBeVisible();
    await expect(page.getByTestId('profile-card').getByTestId('avatar-photo')).toBeVisible();
    await page.getByTestId('profile-photos-gallery-0').click();
    await expect(page.getByTestId('photo-position')).toHaveText('1 из 4');
    await page.getByTestId('photo-next').click();
    await expect(page.getByTestId('photo-position')).toHaveText('2 из 4');
    await page.getByTestId('photo-close').click();
    await expect(page.getByTestId('screen-photo')).toHaveCount(0);

    await signInAs(page, 'm03');
    await page.goto('/member/me-passport-3');
    await expect(page.getByTestId('member-photos-0')).toBeVisible();
  });

  test('a wrong format is explained and nothing is uploaded', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/profile-photos');
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('profile-photos-add').click();
    await (await chooser).setFiles('e2e/fixtures/not-a-photo.gif');
    await expect(page.getByTestId('toast')).toContainText('JPG, PNG или WEBP');
    await expect(page.getByTestId('profile-photos-slot-0')).toHaveCount(0);
  });
});
