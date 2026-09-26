import { expect, test, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

import { joinAsMadina, openDemoPanel } from './helpers';

const seed = loadSeed();
const aliveOnP01 = seed.comments.filter((c) => c.postId === 'p01' && !c.deleted).length;

/** Scrolls the thread list until `testID` is rendered (the list is virtualised and paged). */
async function scrollUntilVisible(page: Page, testID: string) {
  const target = page.getByTestId(testID);
  for (let i = 0; i < 30 && !(await target.isVisible()); i += 1) {
    await page.mouse.move(195, 400);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(150);
  }
  await expect(target).toBeVisible();
}

test.describe('post screen', () => {
  test('a guest reads the post and its threads in the safe view', async ({ page }, testInfo) => {
    await page.goto('/post/p01');
    await expect(page.getByTestId('post-text')).toBeVisible();
    await expect(page.getByTestId('post-replies-count')).toHaveText(`Ответы · ${aliveOnP01}`);
    await expect(page.getByTestId('comments-sort-popular')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('comment-thread').first()).toContainText('Женщина');
    await expect(page.getByTestId('comment-thread').first()).toBeVisible();
    await expect(page.getByTestId('comment-c-p01-5')).toBeVisible();
    await expect(page.getByTestId('author-name')).toHaveCount(0);
    await expect(page.getByTestId('post-join')).toBeVisible();
    await testInfo.attach(`post-guest-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByTestId('comment-like').first().click();
    await expect(page.getByTestId('access-passport')).toBeVisible();
  });

  test('«Новые» reorders, scrolling loads the next page with a deleted comment', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await page.goto('/post/p01');
    await expect(page.getByTestId('comment-c-p01-5')).toBeVisible();
    await page.getByTestId('comments-sort-new').click();
    await expect(page.getByTestId('comment-c-p01-12')).toBeVisible();
    // The two oldest root comments are on the second page.
    await scrollUntilVisible(page, 'comment-c-p01-1');
    await expect(page.getByTestId('comment-deleted')).toHaveText('Комментарий удалён');
  });

  test('a member sees names and the reply composer', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await page.goto('/post/p01');
    await expect(page.getByTestId('author-name').first()).toBeVisible();
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('reply-composer').click();
    await expect(page.getByTestId('toast')).toContainText('Скоро');
  });

  test('an expired member is offered Продление', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/post/p01');
    await expect(page.getByTestId('post-footer-expired')).toBeVisible();
    await page.getByTestId('comment-like').first().click();
    await expect(page.getByTestId('renew-choose')).toBeVisible();
  });

  test('a missing post is «Публикация недоступна»', async ({ page }) => {
    await page.goto('/post/nope');
    await expect(page.getByTestId('post-unavailable')).toContainText('Публикация недоступна');
    await page.getByTestId('post-unavailable-back').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();
  });

  test('a member likes a reply, it persists and lifts it in «Популярные»', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await page.goto('/post/p01');
    const like = page.getByTestId('comment-c-p01-4').getByTestId('comment-like').first();
    await expect(like).toHaveAttribute('aria-pressed', 'false');
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await expect(like).toContainText('1');

    // The heart is optimistic; let the mock backend (300–600 ms) store the like first.
    await page.waitForTimeout(1000);
    await page.reload();
    const liked = page.getByTestId('comment-c-p01-4').getByTestId('comment-like').first();
    await expect(liked).toHaveAttribute('aria-pressed', 'true');
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())?.y ?? Infinity;
    await expect(page.getByTestId('comment-c-p01-12')).toBeVisible();
    expect(await y('comment-c-p01-4')).toBeLessThan(await y('comment-c-p01-12'));
  });

  test('a like on the post screen shows in the feed', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await page.getByTestId('post-open').first().click();
    const like = page.getByTestId('screen-post').getByTestId('post-like');
    await expect(like).toHaveAttribute('aria-pressed', 'false');
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('post-back').click();
    await expect(page.getByTestId('post-like').first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('a like that fails offline is rolled back with a message', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await page.getByTestId('post-open').first().click();
    await expect(page.getByTestId('post-text')).toBeVisible();
    await page.getByTestId('post-back').click();

    await page.getByTestId('home-menu').click();
    await page.getByTestId('menu-settings').click();
    await page.getByTestId('demo-offline').click();
    await page.getByTestId('settings-close').click();

    await page.getByTestId('post-open').first().click();
    const like = page.getByTestId('screen-post').getByTestId('post-like');
    await like.click();
    await expect(page.getByTestId('toast')).toContainText('Не удалось');
    await expect(like).toHaveAttribute('aria-pressed', 'false');
  });

  test('guests and expired members cannot like the post', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await page.goto('/post/p01');
    await page.getByTestId('screen-post').getByTestId('post-like').click();
    await expect(page.getByTestId('access-passport')).toBeVisible();

    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/post/p01');
    await page.getByTestId('screen-post').getByTestId('post-like').click();
    await expect(page.getByTestId('renew-choose')).toBeVisible();
  });
});
