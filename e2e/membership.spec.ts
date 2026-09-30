import { expect, test } from '@playwright/test';

import { joinAsMadina, openDemoPanel } from './helpers';

test.describe('Membership', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'the screen does not depend on the theme');
  });

  test('a member sees the tier, the dates and what is left', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('home-menu').click();
    await page.getByTestId('menu-membership').click();
    await expect(page.getByTestId('membership-tier')).toHaveText('Бесплатный verified');
    await expect(page.getByTestId('membership-period')).toHaveText('12 месяцев');
    await expect(page.getByTestId('membership-starts')).toHaveText('26 сентября 2026');
    await expect(page.getByTestId('membership-ends')).toContainText('2027');
    await expect(page.getByTestId('membership-status')).toHaveText('Активен');
    await expect(page.getByTestId('membership-left')).toHaveText(/^\d+ (день|дня|дней)$/);

    await page.getByTestId('membership-renew').click();
    await expect(page.getByTestId('renew-choose')).toBeVisible();
  });

  test('a reload does not turn the demo clock back', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/membership');
    // The clock goes on from the join, so a full year is left, not a day more.
    await expect(page.getByTestId('membership-left')).toHaveText('365 дней');
  });

  test('an expired member is offered «Продлить»', async ({ page }) => {
    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/membership');
    await expect(page.getByTestId('membership-status')).toHaveText('Истёк');
    await expect(page.getByTestId('membership-left')).toHaveCount(0);
    await page.getByTestId('membership-renew').click();
    await expect(page.getByTestId('renew-choose')).toBeVisible();
  });

  test('a guest is invited to join', async ({ page }) => {
    await page.goto('/membership');
    await expect(page.getByTestId('membership-access-prompt')).toBeVisible();
    await expect(page.getByTestId('membership-details')).toHaveCount(0);
  });
});
