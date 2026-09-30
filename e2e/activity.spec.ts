import { expect, test } from '@playwright/test';

import { signInAs } from './helpers';

// m01 is followed by m09 and m12 and has comments and likes on p01; plan1 is m06's.

test.describe('Активность', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('new events show a dot until the tab is opened; a row leads to its person', async ({
    page,
  }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await expect(page.getByTestId('tab-activity-dot')).toBeVisible();
    await page.getByTestId('tab-activity').click();

    const rows = page.getByTestId('activity-list').getByRole('link');
    // What was new when the tab opened still says so; the dot on the tab is gone.
    await expect(rows.first().getByLabel('Новое')).toBeVisible();
    await expect(page.getByTestId('tab-activity-dot')).toHaveCount(0);

    await page.getByTestId('activity-category-follows').click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId('activity-follow-m09')).toContainText('Подписка на вас');
    await page.getByTestId('activity-follow-m09').click();
    await expect(page.getByTestId('screen-member')).toBeVisible();

    // Seen now: after a reload nothing is new.
    await page.goto('/activity');
    await expect(rows.first()).toBeVisible();
    await expect(page.getByTestId('activity-list').getByLabel('Новое')).toHaveCount(0);
  });

  test('the author of a plan hears about an Отклик and opens the plan', async ({ page }) => {
    await signInAs(page, 'm02');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();

    await signInAs(page, 'm06');
    await page.goto('/activity');
    await page.getByTestId('activity-category-plans').click();
    await page.getByTestId('activity-response-response-1').click();
    await expect(page.getByTestId('plan-responses')).toBeVisible();
  });

  test('a guest is invited to join; the menu leads to Активность', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-activity').click();
    await expect(page.getByTestId('activity-access-prompt')).toBeVisible();
  });
});
