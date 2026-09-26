import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina } from './helpers';

async function reply(page: Page, text: string) {
  await page.getByTestId('reply-input').fill(text);
  await page.getByTestId('reply-submit').click();
  await expect(page.getByTestId('screen-reply')).toHaveCount(0);
}

async function deleteVia(page: Page, scope: ReturnType<Page['getByTestId']>) {
  await scope.getByTestId('comment-menu').first().click();
  await page.getByTestId('sheet-delete').click();
  await page.getByTestId('sheet-confirm-delete').click();
}

test.describe('deleting own content', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a comment with a reply stays as «Комментарий удалён», then leaves with it', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await page.goto('/post/p03');
    await page.getByTestId('reply-composer').click();
    await reply(page, 'Корневой комментарий');
    const thread = page.getByTestId('comment-thread').first();
    await thread.getByTestId('comment-reply').click();
    await reply(page, 'Ответ под ним');
    await expect(page.getByTestId('post-replies-count')).toHaveText('Ответы · 2');

    // Cancel changes nothing.
    await thread.getByTestId('comment-menu').first().click();
    await page.getByTestId('sheet-delete').click();
    await expect(page.getByTestId('post-sheet')).toContainText('Удалить комментарий?');
    await testInfo.attach('delete-confirm', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('post-sheet-cancel').click();
    await expect(thread).toContainText('Корневой комментарий');

    await deleteVia(page, thread);
    await expect(page.getByTestId('toast')).toContainText('Комментарий удалён');
    await expect(thread.getByTestId('comment-deleted')).toHaveText('Комментарий удалён');
    await expect(thread).toContainText('Ответ под ним');
    await expect(page.getByTestId('post-replies-count')).toHaveText('Ответы · 1');

    await deleteVia(page, thread);
    await expect(page.getByTestId('comments-empty')).toBeVisible();
    await expect(page.getByTestId('post-replies-count')).toHaveText('Ответы · 0');

    await page.reload();
    await expect(page.getByTestId('comments-empty')).toBeVisible();
  });

  test('someone else’s comment and post offer no «Удалить»', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p01');
    await expect(page.getByTestId('comment-c-p01-5')).toBeVisible();
    await expect(page.getByTestId('comment-c-p01-5').getByTestId('comment-menu')).toHaveCount(0);
    await page.getByTestId('post-menu').click();
    await expect(page.getByTestId('sheet-report')).toBeVisible();
    await expect(page.getByTestId('sheet-delete')).toHaveCount(0);
    await page.getByTestId('sheet-report').click();
    await expect(page.getByTestId('screen-report')).toBeVisible();
  });

  test('an expired member still deletes their own comment', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p03');
    await page.getByTestId('reply-composer').click();
    await reply(page, 'Удалю после истечения');
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/post/p03');
    await expect(page.getByTestId('post-footer-expired')).toBeVisible();
    await deleteVia(page, page.getByTestId('comment-thread').first());
    await expect(page.getByTestId('comments-empty')).toBeVisible();
  });
});
