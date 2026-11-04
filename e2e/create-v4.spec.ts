import { expect, test, type Page } from '@playwright/test';

import { choosePhotos, joinAsMadina, openCreate, signInAs } from './helpers';

// The demo clock starts at 2026-09-26 17:00 in Almaty; Мадина lives in Караганда.

async function publishMeeting(page: Page, description: string, photo?: 'ai' | 'red') {
  await openCreate(page, 'plan');
  await expect(page.getByTestId('new-plan-city-chosen-351010000')).toBeVisible();
  await page.getByTestId('new-plan-date-2026-09-28').click();
  await page.getByTestId('new-plan-time-18:00').click();
  await page.getByTestId('new-plan-format-coffee').click();
  await page.getByTestId('new-plan-budget-up_to_3000').click();
  await page.getByTestId('new-plan-place-area').fill('Центр');
  await page.getByTestId('new-plan-place').fill('Кофейня на углу');
  await page.getByTestId('new-plan-description').fill(description);
  if (photo) {
    await choosePhotos(page, () => page.getByTestId('new-plan-photos-add').click(), [photo]);
    // One Фото per Встреча: there is no room for a second.
    await expect(page.getByTestId('new-plan-photos-slot-0')).toBeVisible();
    await expect(page.getByTestId('new-plan-photos-slot-1')).toHaveCount(0);
    await expect(page.getByTestId('new-plan-photos-add')).toHaveCount(0);
  }
  await page.getByTestId('new-plan-public').click();
  await page.getByTestId('new-plan-submit').click();
  await expect(page.getByTestId('screen-plan')).toBeVisible();
}

test.describe('Создание и удаление (v4)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a Встреча takes one Фото and reads «Сгенерировано с ИИ» under a generated one (48–55)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await expect(page.getByTestId('home-member')).toBeVisible();
    await publishMeeting(page, 'Кофе и разговор о кино.', 'ai');
    await expect(page.getByTestId('plan-photo')).toBeVisible();
    await expect(page.getByTestId('plan-photo-0-ai')).toHaveText('Сгенерировано с ИИ');
    await expect(page.getByTestId('plan-place')).toHaveText('Кофейня на углу');
  });

  test('the author deletes a post from it, with the v4 confirmation (46–47, 82–83)', async ({
    page,
  }) => {
    await signInAs(page, 'm01');
    await page.goto('/post/p13');
    await expect(page.getByTestId('screen-post')).toBeVisible();
    await page.getByTestId('post-menu').click();
    await page.getByTestId('sheet-delete').click();
    await expect(page.getByTestId('post-sheet')).toContainText('Удалить этот пост?');
    await expect(page.getByTestId('post-sheet')).toContainText('Он исчезнет из ленты и профиля.');
    await page.getByTestId('sheet-confirm-delete').click();
    await expect(page.getByTestId('toast')).toContainText('Публикация удалена');

    await page.goto('/post/p13');
    await expect(page.getByText('Публикация недоступна')).toBeVisible();
    await page.goto('/my-posts');
    await expect(page.getByTestId('post-p13')).toHaveCount(0);
  });

  test('the author deletes a Встреча: «Удалена», requests answered, old link unavailable (84–87)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // m02 asks for plan1, then its author m06 deletes it.
    await signInAs(page, 'm02');
    await page.goto('/meeting/plan1');
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();

    await signInAs(page, 'm06');
    await page.goto('/meeting/plan1');
    await page.getByTestId('plan-menu').click();
    await page.getByTestId('sheet-delete-plan').click();
    const sheet = page.getByTestId('plan-sheet');
    await expect(sheet).toContainText('Удалить эту встречу?');
    await expect(sheet).toContainText(
      'Она исчезнет из поиска, а все ожидающие запросы будут отменены.',
    );
    await page.getByTestId('sheet-confirm-delete').click();
    await expect(page.getByTestId('toast')).toContainText('Встреча удалена');

    await page.goto('/my-plans');
    await expect(page.getByTestId('my-plan-plan1-status')).toHaveText('Удалена');
    await page.goto('/meeting/plan1');
    await expect(page.getByTestId('plan-unavailable')).toContainText('Публикация недоступна');

    await signInAs(page, 'm02');
    await page.goto('/my-plans');
    await page.getByTestId('my-plans-tab-responses').click();
    await expect(page.getByTestId('my-plan-plan1-status')).toHaveText('Удалена');
    await page.goto('/');
    await page.getByTestId('feed-content-plans').click();
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByTestId('post-p-plan1')).toHaveCount(0);
  });

  test('profiles switch between «Все», «Посты» and «Встречи»', async ({ page }) => {
    await signInAs(page, 'm02');
    await page.goto('/member/m06');
    const list = page.getByTestId('member-posts');
    await expect(list.getByRole('article').first()).toBeVisible();
    await page.getByTestId('member-posts-content-plans').click();
    await expect(list.getByTestId('plan-card').first()).toBeVisible();
    const plans = await list.getByRole('article').count();
    expect(await list.getByTestId('plan-card').count()).toBe(plans);
    await page.getByTestId('member-posts-content-posts').click();
    await expect(list.getByRole('article').first()).toBeVisible();
    await expect(list.getByTestId('plan-card')).toHaveCount(0);

    await page.goto('/my-posts');
    await expect(page.getByTestId('my-posts-content-all')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('my-posts-content-plans').click();
    await expect(page.getByTestId('my-posts-content-plans')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
