import { expect, test } from '@playwright/test';

import { signInAs } from './helpers';

test.describe('Разделы профиля', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('each section of the own profile opens its screen', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/profile');
    const sections = page.getByTestId('profile-sections');
    await expect(sections.getByRole('link')).toHaveText([
      'Редактировать анкету',
      /^Мои публикации/,
      'Мои встречи',
      'Мои запросы',
      /^Подписчики/,
      /^Подписки/,
      'Мои действия',
      'Уведомления',
      /^Сообщения/,
      'Настройки',
    ]);

    const opens: [string, string][] = [
      ['profile-section-posts', 'screen-my-posts'],
      ['profile-section-plans', 'screen-my-plans'],
      ['profile-section-responses', 'screen-my-plans'],
      ['profile-section-followers', 'screen-follows'],
      ['profile-section-following', 'screen-follows'],
      ['profile-section-actions', 'screen-my-actions'],
      ['profile-section-activity', 'screen-activity'],
      ['profile-messages', 'screen-chats'],
      ['open-settings', 'screen-settings'],
    ];
    for (const [section, screen] of opens) {
      await page.goto('/profile');
      await page.getByTestId(section).click();
      await expect(page.getByTestId(screen)).toBeVisible();
    }
    await page.goto('/profile');
    await page.getByTestId('profile-section-responses').click();
    await expect(page.getByTestId('my-plans-tab-responses')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('«Мои действия» lists a like and a Подписка and opens them', async ({ page }) => {
    await signInAs(page, 'm10');
    await page.goto('/member/m06');
    await page.getByTestId('member-follow').click();
    await expect(page.getByTestId('member-follow')).toHaveText('Вы подписаны');

    await page.goto('/my-actions');
    await page.getByTestId('my-actions-category-follows').click();
    const row = page.getByTestId('my-actions-list').getByRole('link').first();
    await expect(row).toContainText('Вы подписались');
    await row.click();
    await expect(page.getByTestId('screen-member')).toBeVisible();

    await page.goto('/my-actions');
    await page.getByTestId('my-actions-category-reactions').click();
    await expect(
      page.getByTestId('my-actions-list').or(page.getByTestId('my-actions-empty')),
    ).toBeVisible();
  });
});
