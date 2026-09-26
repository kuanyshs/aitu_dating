import { expect, test, type Page } from '@playwright/test';

import { palettes } from '../src/ui/theme/palette';

function toRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff})`;
}

async function openSettings(page: Page) {
  await page.getByTestId('tab-profile').click();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('screen-settings')).toBeVisible();
}

async function closeSettings(page: Page) {
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('screen-settings')).toBeHidden();
}

test.describe('settings and demo controls', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'runs from the system light theme');
  });

  test('dark theme choice survives a reload', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await expect(page.getByTestId('theme-system')).toHaveAttribute('aria-checked', 'true');

    await page.getByTestId('theme-dark').click();
    await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('screen-settings')).toHaveCSS(
      'background-color',
      toRgb(palettes.dark.bg),
    );

    await page.reload();
    await expect(page.getByTestId('screen-settings')).toHaveCSS(
      'background-color',
      toRgb(palettes.dark.bg),
    );
    await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');
  });

  test('offline keeps the loaded feed under a banner and recovers', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('article').first()).toBeVisible();
    await openSettings(page);

    await page.getByTestId('demo-offline').click();
    await expect(page.getByTestId('demo-offline')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('offline-banner')).toBeVisible();

    await closeSettings(page);
    await page.getByTestId('tab-index').click();
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByTestId('feed-error')).toHaveCount(0);

    await openSettings(page);
    await page.getByTestId('demo-offline').click();
    await expect(page.getByTestId('offline-banner')).toBeHidden();
  });

  test('a one-off network error shows the feed error, and retry recovers', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('article').first()).toBeVisible();
    await openSettings(page);
    await page.getByTestId('demo-network-error-once').click();
    await expect(page.getByTestId('toast')).toBeVisible();

    await closeSettings(page);
    await page.getByTestId('tab-index').click();
    await expect(page.getByTestId('feed-error')).toBeVisible();
    await page.getByTestId('feed-retry').click();
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByTestId('feed-error')).toHaveCount(0);
  });

  test('reset demo clears demo flags but keeps the theme', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await page.getByTestId('theme-dark').click();
    await page.getByTestId('demo-offline').click();
    await expect(page.getByTestId('offline-banner')).toBeVisible();

    await page.getByTestId('demo-reset').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toBeHidden();
    await expect(page.getByTestId('demo-offline')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');
  });

  test('unreadable stored state is reset with an explanation', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('aitu.demo.state.v1', '{broken'));
    await page.reload();
    await expect(page.getByTestId('toast')).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});
