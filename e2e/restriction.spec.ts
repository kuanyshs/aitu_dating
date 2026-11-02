import { expect, test } from '@playwright/test';

import { joinAsMadina, openDemoPanel, signInAs } from './helpers';

const SESSION_KEY = 'aitu.demo.session.v1';

test.describe('Ограничение', () => {
  test('a restricted member sees only the restriction screen until it is lifted', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-restrict').click();

    const restricted = page.getByTestId('screen-restricted');
    await expect(restricted).toBeVisible();
    await expect(restricted).toContainText('Правила клуба');
    await expect(restricted).toContainText('Поддержка');
    await expect(page.getByTestId('screen-home')).toBeHidden();
    await expect(page.getByTestId('tab-index')).toBeHidden();
    await testInfo.attach(`restricted-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // The decision: why and until when (the demo restricts for 7 days).
    await expect(page.getByTestId('restricted-reason')).toHaveText('Причина: Другое');
    await expect(page.getByTestId('restricted-until')).toContainText('Действует до ');

    await page.reload();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();
    // Support is a real request now, not «Скоро».
    await expect(restricted).not.toContainText('Скоро');
    await page.getByTestId('restricted-support-text').fill('Хочу понять причину решения.');
    await page.getByTestId('restricted-support-send').click();
    await expect(page.getByTestId('restricted-support-sent')).toHaveText('Обращение получено');
    await expect(page.getByTestId('restricted-support-mine')).toContainText(
      'Ограничение · Получено',
    );

    await page.getByTestId('screen-restricted').getByTestId('demo-unrestrict').click();
    await expect(page.getByTestId('screen-restricted')).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByTestId('home-member')).toBeVisible();
    await expect(page.getByTestId('author-name').first()).toBeVisible();
  });

  test('one Апелляция; moderation lifts the Ограничение and the member is back', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await joinAsMadina(page);
    await openDemoPanel(page);
    await page.getByTestId('demo-restrict').click();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();

    await page.getByTestId('restricted-appeal-open').click();
    await page.getByTestId('restricted-appeal-text').fill('Я ничего не нарушала, прошу проверить.');
    await page.getByTestId('restricted-appeal-send').click();
    await expect(page.getByTestId('restricted-appeal-status')).toHaveText(
      'Апелляция на рассмотрении',
    );
    // No second one: the button is gone, also after a reload.
    await page.reload();
    await expect(page.getByTestId('restricted-appeal-status')).toBeVisible();
    await expect(page.getByTestId('restricted-appeal-open')).toHaveCount(0);

    // A moderator elsewhere decides.
    const madina = await page.evaluate((k) => localStorage.getItem(k), SESSION_KEY);
    await signInAs(page, 'm05');
    await page.goto('/settings');
    await page.getByTestId('demo-moderator').click();
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/moderator');
    await page.getByTestId('moderation-tab-appeals').click();
    const card = page.getByTestId('appeal-appeal-1');
    await expect(card).toContainText('Я ничего не нарушала');
    await expect(card).toContainText('Другое · 7 дней');
    await card.click();
    await page.getByTestId('appeal-decide-lift').click();
    await expect(page.getByTestId('toast')).toContainText('Решение по апелляции принято');
    await expect(page.getByTestId('appeals-empty')).toBeVisible();

    await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [SESSION_KEY, madina]);
    await page.goto('/');
    await expect(page.getByTestId('screen-restricted')).toHaveCount(0);
    await expect(page.getByTestId('home-member')).toBeVisible();
  });

  test('a restricted guest identity returns to preview', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await page.goto('/settings');
    await expect(page.getByTestId('demo-restrict')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('demo-candidate-passport-2').click();
    await page.getByTestId('demo-restrict').click();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();
    await page.getByTestId('screen-restricted').getByTestId('demo-unrestrict').click();
    await expect(page.getByTestId('screen-restricted')).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByTestId('home-join')).toBeVisible();
  });
});

test.describe('moderator role', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('the moderator modal opens only with the role', async ({ page }) => {
    await page.goto('/moderator');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('screen-moderator')).toHaveCount(0);

    await page.goto('/settings');
    await page.getByTestId('demo-moderator').click();
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/');
    await page.getByTestId('home-menu').click();
    await page.getByTestId('menu-moderator').click();
    await expect(page.getByTestId('screen-moderator')).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('demo-moderator').click();
    await expect(page.getByTestId('demo-moderator')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('demo-moderator')).not.toHaveAttribute('aria-disabled', 'true');
    await page.goto('/moderator');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await page.getByTestId('home-menu').click();
    await expect(page.getByTestId('menu-moderator')).toHaveCount(0);
  });
});
