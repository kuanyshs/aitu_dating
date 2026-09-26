import { expect, test, type Page } from '@playwright/test';

async function choosePassport(page: Page, candidateId = 'passport-1') {
  await expect(page.getByTestId('access-passport')).toBeVisible();
  await page.getByTestId(`candidate-${candidateId}`).click();
  await page.getByTestId('access-next').click();
}

async function acceptRules(page: Page) {
  await expect(page.getByTestId('access-rules')).toBeVisible();
  await expect(page.getByTestId('access-next')).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('rules-accept').click();
  await page.getByTestId('access-next').click();
}

test.describe('access flow up to membership', () => {
  test('guest joins as Айдана with a paid 3-month membership', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('home-join').click();

    await expect(page.getByTestId('passport-subject').first()).toContainText(
      'aitu-subject-almaty-102',
    );
    await expect(page.getByTestId('access-progress')).toHaveText('Шаг 1 из 6');
    await choosePassport(page);
    await acceptRules(page);

    await expect(page.getByTestId('access-membership')).toBeVisible();
    const radios = page.getByRole('radio');
    await page.getByTestId('membership-paid-1').click();
    await page.getByTestId('membership-paid-3').click();
    await expect(page.getByTestId('membership-paid-3')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('membership-paid-1')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('membership-paid-6')).toHaveAttribute('aria-checked', 'false');
    await expect(radios.and(page.locator('[aria-checked="true"]'))).toHaveCount(1);
    await testInfo.attach(`membership-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('access-next').click();

    await expect(page.getByTestId('access-payment')).toBeVisible();
    await expect(page.getByTestId('payment-summary')).toContainText('4 990');
    await page.getByTestId('payment-pay').click();
    await expect(page.getByTestId('payment-processing')).toBeVisible();
    await expect(page.getByTestId('access-profile')).toBeVisible({ timeout: 10_000 });
  });

  test('free verified skips the payment step', async ({ page }) => {
    await page.goto('/access');
    await choosePassport(page, 'passport-2');
    await acceptRules(page);
    await page.getByTestId('membership-free_verified-12').click();
    await page.getByTestId('access-next').click();
    await expect(page.getByTestId('access-profile')).toBeVisible();
  });

  test('closing mid-flow keeps progress and «Вступить» resumes it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-join').click();
    await choosePassport(page, 'passport-3');
    await expect(page.getByTestId('access-rules')).toBeVisible();
    await page.getByTestId('access-close').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();

    await page.reload();
    await page.getByTestId('home-join').click();
    await expect(page.getByTestId('access-rules')).toBeVisible();
    await page.getByTestId('access-back').click();
    await expect(page.getByTestId('candidate-passport-3')).toHaveAttribute('aria-checked', 'true');
  });

  test('a failed payment shows an error and the retry succeeds', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'one theme is enough for this path');
    await page.goto('/access');
    await choosePassport(page);
    await acceptRules(page);
    await page.getByTestId('membership-paid-1').click();
    await page.getByTestId('access-next').click();
    await expect(page.getByTestId('access-payment')).toBeVisible();

    // Arm a one-off network error from the demo panel, then come back to pay.
    await page.goto('/settings');
    await page.getByTestId('demo-network-error-once').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await page.goto('/access/payment');

    await page.getByTestId('payment-pay').click();
    await expect(page.getByTestId('payment-error')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('payment-retry').click();
    await expect(page.getByTestId('access-profile')).toBeVisible({ timeout: 10_000 });
  });

  test('member-only tabs invite a guest to join', async ({ page }) => {
    await page.goto('/');
    for (const tab of ['create', 'activity', 'profile'] as const) {
      await page.getByTestId(`tab-${tab}`).click();
      await expect(page.getByTestId(`${tab}-access-prompt`)).toBeVisible();
    }
    await page.getByTestId('profile-access-prompt-join').click();
    await expect(page.getByTestId('access-passport')).toBeVisible();
  });

  test('a skipped step redirects to the current one', async ({ page }) => {
    await page.goto('/access/payment');
    await expect(page.getByTestId('access-passport')).toBeVisible();
  });
});
