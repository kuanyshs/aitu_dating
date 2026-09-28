import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina, signInAsSeedAuthor } from './helpers';

async function blockAuthorOf(page: Page, postId: string) {
  await page.goto(`/post/${postId}`);
  await expect(page.getByTestId('reply-composer')).toBeVisible();
  await page.getByTestId('post-menu').click();
  await page.getByTestId('sheet-block').click();
  await page.getByTestId('sheet-confirm-block').click();
  await expect(page.getByTestId('toast')).toContainText('Автор заблокирован');
}

test.describe('Безопасность', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member finds a blocked author there, lifts it and sees them again', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/safety');
    await expect(page.getByTestId('safety-tips')).toContainText('Встречайтесь в людном месте');
    await expect(page.getByTestId('blocked-empty')).toBeVisible();

    await blockAuthorOf(page, 'p02');
    await page.goto('/safety');
    const blocked = page.getByTestId('safety-blocked');
    await expect(blocked.getByTestId('blocked-name')).toHaveCount(1);
    await blocked.getByTestId('blocked-unblock').click();
    await expect(page.getByTestId('blocked-sheet')).toContainText('Разблокировать?');
    await page.getByTestId('blocked-confirm').click();
    await expect(page.getByTestId('toast')).toContainText('Блокировка снята');
    await expect(page.getByTestId('blocked-empty')).toBeVisible();

    await page.goto('/post/p02');
    await expect(page.getByTestId('post-text')).toBeVisible();
  });

  test('a sent report shows up in «Мои жалобы» with its status', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/safety');
    await expect(page.getByTestId('reports-empty')).toBeVisible();
    await page.goto('/report?targetType=post&targetId=p02');
    await page.getByTestId('report-reason-spam').click();
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-sent')).toBeVisible();
    await page.goto('/safety');
    const reports = page.getByTestId('safety-reports');
    await expect(reports).toContainText('Публикация · Спам');
    await expect(reports.getByTestId('report-status')).toHaveText('Отправлена');
  });

  test('a resolved report shows its outcome', async ({ page }) => {
    await signInAsSeedAuthor(page);
    await page.goto('/safety');
    await expect(page.getByTestId('safety-reports').getByTestId('report-status')).toHaveText(
      'Решена · Участник ограничен',
    );
  });

  test('a guest sees tips and support only', async ({ page }) => {
    await page.goto('/safety');
    await expect(page.getByTestId('safety-tips')).toBeVisible();
    await expect(page.getByTestId('safety-support')).toBeVisible();
    await expect(page.getByTestId('safety-blocked')).toHaveCount(0);
    await expect(page.getByTestId('safety-reports')).toHaveCount(0);
    await page.getByTestId('safety-support-button').click();
    await expect(page.getByTestId('toast')).toContainText('Скоро');
  });

  test('a failed load offers «Повторить»', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-network-error-once').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await page.goto('/safety');
    // One of the two lists takes the one-off failure; its retry loads it.
    const retry = page.getByTestId('blocked-retry').or(page.getByTestId('reports-retry'));
    await expect(retry).toBeVisible({ timeout: 10_000 });
    await retry.click();
    await expect(page.getByTestId('blocked-empty')).toBeVisible();
    await expect(page.getByTestId('reports-empty')).toBeVisible();
  });
});
