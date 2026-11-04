import { expect, test, type Page } from '@playwright/test';

import { pickSettlement, signInAs } from './helpers';

/** The testIDs of every option the filter screen offers, in order. */
async function filterOptions(page: Page): Promise<string[]> {
  await expect(page.getByTestId('feed-filter-content-all')).toBeVisible();
  return page
    .locator('[data-testid^="feed-filter-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? ''));
}

test.describe('Ленты и единый фильтр', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('an unverified user finds the three feeds and one filter in both (v4 §30, 1–10)', async ({
    page,
  }) => {
    await page.goto('/');
    // 1–5: «Поиск», «Популярное», «Мои подписки»; the old names are gone.
    await expect(page.getByTestId('feed-tab-for_you')).toHaveText('Поиск');
    await expect(page.getByTestId('feed-tab-popular')).toHaveText('Популярное');
    await expect(page.getByTestId('feed-tab-following')).toHaveText('Мои подписки');
    const tabs = page.getByRole('radiogroup', { name: 'Ленты' });
    await expect(tabs).not.toContainText('Для тебя');
    await expect(tabs.getByText('Подписки', { exact: true })).toHaveCount(0);

    // 6–8: the same filter opens from «Поиск» and «Мои подписки».
    await page.getByTestId('home-filters').click();
    const fromSearch = await filterOptions(page);
    expect(fromSearch).toEqual(
      expect.arrayContaining([
        'feed-filter-content-plans',
        'feed-filter-city-open',
        'feed-filter-interests-coffee',
        'feed-filter-topics-meetings',
        'feed-filter-intent-dating',
        'feed-filter-format-walk',
        'feed-filter-goal-talk',
        'feed-filter-budget-up_to_3000',
        'feed-filter-payment-each_pays',
        'feed-filter-soon-weekend',
      ]),
    );
    await expect(page.getByTestId('feed-filters-apply')).toHaveText('Применить');
    await expect(page.getByTestId('feed-filters-reset')).toHaveText('Сбросить');
    await expect(page.getByTestId('feed-filters-cancel')).toHaveText('Отмена');
    await page.getByTestId('feed-filters-cancel').click();

    await page.getByTestId('feed-tab-following').click();
    await page.getByTestId('home-filters').click();
    expect(await filterOptions(page)).toEqual(fromSearch);

    // 9: apply; the choice shows as chips.
    await page.getByTestId('feed-filter-interests-coffee').click();
    await page.getByTestId('feed-filter-soon-weekend').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('screen-feed-filters')).toHaveCount(0);
    await expect(page.getByTestId('feed-chip-interests-coffee')).toBeVisible();
    await expect(page.getByTestId('home-filters-count')).toHaveText('2');

    // 10: kept across feeds, a post and a restart; «Популярное» is not filtered.
    await page.getByTestId('feed-tab-popular').click();
    await expect(page.getByTestId('feed-filter-chips')).toHaveCount(0);
    await expect(page.getByTestId('home-filters')).toHaveCount(0);
    await page.getByTestId('feed-tab-for_you').click();
    await expect(page.getByTestId('feed-chip-interests-coffee')).toBeVisible();
    await page.getByRole('article').first().click();
    await page.goBack();
    await expect(page.getByTestId('feed-chip-soon-weekend')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('home-filters-count')).toHaveText('2');

    // A chip removes itself; «Сбросить все» removes the rest.
    await page.getByTestId('feed-chip-soon-weekend').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');
    await page.getByTestId('feed-chips-reset').click();
    await expect(page.getByTestId('feed-filter-chips')).toHaveCount(0);
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
  });

  test('«Отмена» keeps the filter as it was; «Сбросить» clears it only once applied', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filter-topics-meetings').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');

    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filter-intent-friendship').click();
    await page.getByTestId('feed-filters-cancel').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');

    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filters-reset').click();
    await expect(page.getByTestId('feed-filter-topics-meetings')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.getByTestId('feed-filters-close').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');

    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filters-reset').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
  });

  test('a member starts with nothing chosen and keeps the filter with the account', async ({
    page,
  }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
    // Why a post is here, at most two reasons, never a percentage.
    await expect(page.getByTestId('post-reasons').first()).toBeVisible();
    await expect(page.getByTestId('screen-home')).not.toContainText('%');

    await page.getByTestId('home-filters').click();
    await expect(page.getByTestId('feed-filters-guest-note')).toHaveCount(0);
    await pickSettlement(page, 'feed-filter-city', '710000000', 'Астана');
    await page.getByTestId('feed-filter-content-plans').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('feed-chip-city-710000000')).toBeVisible();
    await expect(page.getByTestId('feed-content-plans')).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await expect(page.getByTestId('feed-chip-city-710000000')).toBeVisible();
    await page.getByTestId('feed-tab-following').click();
    await expect(page.getByTestId('feed-chip-city-710000000')).toBeVisible();
    await expect(page.getByTestId('feed-content-plans')).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByRole('article').first().or(page.getByTestId('feed-empty')),
    ).toBeVisible();
    await expect(page.getByTestId('feed-error')).toHaveCount(0);
  });

  test('nothing under the filter offers to reset it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-filters').click();
    await pickSettlement(page, 'feed-filter-city', '790000000', 'Шымкент');
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('feed-empty')).toContainText('Ничего не нашлось');
    await page.getByTestId('feed-empty-action').click();
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});
