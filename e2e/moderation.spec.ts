import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina } from './helpers';

async function becomeModerator(page: Page) {
  await page.goto('/settings');
  await page.getByTestId('demo-moderator').click();
  await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
}

async function report(page: Page, postId: string, reason: string) {
  await page.goto(`/report?targetType=post&targetId=${postId}`);
  await page.getByTestId(`report-reason-${reason}`).click();
  await page.getByTestId('report-submit').click();
  await expect(page.getByTestId('report-sent')).toBeVisible();
}

async function decide(page: Page, reportId: string, decision: string) {
  await page.getByTestId(`moderation-${reportId}`).click();
  await page.getByTestId(`moderation-decide-${decision}`).click();
  await expect(page.getByTestId('moderation-sheet')).toContainText(
    'закроет и другие открытые жалобы',
  );
  await page.getByTestId('moderation-confirm').click();
  await expect(page.getByTestId('toast')).toContainText('Решение принято');
}

test.describe('Модерация', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('the queue shows reports by status; opening one takes it into review', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await becomeModerator(page);
    await page.goto('/moderator');
    await expect(page.getByTestId('moderation-tab-created')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('moderation-report5')).toBeVisible();
    await expect(page.getByTestId('moderation-report4')).toContainText(
      'План · Угроза безопасности',
    );
    await testInfo.attach('moderation-queue', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByTestId('moderation-report4').click();
    await expect(page.getByTestId('moderation-sheet')).toContainText('Решение по жалобе');
    await expect(page.getByTestId('moderation-decide-dismissed')).toBeVisible();
    await expect(page.getByTestId('moderation-decide-content_removed')).toBeVisible();
    await expect(page.getByTestId('moderation-decide-member_restricted')).toBeVisible();
    await page.getByTestId('moderation-sheet-cancel').click();
    await expect(page.getByTestId('moderation-report4')).toHaveCount(0);

    await page.getByTestId('moderation-tab-reviewing').click();
    await expect(page.getByTestId('moderation-report4')).toBeVisible();
    await expect(page.getByTestId('moderation-report3')).toBeVisible();

    await page.getByTestId('moderation-tab-resolved').click();
    await expect(page.getByTestId('moderation-report1')).toContainText('Итог: Участник ограничен');
    await expect(
      page.getByTestId('moderation-report1').getByTestId('moderation-restricted'),
    ).toBeVisible();
  });

  test('«Отклонить» moves a report to «Решённые»', async ({ page }) => {
    await joinAsMadina(page);
    await becomeModerator(page);
    await page.goto('/moderator');
    await decide(page, 'report5', 'dismissed');
    await expect(page.getByTestId('moderation-report5')).toHaveCount(0);
    await page.getByTestId('moderation-tab-resolved').click();
    await expect(page.getByTestId('moderation-report5')).toContainText('Итог: Отклонена');
    // Decided reports are no longer opened.
    await page.getByTestId('moderation-report5').click();
    await expect(page.getByTestId('moderation-sheet')).toHaveCount(0);
  });

  test('«Ограничить участника» hides the author for everyone', async ({ page }) => {
    await joinAsMadina(page);
    await becomeModerator(page);
    await page.goto('/moderator');
    await page.getByTestId('moderation-report5').click();
    await page.getByTestId('moderation-sheet-cancel').click();
    await page.getByTestId('moderation-tab-reviewing').click();
    await decide(page, 'report5', 'member_restricted');
    await page.getByTestId('moderation-tab-resolved').click();
    const card = page.getByTestId('moderation-report5');
    await expect(card).toContainText('Итог: Участник ограничен');
    await expect(card.getByTestId('moderation-restricted')).toBeVisible();
    await page.goto('/post/p10');
    await expect(page.getByTestId('post-unavailable')).toBeVisible();
  });

  test('one decision closes every open report on the same post', async ({ page }) => {
    await joinAsMadina(page);
    // Seed report5 is about p10 too.
    await report(page, 'p10', 'spam');
    await becomeModerator(page);
    await page.goto('/moderator');
    const onP10 = page.getByRole('button', { name: 'Открыть жалобу' });
    await expect(onP10).toHaveCount(3);
    await decide(page, 'report5', 'content_removed');
    await expect(page.getByTestId('moderation-report4')).toBeVisible();
    await expect(onP10).toHaveCount(1);
    await page.getByTestId('moderation-tab-resolved').click();
    await expect(
      page.getByTestId('moderation-outcome').filter({ hasText: 'Контент удалён' }),
    ).toHaveCount(2);
  });

  test('end to end: a report, «Удалить контент», and the reporter sees the outcome', async ({
    page,
  }) => {
    await joinAsMadina(page);
    await report(page, 'p02', 'harassment');
    await becomeModerator(page);
    await page.goto('/moderator');
    const card = page
      .getByRole('button', { name: 'Открыть жалобу' })
      .filter({ hasText: 'Публикация · Оскорбления, домогательства' });
    await expect(card).toHaveCount(1);
    await card.click();
    await page.getByTestId('moderation-decide-content_removed').click();
    await page.getByTestId('moderation-confirm').click();
    await expect(page.getByTestId('toast')).toContainText('Решение принято');

    await page.goto('/safety');
    await expect(page.getByTestId('safety-reports').getByTestId('report-status')).toHaveText(
      'Решена · Контент удалён',
    );
    await page.goto('/post/p02');
    await expect(page.getByTestId('post-unavailable')).toBeVisible();
  });
});
