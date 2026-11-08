import { expect, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

const seed = loadSeed();

/** Answers by question, as chips pick them; the first page keeps the Passport city. */
export type QuestionnaireChoice = Record<string, string[]>;

export const defaultChoices: QuestionnaireChoice = {
  nationality: ['005'],
  intent: ['serious_relationship'],
  familyPlans: ['within_5_years'],
  maritalStatus: ['never_married'],
  children: ['no'],
  wantChildren: ['later'],
  education: ['bachelor'],
  occupation: ['employed'],
  incomeSource: ['salary'],
  income: ['250k_400k'],
  car: ['no'],
  housing: ['rent'],
  livingWith: ['alone'],
  parents: ['discussable'],
  habits: ['smoking_never'],
  interests: ['reading', 'travel'],
};

/** Chooses one question's answers on the current page. */
export async function chooseAnswer(page: Page, question: string, values: string[]) {
  if (question === 'nationality') {
    await page.getByTestId('answer-nationality-open').click();
    await page.getByTestId(`answer-nationality-picker-option-${values[0]}`).click();
    return;
  }
  for (const value of values) await page.getByTestId(`answer-${question}-${value}`).click();
}

const PAGES = [
  ['nationality'],
  ['intent', 'familyPlans', 'maritalStatus'],
  ['children', 'childrenCount', 'wantChildren'],
  ['education', 'occupation', 'incomeSource', 'income'],
  ['car', 'housing', 'livingWith', 'parents'],
  ['habits', 'interests'],
];

/**
 * Fills the six pages of the Анкета with «Далее» between them; the last page waits for
 * «Создать карточку». `pages` limits how many pages are filled.
 */
export async function fillQuestionnaire(
  page: Page,
  choices: QuestionnaireChoice = defaultChoices,
  pages = PAGES.length,
) {
  for (const [i, questions] of PAGES.slice(0, pages).entries()) {
    await expect(page.getByTestId('questionnaire-progress')).toHaveText(
      `Страница ${i + 1} из ${PAGES.length}`,
    );
    for (const question of questions) {
      const values = choices[question];
      if (values) await chooseAnswer(page, question, values);
    }
    if (i < PAGES.length - 1) await page.getByTestId('questionnaire-next').click();
  }
}

/** Picks a Населённый пункт in a settlements field by searching its name. */
export async function pickSettlement(page: Page, field: string, code: string, name: string) {
  await page.getByTestId(`${field}-open`).click();
  await page.getByTestId(`${field}-picker-search`).fill(name);
  await page.getByTestId(`${field}-picker-option-${code}`).click();
  await page.getByTestId(`${field}-picker-done`).click();
  await expect(page.getByTestId(`${field}-chosen-${code}`)).toBeVisible();
}

/** Madina joins with a paid 12-month membership and a published card. */
export async function joinAsMadina(page: Page) {
  await page.goto('/access');
  await page.getByTestId('candidate-passport-3').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('rules-accept').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('membership-paid-12').click();
  await page.getByTestId('access-next').click();
  await page.getByTestId('payment-pay').click();
  await expect(page.getByTestId('access-profile')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('profile-bio').fill('Люблю книги и долгие прогулки.');
  await page.getByTestId('profile-style-calm_dialogue').click();
  await page.getByTestId('access-next').click();
  await fillQuestionnaire(page);
  await page.getByTestId('questionnaire-create').click();
  await expect(page.getByTestId('access-welcome')).toBeVisible();
  await page.getByTestId('welcome-feed').click();
  await expect(page.getByTestId('home-member')).toBeVisible();
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
  await signInAs(page, 'm01');
}

/**
 * Makes a seed member the current session. The demo state stays, so several people can
 * take turns on the same plan; the app reloads on the next `goto`.
 */
export async function signInAs(page: Page, userId: string) {
  if (page.url() === 'about:blank') await page.goto('/');
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'aitu.demo.session.v1',
        JSON.stringify({
          version: 1,
          data: { accessState: 'ACTIVE_MEMBER', roles: ['member'], userId: id },
        }),
      ),
    userId,
  );
}

/**
 * The article shown at the top of Home. The feed list recycles its cells, so after a
 * refresh the DOM order no longer matches the order on screen: compare positions.
 */
export async function topFeedArticle(page: Page) {
  const articles = page.getByTestId('screen-home').getByRole('article');
  await expect(articles.first()).toBeVisible();
  const boxes = await articles.evaluateAll((nodes) =>
    nodes.map((node) => ({
      top: node.getBoundingClientRect().top,
      text: (node as HTMLElement).innerText,
      id: node.getAttribute('data-testid'),
    })),
  );
  return boxes.sort((a, b) => a.top - b.top)[0];
}

/**
 * Switches Home to a Лента. A tap made while Home is still settling after a flow can be
 * lost, so it is repeated until the chip reads as chosen.
 */
export async function showFeed(page: Page, tab: 'for_you' | 'popular' | 'following') {
  const chip = page.getByTestId(`feed-tab-${tab}`);
  await expect(async () => {
    await chip.click();
    await expect(chip).toHaveAttribute('aria-checked', 'true', { timeout: 1000 });
  }).toPass();
}

/** Picks small PNG files from `e2e/fixtures` in the file chooser opened by `trigger`. */
export async function choosePhotos(
  page: Page,
  trigger: () => Promise<void>,
  names: ('red' | 'blue' | 'green' | 'ai')[],
) {
  const chooser = page.waitForEvent('filechooser');
  await trigger();
  await (await chooser).setFiles(names.map((name) => `e2e/fixtures/${name}.png`));
}

/** «＋» in the tab bar, then one of its two choices. */
export async function openCreate(page: Page, what: 'post' | 'plan' = 'post') {
  await page.getByTestId('tab-create').click();
  await page.getByTestId(`create-${what}`).click();
}
