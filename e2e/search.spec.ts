import { expect, test, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

import { joinAsMadina } from './helpers';

const seed = loadSeed();
const m01 = seed.members.find((m) => m.id === 'm01')!;
const p01 = seed.posts.find((p) => p.id === 'p01')!;

async function openSearch(page: Page) {
  await page.getByTestId('tab-search').click();
  await expect(page.getByTestId('screen-search')).toBeVisible();
}

test.describe('Поиск', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member finds people: nearby first, then by name, and opens a profile', async ({
    page,
  }) => {
    await joinAsMadina(page);
    await openSearch(page);
    await expect(page.getByTestId('search-kind-people')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('search-nearby')).toBeVisible();
    await expect(page.getByTestId('search-results').getByRole('link').first()).toBeVisible();

    await page.getByTestId('search-input').fill(m01.name.slice(0, 3).toLowerCase());
    await expect(page.getByTestId('search-nearby')).toHaveCount(0);
    await page.getByTestId(`search-person-m01`).click();
    await expect(page.getByTestId('member-name')).toHaveText(m01.name);
  });

  test('interest filters narrow people down, and «Сбросить» clears them', async ({ page }) => {
    await joinAsMadina(page);
    await openSearch(page);
    await page.getByTestId('search-filters').click();
    await page.getByTestId('search-interest-coffee').click();
    await expect(page.getByTestId('search-filters')).toHaveText('Фильтры · 1');
    const rows = page.getByTestId('search-results').getByRole('link');
    await expect(rows.first()).toBeVisible();
    const withCoffee = seed.members.filter(
      (m) => m.card.interests.includes('coffee') && !m.restricted,
    ).length;
    await expect(rows).toHaveCount(withCoffee);
    for (const row of await rows.all()) await expect(row).toContainText('кофе');

    await page.getByTestId('search-reset').click();
    await expect(page.getByTestId('search-filters')).toHaveText('Фильтры');
  });

  test('posts are found by a word and by a Тема', async ({ page }, testInfo) => {
    await joinAsMadina(page);
    await openSearch(page);
    await page.getByTestId('search-kind-posts').click();
    await expect(page.getByTestId('search-hint')).toBeVisible();
    await page.getByTestId('search-input').fill('к');
    await expect(page.getByTestId('search-hint')).toBeVisible();

    const word = p01.text.split(' ').find((w) => w.length > 6)!;
    await page.getByTestId('search-input').fill(word);
    await expect(page.getByTestId('search-results').getByTestId('post-p01')).toBeVisible();

    await page.getByTestId('search-clear').click();
    await page.getByTestId('search-topic-meetings').click();
    const posts = page.getByTestId('search-results').getByRole('article');
    await expect(posts.first()).toBeVisible();
    for (const post of (await posts.all()).slice(0, 5))
      await expect(post).toContainText('#встречи');
    await testInfo.attach('search-posts', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByTestId('search-input').fill('абракадабра');
    await expect(page.getByTestId('search-empty')).toContainText('Ничего не нашлось');
  });

  test('a failed search offers «Повторить»', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-network-error-once').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await page.goto('/search');
    await page.getByTestId('search-kind-posts').click();
    await page.getByTestId('search-topic-city').click();
    await expect(page.getByTestId('search-error')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('search-retry').click();
    await expect(page.getByTestId('search-results')).toBeVisible();
  });

  test('a guest searches posts and is invited to join for people', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByTestId('search-kind-posts')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('search-topic-meetings').click();
    const first = page.getByTestId('search-results').getByRole('article').first();
    await expect(first).toBeVisible();
    await expect(first.getByTestId('author-name')).toHaveCount(0);
    await page.getByTestId('search-kind-people').click();
    await expect(page.getByTestId('search-access-prompt')).toBeVisible();
  });

  test('an expired member is offered Продление for people', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/search');
    await page.getByTestId('search-kind-people').click();
    await expect(page.getByTestId('search-people-locked')).toBeVisible();
  });
});
