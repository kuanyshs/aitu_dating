import { expect, test } from '@playwright/test';

import { joinAsMadina, openDemoPanel, signInAs } from './helpers';

// Seed chats of m01: chat1 with m09 (two unread), chat2 from a comment on p01.

test.describe('Сообщения', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member sees the unread count on «Сообщения» and their chats, latest first', async ({
    page,
  }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await expect(page.getByTestId('tab-chats-count')).toHaveText('2');
    await expect(page.getByTestId('tab-chats')).toHaveAccessibleName('Сообщения, непрочитанных: 2');
    await page.getByTestId('tab-chats').click();

    const rows = page.getByTestId('chats-list').getByRole('link');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveAttribute('data-testid', 'chat-row-chat1');
    await expect(page.getByTestId('chat-row-chat1-unread')).toHaveText('2');
    await expect(page.getByTestId('chat-row-chat1-context')).toHaveText('Взаимная подписка');
    await expect(page.getByTestId('chat-row-chat2-context')).toHaveText('Из комментария');
    await expect(page.getByTestId('chat-row-chat2-preview')).toContainText('Вы: ');

    await page.getByTestId('chat-row-chat1').click();
    await expect(page.getByTestId('screen-chat')).toBeVisible();
  });

  test('a new member sees where chats come from', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/chats');
    await expect(page.getByTestId('chats-empty')).toContainText('Пока нет разговоров');
  });

  test('a guest is invited to join', async ({ page }) => {
    await page.goto('/chats');
    await expect(page.getByTestId('chats-access-prompt')).toBeVisible();
  });

  test('an expired member reaches the chats from the profile and is offered renewal', async ({
    page,
  }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await openDemoPanel(page);
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.getByTestId('settings-close').click();
    await page.getByTestId('tab-profile').click();
    await page.getByTestId('profile-messages').click();
    await expect(page.getByTestId('chats-renew')).toBeVisible();
    await expect(page.getByTestId('chats-list').getByRole('link')).toHaveCount(2);
  });

  test('the menu has no «Сообщения»; Home has no messages button', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await expect(page.getByTestId('home-member')).toBeVisible();
    await expect(page.getByRole('button', { name: /Сообщения/ })).toHaveCount(0);
    await page.goto('/menu');
    await expect(page.getByTestId('menu-activity')).toHaveText('Уведомления');
    await expect(page.getByText('Сообщения')).toHaveCount(0);
  });
});
