import { expect, test, type Page } from '@playwright/test';

import { signInAs } from './helpers';

// m03 and m10 neither follow each other nor share a Встреча: nothing ties them but v4's
// rule that anyone verified writes to anyone.

async function openChatWith(page: Page, memberId: string) {
  await page.goto(`/member/${memberId}`);
  await page.getByTestId('member-write').click();
  await expect(page.getByTestId('screen-chat')).toBeVisible();
  await expect(page.getByTestId('chat-messages')).toBeVisible();
}

async function send(page: Page, text: string) {
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-input')).toHaveValue('');
}

test.describe('Свободная переписка (v4 §12, §30 17–25)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('anyone verified writes to anyone, as often as they like, in one chat per pair', async ({
    page,
  }) => {
    await signInAs(page, 'm03');
    await page.goto('/member/m10');
    await expect(page.getByTestId('member-mutual')).toHaveCount(0);
    await expect(page.getByTestId('member-write')).toHaveText('Написать сообщение');
    await openChatWith(page, 'm10');
    for (const text of ['Привет!', 'Видела ваш пост про выставку.', 'Сходим как-нибудь?']) {
      await send(page, text);
    }
    await expect(page.getByTestId('chat-messages')).toContainText('Сходим как-нибудь?');
    await expect(page.getByText('Отправлено').first()).toBeVisible();
    await expect(page.getByTestId('chat-photo-limit')).toHaveText(
      'Максимальный размер фото — 10 МБ',
    );

    // Again from the profile: the same chat, and only one in the list.
    await openChatWith(page, 'm10');
    await expect(page.getByTestId('chat-messages')).toContainText('Привет!');
    await page.goto('/chats');
    await expect(
      page.getByTestId('chats-list').getByRole('link').filter({ hasText: 'Сходим как-нибудь?' }),
    ).toHaveCount(1);
  });

  test('«Перейти в чат» on a Встреча opens the same chat with its author, no Запрос needed', async ({
    page,
  }) => {
    await signInAs(page, 'm03');
    await openChatWith(page, 'm06');
    await send(page, 'Здравствуйте!');
    await page.goto('/meeting/plan1');
    await expect(page.getByTestId('plan-respond')).toBeVisible();
    await page.getByTestId('plan-go-to-chat').click();
    await expect(page.getByTestId('screen-chat')).toBeVisible();
    await expect(page.getByTestId('chat-messages')).toContainText('Здравствуйте!');
  });

  test('a message that did not go reads «Не отправлено» and «Повторить» sends it once', async ({
    page,
  }) => {
    await signInAs(page, 'm03');
    await page.goto('/settings');
    await page.getByTestId('demo-failed-message-once').click();
    await openChatWith(page, 'm10');
    await page.getByTestId('chat-input').fill('Это сообщение не сразу уйдёт');
    await page.getByTestId('chat-send').click();
    const bubble = page.locator('[data-testid^="message-"][data-testid$="-status"]').last();
    await expect(bubble).toHaveText('Не отправлено');
    await page.locator('[data-testid$="-retry"]').last().click();
    await expect(bubble).toHaveText('Отправлено');
    await expect(page.getByText('Это сообщение не сразу уйдёт')).toHaveCount(1);
  });

  test('a Блокировка closes the chat and takes the buttons away', async ({ page }) => {
    await signInAs(page, 'm03');
    await openChatWith(page, 'm10');
    await send(page, 'До блокировки');
    await page.getByTestId('chat-menu').click();
    await page.getByTestId('sheet-block').click();
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('toast')).toBeVisible();

    await signInAs(page, 'm10');
    await page.goto('/member/m03');
    await expect(page.getByTestId('member-write')).toHaveCount(0);
    await page.goto('/chats');
    await expect(page.getByTestId('chats-list')).not.toContainText('До блокировки');
  });

  test('an unverified user is invited to verify instead of writing', async ({ page }) => {
    await page.goto('/chats/chat1');
    await expect(page.getByTestId('chat-access-prompt')).toBeVisible();
    await expect(page.getByTestId('chat-input')).toHaveCount(0);
  });
});

test.describe('Голосовые сообщения', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('record with a visible timer, cancel, record again, listen and send', async ({ page }) => {
    await signInAs(page, 'm03');
    await openChatWith(page, 'm10');

    // Cancelling sends nothing.
    await page.getByTestId('chat-voice-record').click();
    await expect(page.getByTestId('chat-voice-recording')).toContainText('Идёт запись');
    await expect(page.getByTestId('chat-voice-time')).toContainText('/ 1:00');
    await page.getByTestId('chat-voice-discard').click();
    await expect(page.getByTestId('chat-voice-recording')).toHaveCount(0);
    await expect(page.getByTestId('chat-empty')).toBeVisible();

    await page.getByTestId('chat-voice-record').click();
    await expect(page.getByTestId('chat-voice-time')).toContainText('0:01 / 1:00', {
      timeout: 5_000,
    });
    await page.getByTestId('chat-voice-stop').click();
    await expect(page.getByTestId('chat-voice-preview')).toBeVisible();
    await page.getByTestId('chat-voice-preview-play').click();
    await expect(page.getByTestId('chat-voice-preview-pause')).toBeVisible();
    await page.getByTestId('chat-voice-preview-pause').click();
    await page.getByTestId('chat-voice-send').click();

    const voice = page.locator('[data-testid$="-voice"]').last();
    await expect(voice).toBeVisible();
    await expect(voice.locator('[data-testid$="-voice-duration"]')).toHaveText(/^0:0[1-9]$/);
    await expect(page.getByTestId('chat-voice-preview')).toHaveCount(0);
    await page.goto('/chats');
    await expect(page.getByTestId('chats-list')).toContainText('Голосовое сообщение');
  });

  test('a voice message that did not go is retried once', async ({ page }) => {
    await signInAs(page, 'm03');
    await page.goto('/settings');
    await page.getByTestId('demo-failed-message-once').click();
    await openChatWith(page, 'm10');
    await page.getByTestId('chat-voice-record').click();
    await expect(page.getByTestId('chat-voice-time')).toContainText('0:01', { timeout: 5_000 });
    await page.getByTestId('chat-voice-stop').click();
    await page.getByTestId('chat-voice-send').click();
    const status = page.locator('[data-testid^="message-"][data-testid$="-status"]').last();
    await expect(status).toHaveText('Не отправлено');
    await page.locator('[data-testid$="-retry"]').last().click();
    await expect(status).toHaveText('Отправлено');
    await expect(page.locator('[data-testid$="-voice"]')).toHaveCount(1);
  });
});
