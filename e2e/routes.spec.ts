import { expect, test } from '@playwright/test';

import { joinAsMadina } from './helpers';

/** Every surface on the screen map that is not built yet: a named stub with «Назад». */
const stubs = [
  { path: '/about', testID: 'screen-about', title: 'О продукте' },
  { path: '/membership', testID: 'screen-membership', title: 'Membership' },
  { path: '/notifications', testID: 'screen-notifications', title: 'Уведомления' },
] as const;

test.describe('route stubs', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'routing does not depend on the theme');
  });

  for (const stub of stubs) {
    test(`${stub.path} opens by link and closes`, async ({ page }) => {
      await page.goto(stub.path);
      const screen = page.getByTestId(stub.testID);
      await expect(screen).toBeVisible();
      await expect(screen.getByRole('heading', { name: stub.title })).toBeVisible();
      await expect(page.getByTestId('tab-index')).toBeHidden();
      await screen.getByTestId('stub-back').click();
      await expect(page.getByTestId('screen-home')).toBeVisible();
    });
  }

  test('the feed opens a post and a plan, and «Назад» returns to it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('post-open').first().click();
    await expect(page.getByTestId('post-text')).toBeVisible();
    await page.getByTestId('post-back').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();

    await page.getByTestId('feed-tab-plans').click();
    await page.getByTestId('plan-card').first().click();
    await expect(page.getByTestId('screen-plan')).toBeVisible();
    await page.getByTestId('plan-back').click();
    await expect(page.getByTestId('feed-tab-plans')).toHaveAttribute('aria-checked', 'true');
  });

  test('a guest cannot open an author; a member can', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('post-type').first()).toBeVisible();
    await expect(page.getByTestId('post-author')).toHaveCount(0);

    await joinAsMadina(page);
    await page.getByTestId('post-author').first().click();
    await expect(page.getByTestId('screen-member')).toBeVisible();
  });

  test('the Home menu reaches safety, membership and notifications', async ({ page }) => {
    await joinAsMadina(page);
    for (const [item, screen] of [
      ['menu-safety', 'screen-safety'],
      ['menu-membership', 'screen-membership'],
      ['menu-notifications', 'screen-notifications'],
    ] as const) {
      await page.getByTestId('home-menu').click();
      await page.getByTestId(item).click();
      await expect(page.getByTestId(screen)).toBeVisible();
      await page
        .getByTestId(screen)
        .getByTestId(screen === 'screen-safety' ? 'safety-close' : 'stub-back')
        .click();
      await expect(page.getByTestId('screen-home')).toBeVisible();
    }
  });
});
