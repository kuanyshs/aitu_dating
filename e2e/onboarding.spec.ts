import { expect, test, type Page } from '@playwright/test';

import { chooseAnswer, defaultChoices, fillQuestionnaire } from './helpers';
import { loadSeed } from '../src/repository/mock/seed';

const seed = loadSeed();

/** Madina with a paid membership, up to the profile step. */
async function toProfileStep(page: Page) {
  await page.goto('/access');
  await page.getByTestId('candidate-passport-3').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('rules-accept').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('membership-paid-12').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('payment-pay').click();
  await expect(page.getByTestId('access-profile')).toBeVisible({ timeout: 10_000 });
}

async function fillProfile(page: Page) {
  await page.getByTestId('profile-bio').fill('Люблю книги и долгие прогулки по вечернему городу.');
  await page.getByTestId('profile-style-calm_dialogue').click();
  await page.getByTestId('access-next').click();
  await expect(page.getByTestId('access-questionnaire')).toBeVisible();
}

test.describe('onboarding', () => {
  test('publishing the card turns the guest into a member', async ({ page }, testInfo) => {
    await toProfileStep(page);
    await fillProfile(page);

    // The first page: Пол and возраст from Passport, locked; the Passport city suggested.
    await expect(page.getByTestId('questionnaire-basics-gender')).toHaveText('Женщина');
    await expect(page.getByTestId('questionnaire-basics-age')).toHaveText('29');
    await expect(page.getByTestId('answer-city-chosen-351010000')).toBeVisible();
    await expect(page.getByTestId('questionnaire-next')).toHaveAttribute('aria-disabled', 'true');
    await fillQuestionnaire(
      page,
      {
        ...defaultChoices,
        children: ['live_apart'],
        childrenCount: ['2'],
        interests: ['reading', 'other'],
      },
      5,
    );
    await chooseAnswer(page, 'interests', ['travel', 'other']);
    // «Свой вариант» asks for its text before the card can be created.
    await expect(page.getByTestId('questionnaire-create')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('answer-interestOther-input').fill('Настольные игры');
    await testInfo.attach(`questionnaire-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('questionnaire-create').click();

    // The last step: «Вы участник» with the end of the Membership.
    await expect(page.getByTestId('access-welcome')).toBeVisible();
    await expect(page.getByTestId('access-progress')).toHaveText('Шаг 7 из 7');
    await expect(page.getByTestId('welcome-until')).toContainText('Подписка активна до');
    await page.getByTestId('welcome-feed').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('toast')).toBeVisible();
    await expect(page.getByTestId('author-name').first()).toBeVisible();
    await expect(page.getByTestId('feed-tab-following')).toBeVisible();
    await expect(page.getByTestId('home-join')).toHaveCount(0);
    await expect(page.getByTestId('home-member')).toBeVisible();

    // The member feed replaces the guest one after a refetch; wait for real names.
    await expect
      .poll(async () => {
        const text = await page.locator('body').innerText();
        return seed.members.some((m) => text.includes(m.name));
      })
      .toBe(true);

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Мадина Тулегенова');
    await expect(page.getByTestId('profile-bio-text')).toContainText('Люблю книги');
    await expect(page.getByTestId('profile-membership')).toContainText('Подписка активна до');
    const card = page.getByTestId('profile-card');
    await expect(card.getByTestId('profile-answer-nationality')).toHaveText('Казахи');
    await expect(card.getByTestId('profile-answer-childrenCount')).toHaveText('2');
    await expect(card.getByTestId('profile-answer-interests')).toHaveText(
      'Путешествия и туризм, Настольные игры',
    );
    await testInfo.attach(`profile-member-${testInfo.project.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.reload();
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Мадина Тулегенова');
  });

  test('«Далее» stays off until the profile step is valid', async ({ page }) => {
    await toProfileStep(page);
    const next = page.getByTestId('access-next');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('profile-bio').fill('Коротко о себе');
    await expect(page.getByTestId('profile-bio-counter')).toHaveText('14 / 160');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('profile-style-short_messages').click();
    await expect(next).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('the questionnaire draft survives a reload', async ({ page }) => {
    await toProfileStep(page);
    await fillProfile(page);
    await fillQuestionnaire(page, defaultChoices, 2);
    await expect(page.getByTestId('questionnaire-progress')).toHaveText('Страница 3 из 6');

    await page.reload();
    await expect(page.getByTestId('questionnaire-progress')).toHaveText('Страница 3 из 6');
    // «Нет» children hides «Сколько детей»; having them asks for the number.
    await chooseAnswer(page, 'children', ['no']);
    await expect(page.getByTestId('answer-childrenCount')).toHaveCount(0);
    await chooseAnswer(page, 'children', ['live_together']);
    await expect(page.getByTestId('answer-childrenCount')).toBeVisible();
    await page.getByTestId('questionnaire-previous').click();
    await expect(page.getByTestId('answer-intent-serious_relationship')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByTestId('questionnaire-previous').click();
    await expect(page.getByTestId('answer-nationality-chosen-005')).toBeVisible();

    await page.getByTestId('access-back').click();
    await expect(page.getByTestId('profile-bio')).toHaveValue(
      'Люблю книги и долгие прогулки по вечернему городу.',
    );
  });
});
