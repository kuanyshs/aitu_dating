import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina } from './helpers';

// The demo clock starts at 2026-09-26 17:00 in Almaty; Мадина lives in Караганда.

async function fill(page: Page, { date, place, description }: Record<string, string>) {
  await page.getByTestId(`new-plan-date-${date}`).click();
  await page.getByTestId('new-plan-time-18:00').click();
  await page.getByTestId('new-plan-format-walk').click();
  await page.getByTestId('new-plan-place').fill(place!);
  await page.getByTestId('new-plan-description').fill(description!);
}

async function openForm(page: Page) {
  await page.goto('/plan/new');
  await expect(page.getByTestId('new-plan-city-karaganda')).toBeVisible();
}

test.describe('Новый план', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member publishes a plan in a public place; it opens and joins the feed', async ({
    page,
  }) => {
    await joinAsMadina(page);
    await expect(page.getByTestId('home-messages')).toBeVisible();
    await page.getByTestId('tab-create').click();
    await page.getByTestId('compose-type-plan').click();
    await expect(page.getByTestId('new-plan-city-karaganda')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const submit = page.getByTestId('new-plan-submit');
    await expect(submit).toHaveAttribute('aria-disabled', 'true');

    await fill(page, {
      date: '2026-09-28',
      place: 'Центральный парк, у фонтана',
      description: 'Вечерняя прогулка и разговор о книгах.',
    });
    // The public place has to be confirmed.
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('new-plan-public').click();
    await submit.click();

    await expect(page.getByTestId('screen-plan')).toBeVisible();
    await expect(page.getByTestId('plan-place')).toHaveText('Центральный парк, у фонтана');
    await expect(page.getByTestId('plan-responses-empty')).toBeVisible();

    await page.goto('/');
    await page.getByTestId('feed-tab-plans').click();
    await expect(
      page.getByRole('article').filter({ hasText: 'Вечерняя прогулка и разговор о книгах.' }),
    ).toHaveCount(1);
  });

  test('today offers only the times still ahead', async ({ page }) => {
    await joinAsMadina(page);
    await openForm(page);
    await page.getByTestId('new-plan-date-2026-09-26').click();
    await expect(page.getByTestId('new-plan-time-08:00')).toHaveCount(0);
    await expect(page.getByTestId('new-plan-time-22:00')).toBeVisible();
  });

  test('a fourth open plan is refused with an explanation', async ({ page }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    for (const date of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']) {
      await openForm(page);
      await fill(page, { date, place: 'Кофейня у парка', description: `Кофе ${date}` });
      await page.getByTestId('new-plan-public').click();
      await page.getByTestId('new-plan-submit').click();
      if (date === '2026-10-01') break;
      await expect(page.getByTestId('screen-plan')).toBeVisible();
    }
    await expect(page.getByTestId('new-plan-error')).toContainText('не больше трёх');
    await expect(page.getByTestId('screen-plan')).toHaveCount(0);
  });

  test('leaving with changes asks «Отменить изменения?»', async ({ page }) => {
    await joinAsMadina(page);
    await openForm(page);
    await page.getByTestId('new-plan-place').fill('Кофейня');
    await page.getByTestId('new-plan-cancel').click();
    await expect(page.getByTestId('new-plan-sheet')).toContainText('Отменить изменения?');
    await page.getByTestId('new-plan-keep').click();
    await expect(page.getByTestId('new-plan-place')).toHaveValue('Кофейня');

    await page.getByTestId('new-plan-cancel').click();
    await page.getByTestId('new-plan-discard').click();
    await expect(page.getByTestId('screen-new-plan')).toHaveCount(0);
  });

  test('the «Создать» tab leads to the form; a guest is shown the way in', async ({ page }) => {
    await page.goto('/plan/new');
    await expect(page.getByTestId('new-plan-access-prompt')).toBeVisible();

    await joinAsMadina(page);
    await page.goto('/create');
    await page.getByTestId('create-plan').click();
    await expect(page.getByTestId('new-plan-city-karaganda')).toBeVisible();
  });
});
