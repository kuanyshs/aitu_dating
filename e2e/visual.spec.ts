import { expect, test, type Page } from '@playwright/test';

import { expectMemberNames, expectNoMemberNames } from './helpers';

/**
 * Visual baselines of the first slice in both themes (390×844). They are rendered and
 * compared in CI inside the Playwright image; see README → «Визуальные эталоны».
 */

const answers = [
  ['city', 'almaty'],
  ['intent', 'dating'],
  ['communication', 'messages_first'],
  ['pace', 'gradual'],
  ['firstMeeting', 'coffee_talk'],
  ['boundaries', 'public_place'],
  ['dateFormat', 'walk'],
] as const;

async function snap(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`);
}

test.describe('visual baselines @visual', () => {
  test('guest screens', async ({ page }) => {
    await page.goto('/');
    await expectNoMemberNames(page);
    await snap(page, 'home-guest');

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-access-prompt-join')).toBeVisible();
    await snap(page, 'profile-guest');
  });

  test('joining, member mode and the way back', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/access');
    await expect(page.getByTestId('candidate-passport-1')).toBeVisible();
    await snap(page, 'passport-step');

    await page.getByTestId('candidate-passport-1').click();
    await page.getByTestId('access-next').click();
    await page.getByTestId('rules-accept').click();
    await page.getByTestId('access-next').click();
    await page.getByTestId('membership-paid-3').click();
    await snap(page, 'membership-step');

    await page.getByTestId('access-next').click();
    await page.getByTestId('payment-pay').click();
    await expect(page.getByTestId('access-profile')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('profile-bio').fill('Люблю разговоры о книгах.');
    await page.getByTestId('interest-books').click();
    await page.getByTestId('profile-style-calm_dialogue').click();
    await page.getByTestId('access-next').click();
    for (const [question, answer] of answers) {
      await page.getByTestId(`question-${question}-${answer}`).click();
    }
    await expect(page.getByTestId('questionnaire-create')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await snap(page, 'questionnaire-7of7');

    await page.getByTestId('questionnaire-create').click();
    await expect(page.getByTestId('home-messages')).toBeVisible();
    await expectMemberNames(page);
    await snap(page, 'home-member');

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Айдана');
    await snap(page, 'profile-member');

    await page.getByRole('button', { name: 'Выйти в preview' }).click();
    await expect(page.getByTestId('profile-access-prompt-login')).toBeVisible();
    await snap(page, 'profile-guest-with-card');
  });

  test('restriction screen', async ({ page }) => {
    await page.goto('/settings');
    await page.getByTestId('demo-candidate-passport-2').click();
    await expect(page.getByTestId('demo-restrict')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('demo-restrict').click();
    await expect(page.getByTestId('screen-restricted')).toBeVisible();
    await snap(page, 'restricted');
  });
});
