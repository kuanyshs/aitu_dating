import { expect, test, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

const seed = loadSeed();

/** Madina joins with free verified membership and a published card. */
async function joinAsMadina(page: Page) {
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

async function expectNoMemberNames(page: Page) {
  await expect(page.getByTestId('post-type').first()).toBeVisible();
  const text = await page.locator('body').innerText();
  expect(seed.members.some((m) => text.includes(m.name))).toBe(false);
}

async function openDemoPanel(page: Page) {
  await page.getByTestId('tab-profile').click();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('demo-panel')).toBeVisible();
}

test.describe('logout and login', () => {
  test('«Выйти» keeps the card and «Войти» restores the member mode', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Мадина');
    await page.getByRole('button', { name: 'Выйти в preview' }).click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await expect(page.getByTestId('profile-access-prompt-login')).toBeVisible();
    await testInfo.attach(`profile-logged-out-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByTestId('tab-index').click();
    await expect(page.getByTestId('home-login')).toBeVisible();
    await expect(page.getByTestId('home-join')).toHaveCount(0);
    await expect(page.getByTestId('feed-tab-following')).toHaveCount(0);
    await expectNoMemberNames(page);

    await page.reload();
    await page.getByRole('button', { name: 'Войти в зарегистрированный режим' }).click();
    await expect(page.getByTestId('home-messages')).toBeVisible();
    await expect(page.getByTestId('author-name').first()).toBeVisible();
    await expect(page.getByTestId('access-questionnaire')).toHaveCount(0);

    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Мадина');
    await expect(page.getByTestId('profile-bio-text')).toContainText('Люблю книги');
  });

  test('the Home menu offers «Выйти» only to members', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('home-menu').click();
    await expect(page.getByTestId('menu-about')).toBeVisible();
    await expect(page.getByTestId('menu-logout')).toHaveCount(0);
    await page.getByTestId('menu-close').click();

    await joinAsMadina(page);
    await page.getByTestId('home-menu').click();
    await testInfo.attach(`menu-member-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('menu-logout').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('home-login')).toBeVisible();
    await expectNoMemberNames(page);
  });
});

test.describe('Passport identities in the demo panel', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('switching identity keeps the other identities and reset forgets them', async ({ page }) => {
    await joinAsMadina(page);
    await openDemoPanel(page);
    await expect(page.getByTestId('demo-candidate-passport-3')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('demo-candidate-passport-3')).toContainText('есть карточка');

    await page.getByTestId('demo-candidate-passport-1').click();
    await expect(page.getByTestId('demo-candidate-passport-1')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByTestId('settings-close').click();
    await page.getByTestId('tab-index').click();
    await expect(page.getByTestId('home-join')).toBeVisible();
    await expectNoMemberNames(page);

    await openDemoPanel(page);
    await page.getByTestId('demo-candidate-passport-3').click();
    await page.getByTestId('settings-close').click();
    await page.getByTestId('tab-index').click();
    await page.getByTestId('home-login').click();
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Мадина');

    await page.getByTestId('open-settings').click();
    await page.getByTestId('demo-reset').click();
    await expect(page.getByTestId('demo-candidate-passport-3')).toContainText('без карточки');
    await page.getByTestId('settings-close').click();
    await page.getByTestId('tab-index').click();
    await expect(page.getByTestId('home-join')).toBeVisible();
  });
});
