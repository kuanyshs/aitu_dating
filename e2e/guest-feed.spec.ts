import { expect, test } from '@playwright/test';

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

  test('does not offer the following filter to guests', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('feed-tab-for_you')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('feed-tab-following')).toHaveCount(0);
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

  test('plans filter shows only plan posts', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('feed-tab-plans').click();
    await expect(page.getByTestId('feed-tab-plans')).toHaveAttribute('aria-checked', 'true');
    const cards = page.getByTestId('plan-card');
    await expect(cards.first()).toBeVisible();
    const articles = page.getByRole('article');
    const count = await articles.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(articles.nth(i).getByTestId('plan-card')).toBeVisible();
    }
  });

  test('a city without posts shows the empty state with a way out', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('feed-tab-city').click();
    await page.getByTestId('feed-city-shymkent').click();
    await expect(page.getByTestId('feed-empty')).toBeVisible();
    await page.getByTestId('feed-empty-action').click();
    await expect(page.getByTestId('feed-tab-for_you')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});
