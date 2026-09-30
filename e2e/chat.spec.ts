import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina, openDemoPanel, signInAs } from './helpers';

// chat1: m01 and m09, 25 messages; m01 has not read m09's last two. chat2: m01 and the
// author of a comment on p01.

async function openChat(page: Page, userId: string, chatId: string) {
  await signInAs(page, userId);
  await page.goto(`/chats/${chatId}`);
  await expect(page.getByTestId('chat-messages')).toBeVisible();
}

async function send(page: Page, text: string) {
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-input')).toHaveValue('');
}

test.describe('Чат', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('opening a chat reads it; earlier messages load on demand', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/chats');
    await page.getByTestId('chat-row-chat1').click();
    await expect(page.getByTestId('message-chat1-m25')).toContainText('можем сходить вместе');
    await expect(page.getByTestId('message-chat1-m1')).toHaveCount(0);
    await page.getByTestId('chat-earlier').click();
    await expect(page.getByTestId('message-chat1-m1')).toBeVisible();
    await expect(page.getByTestId('chat-earlier')).toHaveCount(0);

    await page.getByTestId('chat-back').click();
    await expect(page.getByTestId('chat-row-chat1-unread')).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByTestId('home-messages')).toBeVisible();
    await expect(page.getByTestId('home-messages-unread')).toHaveCount(0);

    // m09 now sees their last message as read.
    await openChat(page, 'm09', 'chat1');
    await expect(page.getByTestId('message-chat1-m25-status')).toHaveText('Прочитано');
  });

  test('a message is sent; a failed one stays with «Повторить»', async ({ page }) => {
    await openChat(page, 'm01', 'chat2');
    await send(page, 'Как насчёт субботы?');
    const sent = page.getByTestId('chat-messages').getByText('Как насчёт субботы?');
    await expect(sent).toBeVisible();
    await expect(page.getByTestId('message-message-1-status')).toHaveText('Отправлено');

    await page.goto('/settings');
    await page.getByTestId('demo-failed-message-once').click();
    await expect(page.getByTestId('demo-failed-message-once')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await openChat(page, 'm01', 'chat2');
    await send(page, 'Это не дойдёт с первого раза');
    await expect(page.getByTestId('message-message-2-status')).toHaveText('Не отправлено');
    await page.getByTestId('message-message-2-retry').click();
    await expect(page.getByTestId('message-message-2-status')).toHaveText('Отправлено');
  });

  test('«•••» blocks the other side: the chat is gone', async ({ page }) => {
    await openChat(page, 'm01', 'chat1');
    await page.getByTestId('chat-menu').click();
    await page.getByTestId('sheet-block').click();
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('screen-chat')).toHaveCount(0);
    await page.goto('/chats');
    await expect(page.getByTestId('chat-row-chat2')).toBeVisible();
    await expect(page.getByTestId('chat-row-chat1')).toHaveCount(0);
    await page.goto('/chats/chat1');
    await expect(page.getByTestId('chat-unavailable')).toBeVisible();
  });

  test('an expired member reads and is offered renewal', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/');
    await openDemoPanel(page);
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/chats/chat1');
    await expect(page.getByTestId('chat-read-only')).toBeVisible();
    await expect(page.getByTestId('chat-input')).toHaveCount(0);
    await page.getByTestId('chat-renew').click();
    await expect(page).toHaveURL(/\/renew/);
  });

  test('a guest is invited; someone else’s chat is unavailable', async ({ page }) => {
    await page.goto('/chats/chat1');
    await expect(page.getByTestId('chat-access-prompt')).toBeVisible();
    await joinAsMadina(page);
    await page.goto('/chats/chat1');
    await expect(page.getByTestId('chat-unavailable')).toBeVisible();
  });
});
