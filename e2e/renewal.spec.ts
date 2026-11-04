import { expect, test, type Page } from '@playwright/test';

import { expectMemberNames, expectNoMemberNames, joinAsMadina, openDemoPanel } from './helpers';

async function expireFromDemoPanel(page: Page) {
  await openDemoPanel(page);
  await page.getByTestId('demo-expire').click();
  await expect(page.getByTestId('demo-restore')).toBeVisible();
  await page.getByTestId('settings-close').click();
}

test.describe('expired membership', () => {
  test('a reaction leads to Продление, and paying makes a member again', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await expireFromDemoPanel(page);

    // Profile: own card stays in full, with the call to renew.
    await expect(page.getByTestId('profile-name')).toHaveText('Мадина Тулегенова');
    await expect(page.getByTestId('profile-membership')).toContainText('истекла');
    await expect(page.getByTestId('profile-renew-banner')).toBeVisible();
    await expect(page.getByTestId('profile-edit-card')).toBeVisible();

    await page.getByTestId('tab-index').click();
    await expect(page.getByTestId('home-renew-banner')).toBeVisible();
    await expect(page.getByTestId('home-member')).toHaveCount(0);
    await expectNoMemberNames(page);
    await testInfo.attach(`home-expired-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByTestId('post-like').first().click();
    await expect(page.getByTestId('renew-choose')).toBeVisible();
    await expect(page.getByTestId('renew-next')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('renew-paid-3').click();
    await page.getByTestId('renew-next').click();
    await expect(page.getByTestId('renew-summary')).toContainText('3 месяца');
    await testInfo.attach(`renew-payment-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('renew-pay').click();

    await expect(page.getByTestId('home-member')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('toast')).toContainText('Подписка продлена');
    await expect(page.getByTestId('access-questionnaire')).toHaveCount(0);
    await expectMemberNames(page);
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-membership')).toContainText('активна до');
  });

  test('member-only tabs offer Продление, not the access flow', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await expireFromDemoPanel(page);
    await page.getByTestId('tab-create').click();
    await page.getByTestId('create-access-prompt-renew').click();
    await expect(page.getByTestId('renew-choose')).toBeVisible();
  });

  test('an active member renews early and the period is added to the end date', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await page.goto('/membership');
    const ends = await page.getByTestId('membership-ends').innerText();
    await page.getByTestId('membership-renew').click();
    await expect(page.getByTestId('renew-choose')).toContainText(ends);
    await page.getByTestId('renew-paid-1').click();
    await page.getByTestId('renew-next').click();
    await page.getByTestId('renew-pay').click();
    await expect(page.getByTestId('toast')).toContainText('Подписка продлена до');
    await page.goto('/membership');
    await expect(page.getByTestId('membership-ends')).not.toHaveText(ends);
    await expect(page.getByTestId('membership-period')).toHaveText('1 месяц');
  });

  test('a failed renewal payment can be retried', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await expireFromDemoPanel(page);

    await page.goto('/settings');
    await page.getByTestId('demo-network-error-once').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await page.goto('/renew');
    await page.getByTestId('renew-paid-1').click();
    await page.getByTestId('renew-next').click();
    await page.getByTestId('renew-pay').click();
    await expect(page.getByTestId('renew-error')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('renew-retry').click();
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('home-member')).toBeVisible();
  });

  test('«Восстановить membership» brings the member mode back', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await expireFromDemoPanel(page);
    await page.getByTestId('open-settings').click();
    await page.getByTestId('demo-restore').click();
    await expect(page.getByTestId('demo-expire')).toBeVisible();
    await page.getByTestId('settings-close').click();
    await expect(page.getByTestId('profile-renew-banner')).toHaveCount(0);
  });
});

test.describe('active member likes', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a like fills the heart and survives a reload', async ({ page }) => {
    await joinAsMadina(page);
    const like = page.getByTestId('post-like').first();
    await expect(like).toHaveAttribute('aria-pressed', 'false');
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    // The heart is optimistic; let the mock backend (300–600 ms) store the like first.
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByTestId('post-like').first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('the access flow is closed to members', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/access/passport');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('access-passport')).toHaveCount(0);
  });
});
