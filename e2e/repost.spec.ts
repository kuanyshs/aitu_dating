import { expect, test, type Locator, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

import { joinAsMadina, signInAsSeedAuthor } from './helpers';

const seed = loadSeed();
const seedReposts = (id: string) => seed.reposts.filter((r) => r.postId === id).length;

/**
 * The feed stays mounted under the post screen, so its buttons share the same test ids:
 * every lookup on the post screen goes through it.
 */
const postScreen = (page: Page) => page.getByTestId('screen-post');

async function expectRepost(button: Locator, count: number, pressed: boolean) {
  await expect(button).toHaveAttribute('aria-label', `Репосты: ${count}`);
  await expect(button).toHaveAttribute('aria-pressed', String(pressed));
}

test.describe('repost, quote and the «•••» menu', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member reposts someone else’s post in the feed, and undoes it', async ({ page }) => {
    await joinAsMadina(page);
    const card = page.getByTestId('post-p02');
    const repost = card.getByTestId('post-repost');
    await page.goto('/post/p02');
    // The member footer shows the session has loaded; a tap before that is ignored.
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await expectRepost(postScreen(page).getByTestId('post-repost'), seedReposts('p02'), false);
    await postScreen(page).getByTestId('post-repost').click();
    await expectRepost(postScreen(page).getByTestId('post-repost'), seedReposts('p02') + 1, true);

    // The feed shows the same state, also after a restart.
    await page.waitForTimeout(1000);
    await page.goto('/');
    await expect(card).toBeVisible();
    await expectRepost(repost, seedReposts('p02') + 1, true);
    await repost.click();
    await expectRepost(repost, seedReposts('p02'), false);
    await page.waitForTimeout(1000);
    await page.reload();
    await expectRepost(repost, seedReposts('p02'), false);
  });

  test('an own post cannot be reposted', async ({ page }) => {
    await signInAsSeedAuthor(page);
    await page.goto('/post/p01');
    const repost = postScreen(page).getByTestId('post-repost');
    await expect(repost).toHaveAttribute('aria-disabled', 'true');
    await repost.click({ force: true });
    await expectRepost(repost, seedReposts('p01'), false);
  });

  test('«Цитировать» opens Создание with the quoted post', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await postScreen(page).getByTestId('post-quote').click();
    await expect(page.getByTestId('screen-compose')).toBeVisible();
    await expect(page.getByTestId('compose-quoted-p02')).toBeVisible();
  });

  test('a guest is sent to access and may only report', async ({ page }) => {
    await page.goto('/post/p01');
    await postScreen(page).getByTestId('post-quote').click();
    await expect(page.getByTestId('access-passport')).toBeVisible();

    await page.goto('/post/p01');
    await postScreen(page).getByTestId('post-repost').click();
    await expect(page.getByTestId('access-passport')).toBeVisible();

    await page.goto('/post/p01');
    await page.getByTestId('post-menu').click();
    await expect(page.getByTestId('sheet-report')).toBeVisible();
    await expect(page.getByTestId('sheet-block')).toHaveCount(0);
    await page.getByTestId('post-sheet-cancel').click();
    await page.getByTestId('comment-c-p01-5').getByTestId('comment-menu').click();
    await expect(page.getByTestId('sheet-block')).toHaveCount(0);
    await page.getByTestId('sheet-report').click();
    await expect(page).toHaveURL(/\/report\?.*targetType=comment/);
    await expect(page.getByTestId('screen-report')).toBeVisible();
  });

  test('a member blocks the author of someone else’s comment', async ({ page }, testInfo) => {
    await joinAsMadina(page);
    await page.goto('/post/p01');
    await page.getByTestId('comment-c-p01-5').getByTestId('comment-menu').click();
    await expect(page.getByTestId('sheet-report')).toBeVisible();
    await expect(page.getByTestId('sheet-delete')).toHaveCount(0);
    await testInfo.attach('others-comment-menu', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('sheet-block').click();
    await expect(page.getByTestId('screen-safety')).toBeVisible();
  });

  test('an expired member is sent to Продление, yet may block', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/post/p02');
    await postScreen(page).getByTestId('post-repost').click();
    await expect(page.getByTestId('renew-choose')).toBeVisible();

    await page.goto('/post/p02');
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-block').click();
    await expect(page.getByTestId('screen-safety')).toBeVisible();
  });
});
