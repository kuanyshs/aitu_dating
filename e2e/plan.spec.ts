import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina, openDemoPanel, signInAs } from './helpers';

// plan1 is m06's coffee in Almaty; its exact place is «Кофейня на Панфилова».
const place = 'Кофейня на Панфилова';

async function openPlan(page: Page, userId?: string) {
  if (userId) await signInAs(page, userId);
  await page.goto('/plan/plan1');
  await expect(page.getByTestId('plan-summary')).toBeVisible();
}

async function respond(page: Page, userId: string, message?: string) {
  await openPlan(page, userId);
  await page.getByTestId('plan-respond').click();
  if (message) await page.getByTestId('plan-message').fill(message);
  await page.getByTestId('plan-send').click();
  await expect(page.getByTestId('plan-pending')).toBeVisible();
}

test.describe('План встречи', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a guest sees the safe summary and is sent to join', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('feed-tab-plans').click();
    await page.getByTestId('post-p-plan1').getByTestId('plan-card').click();
    await expect(page.getByTestId('plan-place-hidden')).toBeVisible();
    await expect(page.getByTestId('screen-plan')).not.toContainText(place);
    await page.getByTestId('plan-respond').click();
    await expect(page).toHaveURL(/\/access/);
  });

  test('an expired member is offered renewal', async ({ page }) => {
    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await openPlan(page);
    await expect(page.getByTestId('plan-place-hidden')).toBeVisible();
    await page.getByTestId('plan-respond').click();
    await expect(page).toHaveURL(/\/renew/);
  });

  test('a member sees the place, responds, withdraws and responds again', async ({ page }) => {
    await joinAsMadina(page);
    await openPlan(page);
    await expect(page.getByTestId('plan-place')).toHaveText(place);
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-message').fill('Люблю утренний кофе, буду рада компании.');
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();

    await page.getByTestId('plan-withdraw').click();
    await expect(page.getByTestId('plan-respond')).toBeVisible();
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();
  });

  test('the author declines one Отклик and accepts another: a Встреча for both', async ({
    page,
  }) => {
    await respond(page, 'm02', 'Давно хотел в эту кофейню.');
    await respond(page, 'm03');

    await openPlan(page, 'm06');
    await expect(page.getByTestId('plan-waiting')).toHaveText('Ждут ответа: 2');
    await expect(page.getByTestId('plan-response-response-1')).toContainText(
      'Давно хотел в эту кофейню.',
    );
    await page.getByTestId('plan-decline-response-2').click();
    await expect(page.getByTestId('plan-response-status-response-2')).toHaveText('Отклонён');

    await page.getByTestId('plan-accept-response-1').click();
    await expect(page.getByTestId('plan-accept-sheet')).toContainText('Принять отклик?');
    await page.getByTestId('sheet-confirm-accept').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Встреча договорена');
    await expect(page.getByTestId('plan-write')).toBeVisible();

    await openPlan(page, 'm02');
    await expect(page.getByTestId('plan-matched')).toBeVisible();
    await page.getByTestId('plan-write').click();
    await expect(page.getByTestId('screen-chat')).toBeVisible();

    await openPlan(page, 'm03');
    await expect(page.getByTestId('plan-declined')).toHaveText('Автор выбрал другой вариант.');
  });

  test('the author closes the set, then cancels the plan', async ({ page }) => {
    await respond(page, 'm02');
    await openPlan(page, 'm06');
    await page.getByTestId('plan-menu').click();
    await page.getByTestId('sheet-close-plan').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Набор закрыт');
    // Waiting Отклики are still decided after closing.
    await expect(page.getByTestId('plan-accept-response-1')).toBeVisible();

    await openPlan(page, 'm04');
    await expect(page.getByTestId('plan-closed')).toBeVisible();
    await expect(page.getByTestId('plan-respond')).toHaveCount(0);

    await openPlan(page, 'm06');
    await page.getByTestId('plan-menu').click();
    await page.getByTestId('sheet-cancel-plan').click();
    await page.getByTestId('sheet-confirm-cancel').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Отменён');
    await expect(page.getByTestId('plan-response-status-response-1')).toHaveText('Отклонён');

    await openPlan(page, 'm02');
    await expect(page.getByTestId('plan-declined')).toBeVisible();
  });

  test('another member reports the plan or blocks its author', async ({ page }) => {
    await openPlan(page, 'm02');
    await page.getByTestId('plan-menu').click();
    await page.getByTestId('sheet-report').click();
    await expect(page.getByTestId('screen-report')).toContainText('Жалоба на план');
    await page.goBack();

    await openPlan(page);
    await page.getByTestId('plan-menu').click();
    await page.getByTestId('sheet-block').click();
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('screen-plan')).toHaveCount(0);

    await page.goto('/plan/plan1');
    await expect(page.getByTestId('plan-unavailable')).toBeVisible();
  });
});
