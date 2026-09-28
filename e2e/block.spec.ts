import { expect, test } from '@playwright/test';

import { joinAsMadina } from './helpers';

test.describe('Блокировка', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('blocking a post’s author closes the post and it leaves the feed', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await page.getByTestId('post-p02').getByTestId('post-open').click();
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    const name = await page
      .getByTestId('screen-post')
      .getByTestId('author-name')
      .first()
      .innerText();
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-block').click();
    const sheet = page.getByTestId('post-sheet');
    await expect(sheet).toContainText('Заблокировать автора?');
    await expect(sheet).toContainText(`Вы и ${name} перестанете видеть друг друга`);
    await testInfo.attach('block-confirm', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('toast')).toContainText('Автор заблокирован');
    await expect(page.getByTestId('screen-post')).toHaveCount(0);
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('post-p01')).toBeVisible();
    await expect(page.getByTestId('post-p02')).toHaveCount(0);
    await page.goto('/post/p02');
    await expect(page.getByTestId('post-unavailable')).toBeVisible();
  });

  test('«Отмена» in the confirmation blocks nobody', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-block').click();
    await page.getByTestId('post-sheet-cancel').click();
    await expect(page.getByTestId('post-sheet')).toHaveCount(0);
    await expect(page.getByTestId('post-text')).toBeVisible();
  });

  test('a blocked commenter’s root reads «Комментарий скрыт», others’ replies stay', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await page.goto('/post/p02');
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    // m01 wrote the root c-p02-3 (answered by someone else) and the reply c-p02-2-r1.
    const root = page.getByTestId('comment-c-p02-3');
    await root.scrollIntoViewIfNeeded();
    await root.getByTestId('comment-menu').first().click();
    await page.getByTestId('sheet-block').click();
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('toast')).toContainText('Автор заблокирован');

    // The post is someone else's, so its screen stays.
    await expect(page.getByTestId('screen-post')).toBeVisible();
    await root.scrollIntoViewIfNeeded();
    await expect(root.getByTestId('comment-hidden')).toHaveText('Комментарий скрыт');
    await expect(page.getByTestId('comment-c-p02-3-r1')).toBeVisible();
    await expect(page.getByTestId('comment-c-p02-2-r1')).toHaveCount(0);
    await testInfo.attach('comment-hidden', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('«Заблокировать автора» after a report blocks for real', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('post-p03').getByTestId('post-open').click();
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-report').click();
    await page.getByTestId('report-reason-harassment').click();
    await page.getByTestId('report-submit').click();
    await page.getByTestId('report-block').click();
    await expect(page.getByTestId('toast')).toContainText('Автор заблокирован');
    await expect(page.getByTestId('screen-report')).toHaveCount(0);
    await expect(page.getByTestId('screen-post')).toHaveCount(0);
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('post-p01')).toBeVisible();
    await expect(page.getByTestId('post-p03')).toHaveCount(0);
  });

  test('a guest has no «Заблокировать»', async ({ page }) => {
    await page.goto('/post/p02');
    await page.getByTestId('post-menu').click();
    await expect(page.getByTestId('sheet-report')).toBeVisible();
    await expect(page.getByTestId('sheet-block')).toHaveCount(0);
  });
});
