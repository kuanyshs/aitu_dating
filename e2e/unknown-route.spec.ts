import { expect, test } from '@playwright/test';

test('an unknown address, like a saved file’s path, leads to Home', async ({ page }) => {
  await page.goto('/Users/someone/Documents/Aitu%20Dating.html');
  await expect(page.getByTestId('screen-home')).toBeVisible();
  await expect(page.getByText('Unmatched Route')).toHaveCount(0);
});
