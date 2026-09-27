import { expect, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

const seed = loadSeed();

/** Madina joins with free verified membership and a published card. */
export async function joinAsMadina(page: Page) {
  await page.goto('/access');
  await page.getByTestId('candidate-passport-3').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('rules-accept').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('membership-free_verified-12').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('profile-bio').fill('Люблю книги и долгие прогулки.');
  await page.getByTestId('interest-books').click();
  await page.getByTestId('profile-style-calm_dialogue').click();
  await page.getByTestId('access-next').click();
  for (const [question, answer] of [
    ['city', 'almaty'],
    ['intent', 'friendship'],
    ['communication', 'topic_comment_first'],
    ['pace', 'gradual'],
    ['firstMeeting', 'coffee_talk'],
    ['boundaries', 'public_place'],
    ['dateFormat', 'walk'],
  ]) {
    await page.getByTestId(`question-${question}-${answer}`).click();
  }
  await page.getByTestId('questionnaire-create').click();
  await expect(page.getByTestId('home-messages')).toBeVisible();
}

export async function expectNoMemberNames(page: Page) {
  await expect(page.getByTestId('post-type').first()).toBeVisible();
  await expect
    .poll(async () => {
      const text = await page.locator('body').innerText();
      return seed.members.some((m) => text.includes(m.name));
    })
    .toBe(false);
}

export async function expectMemberNames(page: Page) {
  await expect
    .poll(async () => {
      const text = await page.locator('body').innerText();
      return seed.members.some((m) => text.includes(m.name));
    })
    .toBe(true);
}

export async function openDemoPanel(page: Page) {
  await page.getByTestId('tab-profile').click();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('demo-panel')).toBeVisible();
}

/**
 * Signs in as a seed author (m01 wrote p01) by writing the stored session before the
 * app starts. The demo member has no posts of their own until the «Создание» spec.
 */
export async function signInAsSeedAuthor(page: Page) {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'aitu.demo.session.v1',
      JSON.stringify({
        version: 1,
        data: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: 'm01' },
      }),
    ),
  );
}
