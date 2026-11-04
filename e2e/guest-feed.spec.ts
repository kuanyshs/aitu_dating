import { expect, test } from '@playwright/test';

import { pickSettlement } from './helpers';
import { loadSeed } from '../src/repository/mock/seed';

const seed = loadSeed();

test.describe('guest feed', () => {
  test('shows community posts without revealing anyone', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByTestId('author-safe').first()).toBeVisible();
    await expect(page.getByTestId('author-name')).toHaveCount(0);

    const text = await page.locator('body').innerText();
    for (const member of seed.members) expect(text).not.toContain(member.name);

    await testInfo.attach(`guest-feed-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('join and social actions lead to the access flow', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-join').click();
    await expect(page.getByTestId('access-passport')).toBeVisible();
    await page.getByTestId('access-close').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();

    await page
      .getByRole('article')
      .first()
      .getByRole('button', { name: /Нравится/ })
      .click();
    await expect(page.getByTestId('access-passport')).toBeVisible();
  });

  test('each Лента keeps its own content type: Посты, Планы встреч or both', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('feed-tab-for_you')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('feed-content-all')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('feed-content-plans').click();
    await expect(page.getByTestId('plan-card').first()).toBeVisible();
    const articles = page.getByRole('article');
    const count = await articles.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(articles.nth(i).getByTestId('plan-card')).toBeVisible();
    }

    await page.getByTestId('feed-tab-popular').click();
    await expect(page.getByTestId('feed-content-all')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('feed-content-posts').click();
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByTestId('plan-card')).toHaveCount(0);

    await page.reload();
    await page.getByTestId('feed-tab-for_you').click();
    await expect(page.getByTestId('feed-content-plans')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('feed-tab-popular').click();
    await expect(page.getByTestId('feed-content-posts')).toHaveAttribute('aria-checked', 'true');
  });

  test('«Для тебя» offers search and Фильтры; a guest keeps them on the device', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('post-reasons')).toHaveCount(0);
    await page.getByTestId('home-filters').click();
    await expect(page.getByTestId('feed-filters-guest-note')).toBeVisible();
    await pickSettlement(page, 'feed-filter-city', '790000000', 'Шымкент');
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');
    await expect(page.getByTestId('feed-empty')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');
    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filters-reset').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
    await expect(page.getByRole('article').first()).toBeVisible();

    await page.getByTestId('home-search').click();
    await expect(page).toHaveURL(/\/search/);
  });

  test('«Подписки» asks a guest to join', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('feed-tab-following').click();
    await expect(page.getByTestId('feed-empty')).toBeVisible();
    await page.getByTestId('feed-empty-action').click();
    await expect(page.getByTestId('access-passport')).toBeVisible();
  });
});
