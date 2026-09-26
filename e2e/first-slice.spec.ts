import { expect, test } from '@playwright/test';

import { expectMemberNames, expectNoMemberNames, openDemoPanel } from './helpers';

const answers = [
  ['city', 'almaty'],
  ['intent', 'dating'],
  ['communication', 'messages_first'],
  ['pace', 'gradual'],
  ['firstMeeting', 'coffee_talk'],
  ['boundaries', 'public_place'],
  ['dateFormat', 'walk'],
] as const;

/** The whole first slice through the UI, as flows A–D and G of the spec package. */
test('guest → paid member → «Выйти» → «Войти» → expiry → renewal', async ({ page }) => {
  test.skip(test.info().project.name !== 'light', 'one end-to-end run is enough');
  test.setTimeout(90_000);

  // Flow A: the guest sees the community without names; social actions lead to joining.
  await page.goto('/');
  await expectNoMemberNames(page);
  await page.getByTestId('post-like').first().click();
  await expect(page.getByTestId('access-passport')).toBeVisible();
  await page.getByTestId('access-close').click();

  // Flow C: Passport, rules, exactly one paid period, mock payment.
  await page.getByTestId('home-join').click();
  await page.getByTestId('candidate-passport-1').click();
  await expect(page.getByTestId('access-passport')).toContainText('Passport subject');
  await page.getByTestId('access-next').click();
  await page.getByTestId('rules-accept').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('membership-paid-3').click();
  for (const other of ['membership-paid-1', 'membership-paid-6', 'membership-free_verified-12']) {
    await expect(page.getByTestId(other)).toHaveAttribute('aria-checked', 'false');
  }
  await page.getByTestId('access-next').click();
  await expect(page.getByTestId('payment-summary')).toContainText('4 990');
  await page.getByTestId('payment-pay').click();

  // Flow B: profile step and the Анкета, last answer published with the card.
  await expect(page.getByTestId('access-profile')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('profile-bio').fill('Люблю разговоры о книгах.');
  await page.getByTestId('interest-books').click();
  await page.getByTestId('profile-style-calm_dialogue').click();
  await page.getByTestId('access-next').click();
  for (const [question, answer] of answers) {
    await page.getByTestId(`question-${question}-${answer}`).click();
  }
  await expect(page.getByTestId('questionnaire-progress')).toHaveText('Вопрос 7 из 7');
  await page.getByTestId('questionnaire-create').click();

  await expect(page.getByTestId('home-messages')).toBeVisible();
  await expect(page.getByTestId('toast')).toBeVisible();
  await expectMemberNames(page);
  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('profile-name')).toHaveText('Айдана');
  await expect(page.getByTestId('profile-membership')).toContainText('активен до');

  // Flow D: «Выйти» to the safe view, «Войти» back without the Анкета.
  await page.getByRole('button', { name: 'Выйти в preview' }).click();
  await expect(page.getByTestId('profile-access-prompt-login')).toBeVisible();
  await page.getByTestId('tab-index').click();
  await expectNoMemberNames(page);
  await page.reload();
  await page.getByRole('button', { name: 'Войти в зарегистрированный режим' }).click();
  await expect(page.getByTestId('home-messages')).toBeVisible();
  await expect(page.getByTestId('access-questionnaire')).toHaveCount(0);
  await expectMemberNames(page);

  // Flow G: expiry from the demo panel; a reaction leads to Продление, payment restores.
  await openDemoPanel(page);
  await page.getByTestId('demo-expire').click();
  await expect(page.getByTestId('demo-restore')).toBeVisible();
  await page.getByTestId('settings-close').click();
  await page.getByTestId('tab-index').click();
  await expectNoMemberNames(page);
  await page.getByTestId('post-like').first().click();
  await page.getByTestId('renew-paid-1').click();
  await page.getByTestId('renew-next').click();
  await page.getByTestId('renew-pay').click();
  await expect(page.getByTestId('home-messages')).toBeVisible({ timeout: 10_000 });
  await expectMemberNames(page);

  // The persisted end state survives a reload.
  await page.reload();
  await page.getByTestId('tab-profile').click();
  await expect(page.getByTestId('profile-name')).toHaveText('Айдана');
  await expect(page.getByTestId('profile-membership')).toContainText('активен до');
});
