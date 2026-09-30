import { expect, test } from '@playwright/test';

import { joinAsMadina } from './helpers';

test.describe('routes', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'routing does not depend on the theme');
  });

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

  test('the Home menu reaches safety, membership and Активность', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('home-menu').click();
    await page.getByTestId('menu-notifications').click();
    await expect(page.getByTestId('screen-activity')).toBeVisible();
    await page.getByTestId('tab-index').click();
    for (const [item, screen] of [
      ['menu-safety', 'screen-safety'],
      ['menu-membership', 'screen-membership'],
    ] as const) {
      await page.getByTestId('home-menu').click();
      await page.getByTestId(item).click();
      await expect(page.getByTestId(screen)).toBeVisible();
      await page
        .getByTestId(screen)
        .getByTestId(screen === 'screen-safety' ? 'safety-close' : 'membership-close')
        .click();
      await expect(page.getByTestId('screen-home')).toBeVisible();
    }
  });
});
