import { expect, test } from '@playwright/test';

import { signInAs } from './helpers';

test.describe('Фильтры ленты', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member starts from their own answers, changes them and resets', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await expect(page.getByTestId('home-filters-count')).toHaveText('7');
    // Why a post is here, at most two reasons, never a percentage.
    await expect(page.getByTestId('post-reasons').first()).toBeVisible();
    await expect(page.getByTestId('screen-home')).not.toContainText('%');

    await page.getByTestId('home-filters').click();
    await expect(page.getByTestId('feed-filters-guest-note')).toHaveCount(0);
    const chosen = page.locator('[data-testid^="feed-filter-city-"][aria-checked="true"]');
    await expect(chosen).toHaveCount(1);
    await chosen.click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('screen-feed-filters')).toHaveCount(0);
    await expect(page.getByTestId('home-filters-count')).toHaveText('6');

    await page.reload();
    await expect(page.getByTestId('home-filters-count')).toHaveText('6');
    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filters-reset').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('7');
  });

  test('«Подписки» shows the people a member follows, or a way to find them', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await page.getByTestId('feed-tab-following').click();
    await expect(
      page.getByRole('article').first().or(page.getByTestId('feed-empty-action')),
    ).toBeVisible();
    await expect(page.getByTestId('feed-error')).toHaveCount(0);
    await expect(page.getByTestId('home-filters')).toHaveCount(0);
  });
});
