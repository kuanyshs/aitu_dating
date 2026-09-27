import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina, signInAsSeedAuthor } from './helpers';

async function publish(page: Page, text: string) {
  await expect(page.getByTestId('home-messages')).toBeVisible();
  await page.getByTestId('tab-create').click();
  await page.getByTestId('compose-input').fill(text);
  await page.getByTestId('compose-submit').click();
  await expect(page.getByTestId('toast')).toContainText('Опубликовано');
}

test.describe('Мои публикации', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a new member sees an empty section that leads to the editor', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('my-posts-empty')).toContainText('Вы ещё ничего не публиковали');
    await page.getByTestId('my-posts-write').click();
    await expect(page.getByTestId('compose-input')).toBeVisible();
  });

  test('publish → find it in the profile → open → delete → it is gone', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await publish(page, 'Первый пост Мадины');
    await publish(page, 'Второй пост Мадины');

    await page.getByTestId('tab-profile').click();
    const section = page.getByTestId('my-posts');
    const rows = section.getByRole('article');
    await expect(rows).toHaveCount(2);
    // Newest first.
    await expect(rows.nth(0)).toContainText('Второй пост Мадины');
    await expect(rows.nth(1)).toContainText('Первый пост Мадины');
    await section.scrollIntoViewIfNeeded();
    await testInfo.attach('my-posts', { body: await page.screenshot(), contentType: 'image/png' });

    await rows.filter({ hasText: 'Первый пост Мадины' }).getByTestId('post-open').click();
    await expect(page.getByTestId('screen-post')).toBeVisible();
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-delete').click();
    await page.getByTestId('sheet-confirm-delete').click();
    await expect(page.getByTestId('toast')).toBeVisible();

    await expect(page.getByTestId('screen-post')).toHaveCount(0);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Второй пост Мадины');
  });

  test('a seed author sees their posts with their full card', async ({ page }) => {
    await signInAsSeedAuthor(page);
    await page.goto('/profile');
    const rows = page.getByTestId('my-posts').getByRole('article');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().getByTestId('author-name')).toBeVisible();
    await expect(page.getByTestId('my-posts').getByTestId('post-p01')).toBeVisible();
  });

  test('an expired member keeps their posts in full, without an invitation to write', async ({
    page,
  }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/profile');
    await expect(page.getByTestId('my-posts-empty')).toBeVisible();
    await expect(page.getByTestId('my-posts-write')).toHaveCount(0);

    await page.goto('/settings');
    await page.getByTestId('demo-restore').click();
    await expect(page.getByTestId('demo-expire')).toBeVisible();
    await page.goto('/');
    await publish(page, 'Пост до истечения');
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/profile');
    const row = page.getByTestId('my-posts').getByRole('article').first();
    await expect(row).toContainText('Пост до истечения');
    await expect(row.getByTestId('author-name')).toHaveText('Мадина');
  });

  test('ten posts at a time, then «Показать ещё»', async ({ page }) => {
    test.setTimeout(150_000);
    await joinAsMadina(page);
    for (let i = 1; i <= 11; i += 1) await publish(page, `Пост номер ${i}`);
    await page.getByTestId('tab-profile').click();
    const rows = page.getByTestId('my-posts').getByRole('article');
    await expect(rows).toHaveCount(10);
    await expect(rows.first()).toContainText('Пост номер 11');
    await page.getByTestId('my-posts-more').click();
    await expect(rows).toHaveCount(11);
    await expect(rows.last()).toContainText('Пост номер 1');
    await expect(page.getByTestId('my-posts-more')).toHaveCount(0);
  });
});
