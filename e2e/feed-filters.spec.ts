import { expect, test, type Page } from '@playwright/test';

import { pickSettlement, signInAs } from './helpers';

/** The testIDs of every option the filter screen offers, in order. */
async function filterOptions(page: Page): Promise<string[]> {
  await expect(page.getByTestId('feed-filter-content-all')).toBeVisible();
  return page
    .locator('[data-testid^="feed-filter-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid') ?? ''));
}

test.describe('Ленты и единый фильтр', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('an unverified user finds the three feeds and one filter in both (v4 §30, 1–10)', async ({
    page,
  }) => {
    await page.goto('/');
    // 1–5: «Поиск», «Популярное», «Мои подписки»; the old names are gone.
    await expect(page.getByTestId('feed-tab-for_you')).toHaveText('Поиск');
    await expect(page.getByTestId('feed-tab-popular')).toHaveText('Популярное');
    await expect(page.getByTestId('feed-tab-following')).toHaveText('Мои подписки');
    const tabs = page.getByRole('radiogroup', { name: 'Ленты' });
    await expect(tabs).not.toContainText('Для тебя');
    await expect(tabs.getByText('Подписки', { exact: true })).toHaveCount(0);

    // 6–8: the same filter opens from «Поиск» and «Мои подписки».
    await page.getByTestId('home-filters').click();
    const fromSearch = await filterOptions(page);
    expect(fromSearch).toEqual(
      expect.arrayContaining([
        'feed-filter-content-plans',
        'feed-filter-gender-any',
        'feed-filter-gender-woman',
        'feed-filter-age-from',
        'feed-filter-city-field-open',
        'feed-filter-topics-meetings',
        'feed-filter-format-walk',
        'feed-filter-goal-talk',
        'feed-filter-budget-up_to_3000',
        'feed-filter-payment-each_pays',
        'feed-filter-soon-weekend',
      ]),
    );
    // Without verification «Кого ищу» is Пол, возраст and place: what the safe view shows.
    expect(fromSearch).not.toContain('feed-filter-nationality-any');
    expect(fromSearch).not.toContain('feed-filter-income-over_2m');
    expect(fromSearch).not.toContain('feed-filter-interests-travel');
    await expect(page.getByTestId('feed-filters-partner-note')).toContainText('по полу');
    await expect(page.getByTestId('feed-filters-apply')).toHaveText('Применить');
    await expect(page.getByTestId('feed-filters-reset')).toHaveText('Сбросить');
    await expect(page.getByTestId('feed-filters-cancel')).toHaveText('Отмена');
    await page.getByTestId('feed-filters-cancel').click();

    await page.getByTestId('feed-tab-following').click();
    await page.getByTestId('home-filters').click();
    expect(await filterOptions(page)).toEqual(fromSearch);

    // 9: apply; the choice shows as chips.
    await page.getByTestId('feed-filter-gender-woman').click();
    await expect(page.getByTestId('feed-filter-gender-any')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.getByTestId('feed-filter-soon-weekend').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('screen-feed-filters')).toHaveCount(0);
    await expect(page.getByTestId('feed-chip-gender-woman')).toBeVisible();
    await expect(page.getByTestId('home-filters-count')).toHaveText('2');

    // 10: kept across feeds, a post and a restart; «Популярное» is not filtered.
    await page.getByTestId('feed-tab-popular').click();
    await expect(page.getByTestId('feed-filter-chips')).toHaveCount(0);
    await expect(page.getByTestId('home-filters')).toHaveCount(0);
    await page.getByTestId('feed-tab-for_you').click();
    await expect(page.getByTestId('feed-chip-gender-woman')).toBeVisible();
    await page.getByRole('article').first().click();
    await page.goBack();
    await expect(page.getByTestId('feed-chip-soon-weekend')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('home-filters-count')).toHaveText('2');

    // A chip removes itself; «Сбросить все» removes the rest.
    await page.getByTestId('feed-chip-soon-weekend').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');
    await page.getByTestId('feed-chips-reset').click();
    await expect(page.getByTestId('feed-filter-chips')).toHaveCount(0);
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
  });

  test('«Отмена» keeps the filter as it was; «Сбросить» clears it only once applied', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filter-topics-meetings').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');

    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filter-topics-thoughts').click();
    await page.getByTestId('feed-filters-cancel').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');

    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filters-reset').click();
    await expect(page.getByTestId('feed-filter-topics-meetings')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.getByTestId('feed-filters-close').click();
    await expect(page.getByTestId('home-filters-count')).toHaveText('1');

    await page.getByTestId('home-filters').click();
    await page.getByTestId('feed-filters-reset').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
  });

  test('a member starts with nothing chosen and keeps the filter with the account', async ({
    page,
  }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
    // Why a post is here, at most two reasons, never a percentage.
    await expect(page.getByTestId('post-reasons').first()).toBeVisible();
    await expect(page.getByTestId('screen-home')).not.toContainText('%');

    await page.getByTestId('home-filters').click();
    await expect(page.getByTestId('feed-filters-guest-note')).toHaveCount(0);
    await pickSettlement(page, 'feed-filter-city-field', '710000000', 'Астана');
    await page.getByTestId('feed-filter-content-plans').click();
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('feed-chip-city-710000000')).toBeVisible();
    await expect(page.getByTestId('feed-content-plans')).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await expect(page.getByTestId('feed-chip-city-710000000')).toBeVisible();
    await page.getByTestId('feed-tab-following').click();
    await expect(page.getByTestId('feed-chip-city-710000000')).toBeVisible();
    await expect(page.getByTestId('feed-content-plans')).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByRole('article').first().or(page.getByTestId('feed-empty')),
    ).toBeVisible();
    await expect(page.getByTestId('feed-error')).toHaveCount(0);
  });

  test('«Кого ищу» asks the Анкета’s questions about the person sought', async ({ page }) => {
    await signInAs(page, 'm02');
    await page.goto('/');
    await page.getByTestId('home-filters').click();
    await expect(page.getByTestId('feed-filters-partner-note')).toContainText('Все варианты');
    // Every question of the Анкета, each starting at «Все варианты».
    for (const key of [
      'gender',
      'nationality',
      'city',
      'intent',
      'familyPlans',
      'maritalStatus',
      'children',
      'childrenCount',
      'wantChildren',
      'education',
      'occupation',
      'incomeSource',
      'income',
      'car',
      'housing',
      'livingWith',
      'parents',
      'habits',
      'interests',
    ]) {
      await expect(page.getByTestId(`feed-filter-${key}-any`)).toHaveAttribute(
        'aria-checked',
        'true',
      );
    }
    await page.getByTestId('feed-filter-gender-woman').click();
    await page.getByTestId('feed-filter-age-from').fill('25');
    await page.getByTestId('feed-filter-age-to').fill('30');
    await expect(page.getByTestId('feed-filter-age-any')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('feed-filter-nationality-field-open').click();
    await page.getByTestId('feed-filter-nationality-field-picker-option-005').click();
    await page.getByTestId('feed-filter-nationality-field-picker-option-168').click();
    await page.getByTestId('feed-filter-nationality-field-picker-done').click();
    await page.getByTestId('feed-filter-interests-travel').click();
    await page.getByTestId('feed-filter-habits-smoking_never').click();
    // A one-answer question takes one value; «Все варианты» clears it again.
    await page.getByTestId('feed-filter-car-yes').click();
    await page.getByTestId('feed-filter-car-no').click();
    await expect(page.getByTestId('feed-filter-car-yes')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('feed-filter-car-any').click();
    await expect(page.getByTestId('feed-filter-car-no')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('feed-filters-apply').click();

    await expect(page.getByTestId('feed-chip-age-25-30')).toHaveText('25–30 лет ✕');
    await expect(page.getByTestId('feed-chip-nationality-168')).toBeVisible();
    await expect(page.getByTestId('home-filters-count')).toHaveText('6');
    // Only women of 25 to 30 who travel and never smoke, Kazakh or Korean: Алия and Диана
    // (and Руслан's own fresh post, which leads «Поиск» whatever the filter).
    await expect(async () => {
      const names = await page.getByTestId('author-name').allInnerTexts();
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(['Алия', 'Диана', 'Руслан']).toContain(name.split(' ')[0]);
    }).toPass();
  });

  test('nothing under the filter offers to reset it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-filters').click();
    await pickSettlement(page, 'feed-filter-city-field', '790000000', 'Шымкент');
    await page.getByTestId('feed-filters-apply').click();
    await expect(page.getByTestId('feed-empty')).toContainText('Ничего не нашлось');
    await page.getByTestId('feed-empty-action').click();
    await expect(page.getByTestId('home-filters-count')).toHaveCount(0);
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});
