import { expect, test, type Page } from '@playwright/test';

import { palettes } from '../src/ui/theme/palette';
import { strings } from '../src/ui/strings';

const tabOrder = ['index', 'search', 'create', 'activity', 'profile'] as const;

function toRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff})`;
}

function trackPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return errors;
}

test('home opens with five tabs in the current theme', async ({ page }, testInfo) => {
  const errors = trackPageErrors(page);
  const scheme = testInfo.project.name === 'dark' ? 'dark' : 'light';

  await page.goto('/');
  const home = page.getByTestId('screen-home');
  await expect(home).toBeVisible();

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(tabOrder.length);
  for (const [index, name] of tabOrder.entries()) {
    await expect(tabs.nth(index)).toHaveAccessibleName(strings.tabs[name]);
  }
  await expect(page.getByTestId('tab-index')).toHaveAttribute('aria-selected', 'true');

  await expect(home).toHaveCSS('background-color', toRgb(palettes[scheme].bg));
  await testInfo.attach(`home-${scheme}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});

test('tab bar navigates between tabs', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-search').click();
  await expect(page.getByTestId('screen-search')).toBeVisible();
  await expect(page.getByTestId('tab-search')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('tab-index')).toHaveAttribute('aria-selected', 'false');
});

test('theme follows a live system scheme change', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'switches from light to dark');
  await page.goto('/');
  const home = page.getByTestId('screen-home');
  await expect(home).toHaveCSS('background-color', toRgb(palettes.light.bg));
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(home).toHaveCSS('background-color', toRgb(palettes.dark.bg));
});
