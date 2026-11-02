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

    // The list alone reads nothing; its header counts what waits.
    await expect(page.getByTestId('chats-unread-total')).toHaveText('Непрочитанных: 2');
    await expect(page.getByTestId('tab-chats-count')).toHaveText('2');

    await page.getByTestId('chat-row-chat1').click();
    await expect(page.getByTestId('screen-chat')).toBeVisible();
    // The last message is on screen: the chat is read.
    await expect(page.getByTestId('message-chat1-m25')).toBeInViewport();
    await page.getByTestId('chat-back').click();
    await expect(page.getByTestId('chat-row-chat1-unread')).toHaveCount(0);
    await expect(page.getByTestId('tab-chats-count')).toHaveCount(0);
    await expect(page.getByTestId('chats-unread-total')).toHaveCount(0);
  });

  test('an incoming message shows in the list and the count at once', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    // chat2 gets the latest message, and chat1 is read: chat2 is on top.
    await page.getByTestId('tab-chats').click();
    await page.getByTestId('chat-row-chat1').click();
    await expect(page.getByTestId('message-chat1-m25')).toBeInViewport();
    await page.getByTestId('chat-back').click();
    await expect(page.getByTestId('tab-chats-count')).toHaveCount(0);
    await page.getByTestId('chat-row-chat2').click();
    await page.getByTestId('chat-input').fill('Как дела?');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-input')).toHaveValue('');
    await page.getByTestId('chat-back').click();
    const rows = page.getByTestId('chats-list').getByRole('link');
    await expect(rows.first()).toHaveAttribute('data-testid', 'chat-row-chat2');

    // The other side of the latest chat (chat2) answers while the app is open.
    await openDemoPanel(page);
    await page.getByTestId('demo-incoming-message').click();
    await expect(page.getByText('Пришло новое сообщение')).toBeVisible();
    await page.getByTestId('settings-close').click();
    await expect(page.getByTestId('tab-chats-count')).toHaveText('1');
    await page.getByTestId('tab-chats').click();
    await expect(rows.first()).toHaveAttribute('data-testid', 'chat-row-chat2');
    await expect(page.getByTestId('chat-row-chat2-unread')).toHaveText('1');
    await expect(page.getByTestId('chats-unread-total')).toHaveText('Непрочитанных: 1');
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
