import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina } from './helpers';

/** From the post screen's «•••» to the report form of that post. */
async function reportPost(page: Page, postId: string) {
  await page.goto(`/post/${postId}`);
  await expect(page.getByTestId('post-text')).toBeVisible();
  await page.getByTestId('post-menu').click();
  await page.getByTestId('sheet-report').click();
  await expect(page.getByTestId('screen-report')).toBeVisible();
}

test.describe('Жалоба', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member reports a post, then may block its author', async ({ page }, testInfo) => {
    await joinAsMadina(page);
    await reportPost(page, 'p02');
    const target = page.getByTestId('report-target');
    await expect(target).toContainText('Жалоба на публикацию');
    await expect(target.getByTestId('author-name')).toBeVisible();
    // Nothing is sent without a reason.
    await expect(page.getByTestId('report-submit')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('report-reason-spam').click();
    await expect(page.getByTestId('report-reason-spam')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('report-details').fill('Зовёт в чужой канал.');
    await expect(page.getByTestId('report-details-counter')).toHaveText('20 / 500');
    await testInfo.attach('report-form', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-sent')).toContainText('Жалоба отправлена');
    await expect(page.getByTestId('report-block')).toHaveText('Заблокировать автора');
    await expect(page.getByTestId('report-block-hint')).toContainText(/^Вы и \S+ перестанете/);
    await testInfo.attach('report-sent', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('report-done').click();
    await expect(page.getByTestId('screen-report')).toHaveCount(0);
    await expect(page.getByTestId('screen-post')).toBeVisible();
  });

  test('«Другое» needs details before it can be sent', async ({ page }) => {
    await joinAsMadina(page);
    await reportPost(page, 'p03');
    await page.getByTestId('report-reason-other').click();
    await expect(page.getByTestId('report-details')).toHaveAttribute(
      'placeholder',
      'Опишите, что случилось.',
    );
    await expect(page.getByTestId('report-submit')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('report-details').fill('   ');
    await expect(page.getByTestId('report-submit')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('report-details').fill('Странная ссылка в тексте.');
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-sent')).toBeVisible();
  });

  test('a second report on the same post says it is already under review', async ({ page }) => {
    await joinAsMadina(page);
    await reportPost(page, 'p04');
    await page.getByTestId('report-reason-harassment').click();
    await page.getByTestId('report-submit').click();
    await page.getByTestId('report-done').click();

    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-report').click();
    await page.getByTestId('report-reason-safety').click();
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-repeat')).toContainText('Вы уже пожаловались');
    await expect(page.getByTestId('report-repeat')).toContainText('на рассмотрении');
  });

  test('a failed send keeps the choice and «Повторить» sends it once', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-network-error-once').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    // Straight to the form: a screen underneath would take the one-off failure first.
    await page.goto('/report?targetType=comment&targetId=c-p01-5');
    await expect(page.getByTestId('report-target')).toContainText('Жалоба на комментарий');
    await page.getByTestId('report-reason-privacy').click();
    await page.getByTestId('report-details').fill('Выложил чужой номер.');
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('report-reason-privacy')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('report-details')).toHaveValue('Выложил чужой номер.');
    await page.getByTestId('report-retry').click();
    await expect(page.getByTestId('report-sent')).toBeVisible();
  });

  test('a comment is reported from its «•••» with its text shown', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p01');
    const comment = page.getByTestId('comment-c-p01-5');
    const text = (await comment.getByTestId('comment-text').first().innerText()).slice(0, 20);
    await comment.getByTestId('comment-menu').click();
    await page.getByTestId('sheet-report').click();
    await expect(page.getByTestId('report-target')).toContainText('Жалоба на комментарий');
    await expect(page.getByTestId('report-target')).toContainText(text);
  });

  test('a guest reports anonymously, with no offer to block', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('post-p02').getByTestId('post-open').click();
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-report').click();
    await expect(page.getByTestId('report-target')).toContainText('Жалоба на публикацию');
    await page.getByTestId('report-reason-spam').click();
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-sent')).toContainText('Модераторы рассмотрят её');
    await expect(page.getByTestId('report-sent')).not.toContainText('Мои жалобы');
    await expect(page.getByTestId('report-block')).toHaveCount(0);
  });
});
