import { expect, test } from '@playwright/test';

import { joinAsMadina } from './helpers';

// Open seed plans: plan1 (coffee, Алматы), plan2, plan3 (walk, Караганда), plan5 (coffee,
// Астана, talk), plan6 (walk, Караганда); plan4 is already a Встреча.

test.describe('Поиск: планы', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a guest finds open plans by a word and a goal, and opens one', async ({ page }) => {
    await page.goto('/search');
    await page.getByTestId('search-kind-plans').click();
    const results = page.getByTestId('search-results');
    await expect(results.getByRole('link')).toHaveCount(5);
    await expect(page.getByTestId('search-plan-plan4')).toHaveCount(0);

    await page.getByTestId('search-input').fill('кофе');
    await expect(results.getByRole('link')).toHaveCount(2);
    await page.getByTestId('search-filters').click();
    await page.getByTestId('search-goal-talk').click();
    await expect(results.getByRole('link')).toHaveCount(1);
    await expect(page.getByTestId('search-plan-plan5')).toBeVisible();

    await page.getByTestId('search-plan-plan5').click();
    await expect(page.getByTestId('plan-place-hidden')).toBeVisible();
  });

  test('a member narrows by city and format; nothing found reads so', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('tab-search').click();
    await page.getByTestId('search-kind-plans').click();
    await page.getByTestId('search-filters').click();
    await page.getByTestId('search-plan-city-karaganda').click();
    await page.getByTestId('search-format-walk').click();
    const results = page.getByTestId('search-results');
    await expect(results.getByRole('link')).toHaveCount(2);
    await expect(page.getByTestId('search-plan-plan3')).toBeVisible();
    await expect(page.getByTestId('search-plan-plan6')).toBeVisible();

    await page.getByTestId('search-reset').click();
    await expect(results.getByRole('link')).toHaveCount(5);
    await page.getByTestId('search-input').fill('абракадабра');
    await expect(page.getByTestId('search-empty')).toBeVisible();
  });
});
