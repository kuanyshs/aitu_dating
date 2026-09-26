import { expect, test, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

const seed = loadSeed();

const answers = {
  city: 'karaganda',
  intent: 'friendship',
  communication: 'topic_comment_first',
  pace: 'gradual',
  firstMeeting: 'coffee_talk',
  boundaries: 'public_place',
  dateFormat: 'walk',
} as const;

/** Madina with free verified membership, up to the profile step. */
async function toProfileStep(page: Page) {
  await page.goto('/access');
  await page.getByTestId('candidate-passport-3').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('rules-accept').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('membership-free_verified-12').click();
  await page.getByTestId('access-next').click();
  await expect(page.getByTestId('access-profile')).toBeVisible();
}

async function fillProfile(page: Page) {
  await page.getByTestId('profile-bio').fill('Люблю книги и долгие прогулки по вечернему городу.');
  await page.getByTestId('interest-books').click();
  await page.getByTestId('interest-walks').click();
  await page.getByTestId('profile-style-calm_dialogue').click();
  await page.getByTestId('access-next').click();
  await expect(page.getByTestId('access-questionnaire')).toBeVisible();
}

async function answer(page: Page, question: keyof typeof answers) {
  await page.getByTestId(`question-${question}-${answers[question]}`).click();
}

test.describe('onboarding', () => {
  test('publishing the card turns the guest into a member', async ({ page }, testInfo) => {
    await toProfileStep(page);
    await fillProfile(page);

    const keys = Object.keys(answers) as (keyof typeof answers)[];
    for (const [i, question] of keys.entries()) {
      await expect(page.getByTestId('questionnaire-progress')).toHaveText(`Вопрос ${i + 1} из 7`);
      await answer(page, question);
    }
    await testInfo.attach(`questionnaire-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('questionnaire-create').click();

    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('toast')).toBeVisible();
    await expect(page.getByTestId('author-name').first()).toBeVisible();
    await expect(page.getByTestId('feed-tab-following')).toBeVisible();
    await expect(page.getByTestId('home-join')).toHaveCount(0);
    await expect(page.getByTestId('home-messages')).toBeVisible();

    const text = await page.locator('body').innerText();
    expect(seed.members.some((m) => text.includes(m.name))).toBe(true);

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Мадина');
    await expect(page.getByTestId('profile-bio-text')).toContainText('Люблю книги');
    await expect(page.getByTestId('profile-membership')).toContainText('Бесплатный verified');
    await expect(page.getByTestId('profile-card')).toContainText('Дружба');
    await testInfo.attach(`profile-member-${testInfo.project.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    await page.reload();
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Мадина');
  });

  test('«Далее» stays off until the profile step is valid', async ({ page }) => {
    await toProfileStep(page);
    const next = page.getByTestId('access-next');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('profile-bio').fill('Коротко о себе');
    await expect(page.getByTestId('profile-bio-counter')).toHaveText('14 / 160');
    await page.getByTestId('interest-coffee').click();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('profile-style-short_messages').click();
    await expect(next).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('at most five interests can be chosen', async ({ page }) => {
    test.skip(test.info().project.name !== 'light', 'layout-independent rule');
    await toProfileStep(page);
    for (const key of ['coffee', 'cinema', 'books', 'sport', 'walks']) {
      await page.getByTestId(`interest-${key}`).click();
    }
    await expect(page.getByTestId('interest-music')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('profile-interests-hint')).toContainText('до 5');
  });

  test('the questionnaire draft survives a reload', async ({ page }) => {
    await toProfileStep(page);
    await fillProfile(page);
    await answer(page, 'city');
    await answer(page, 'intent');
    await expect(page.getByTestId('questionnaire-progress')).toHaveText('Вопрос 3 из 7');

    await page.reload();
    await expect(page.getByTestId('questionnaire-progress')).toHaveText('Вопрос 3 из 7');
    await page.getByTestId('questionnaire-previous').click();
    await expect(page.getByTestId(`question-intent-${answers.intent}`)).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.getByTestId('access-back').click();
    await expect(page.getByTestId('profile-bio')).toHaveValue(
      'Люблю книги и долгие прогулки по вечернему городу.',
    );
  });
});
