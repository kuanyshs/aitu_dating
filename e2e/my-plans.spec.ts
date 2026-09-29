import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina, signInAs } from './helpers';

// plan1 is m06's; plan4 (m09) is already a Встреча in the seed.

async function openProfile(page: Page, userId: string) {
  await signInAs(page, userId);
  await page.goto('/profile');
  await expect(page.getByTestId('my-plans')).toBeVisible();
}

test.describe('Мои планы и отклики', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a new member sees empty lists and the way to create a plan', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/profile');
    await expect(page.getByTestId('my-plans-empty')).toBeVisible();
    await page.getByTestId('my-plans-tab-responses').click();
    await expect(page.getByTestId('my-responses-empty')).toBeVisible();
    await page.getByTestId('my-plans-tab-plans').click();
    await page.getByTestId('my-plans-create').click();
    await expect(page.getByTestId('screen-new-plan')).toBeVisible();
  });

  test('the author and the sender follow an Отклик from the profile and the feed', async ({
    page,
  }) => {
    await signInAs(page, 'm02');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();

    await openProfile(page, 'm02');
    await page.getByTestId('my-plans-tab-responses').click();
    await expect(page.getByTestId('my-plan-status-plan1')).toHaveText('Отклик ждёт ответа');

    // The author sees the waiting count in the profile and on the feed card.
    await openProfile(page, 'm06');
    await expect(page.getByTestId('my-plan-status-plan1')).toHaveText('Ждут ответа: 1');
    await page.goto('/');
    await page.getByTestId('feed-tab-plans').click();
    await expect(page.getByTestId('post-p-plan1').getByTestId('plan-card-waiting')).toHaveText(
      'Ждут ответа: 1',
    );

    await page.goto('/plan/plan1');
    await page.getByTestId('plan-accept-response-1').click();
    await page.getByTestId('sheet-confirm-accept').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Встреча договорена');

    await openProfile(page, 'm02');
    await page.getByTestId('my-plans-tab-responses').click();
    await expect(page.getByTestId('my-plan-status-plan1')).toHaveText('Встреча договорена');
    await page.getByTestId('my-plan-plan1').click();
    await expect(page.getByTestId('plan-matched')).toBeVisible();

    // Everyone else reads the label on the feed card; nobody else sees the count.
    await signInAs(page, 'm04');
    await page.goto('/');
    await page.getByTestId('feed-tab-plans').click();
    const card = page.getByTestId('post-p-plan1');
    await expect(card.getByTestId('plan-card-status')).toHaveText('Встреча договорена');
    await expect(card.getByTestId('plan-card-waiting')).toHaveCount(0);
  });
});
