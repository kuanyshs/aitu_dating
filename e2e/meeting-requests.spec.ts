import { expect, test, type Page } from '@playwright/test';

import { signInAs } from './helpers';

// plan1 is m06's coffee Встреча; m02 and m03 ask for it.

async function sendRequest(page: Page, message?: string) {
  await page.goto('/meeting/plan1');
  await page.getByTestId('plan-respond').click();
  if (message) await page.getByTestId('plan-message').fill(message);
  await page.getByTestId('plan-send').click();
  await expect(page.getByTestId('plan-pending')).toBeVisible();
}

/** The chat with the Встреча's author, from the meeting page. */
async function chatWithAuthor(page: Page) {
  await page.goto('/meeting/plan1');
  await page.getByTestId('plan-go-to-chat').click();
  await expect(page.getByTestId('screen-chat')).toBeVisible();
}

const card = (page: Page) => page.locator('[data-testid$="-meeting"]').last();
const cardStatus = (page: Page) => page.locator('[data-testid$="-meeting-status"]').last();

test.describe('Запросы на встречи (v4 §30, 58–81)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a request goes with words, lands in the pair’s chat as a card and is followed to the end', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // 58–62: two separate buttons; the chat opens before any request.
    await signInAs(page, 'm02');
    await page.goto('/meeting/plan1');
    await expect(page.getByTestId('plan-respond')).toHaveText('Отправить запрос');
    await expect(page.getByTestId('plan-go-to-chat')).toHaveText('Перейти в чат');
    await chatWithAuthor(page);
    await page.getByTestId('chat-input').fill('Здравствуйте! Вопрос про встречу');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-input')).toHaveValue('');

    // 63–67: the request with a message, its status, no second one, and withdrawing.
    await sendRequest(page, 'С удовольствием приду!');
    await expect(page.getByTestId('plan-pending')).toContainText('Запрос отправлен');
    await expect(page.getByTestId('plan-pending-message')).toHaveText('«С удовольствием приду!»');
    await expect(page.getByTestId('plan-respond')).toHaveCount(0);
    await page.getByTestId('plan-withdraw').click();
    await expect(page.getByTestId('plan-respond')).toBeVisible();
    await sendRequest(page, 'Всё-таки приду!');

    // 68–71: the card in the same chat, with «Открыть встречу» leading to this Встреча.
    await chatWithAuthor(page);
    await expect(page.getByTestId('chat-messages')).toContainText(
      'Здравствуйте! Вопрос про встречу',
    );
    await expect(card(page)).toContainText('Вы отправили запрос на встречу');
    await expect(cardStatus(page)).toHaveText('Запрос отправлен');
    await expect(page.locator('[data-testid$="-meeting-status"]')).toHaveText([
      'Запрос отозван',
      'Запрос отправлен',
    ]);
    await page.locator('[data-testid$="-meeting-open"]').last().click();
    await expect(page.getByTestId('screen-plan').last()).toBeVisible();
    await expect(page).toHaveURL(/\/meeting\/plan1$/);

    // Someone else asks too.
    await signInAs(page, 'm03');
    await sendRequest(page);

    // 72–74: the author is told and opens the requests from the notice.
    await signInAs(page, 'm06');
    await page.goto('/activity');
    await page.getByText('Пользователь отправил запрос на вашу встречу').first().click();
    await expect(page.getByTestId('plan-responses')).toBeVisible();

    // 75–77: accepting matches the Встреча, updates the card and declines the other.
    await page.getByTestId('plan-accept-response-2').click();
    await page.getByTestId('sheet-confirm-accept').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Встреча договорена');
    await expect(page.getByTestId('plan-place')).toBeVisible();

    await signInAs(page, 'm02');
    await chatWithAuthor(page);
    await expect(cardStatus(page)).toHaveText('Встреча договорена');
    await page.goto('/meeting/plan1');
    await expect(page.getByTestId('plan-place')).toBeVisible();
    await expect(page.getByTestId('plan-go-to-chat')).toBeVisible();

    await signInAs(page, 'm03');
    await page.goto('/meeting/plan1');
    await expect(page.getByTestId('plan-place')).toHaveCount(0);
    await chatWithAuthor(page);
    await expect(cardStatus(page)).toHaveText('Запрос отклонён');

    // 78: cancelling the Встреча updates every card.
    await signInAs(page, 'm06');
    await page.goto('/meeting/plan1');
    await page.getByTestId('plan-menu').click();
    await page.getByTestId('sheet-cancel-plan').click();
    await page.getByTestId('sheet-confirm-cancel').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Отменена');
    await signInAs(page, 'm02');
    await page.goto('/activity');
    await expect(page.getByTestId('screen-activity')).toContainText('Встреча отменена');
    await page.goto('/chats');
    await page.getByTestId('chats-list').getByRole('link').first().click();
    await expect(cardStatus(page)).toHaveText('Встреча отменена');
  });

  test('the author blocks a sender from the request (79–81)', async ({ page }) => {
    await signInAs(page, 'm02');
    await sendRequest(page, 'Можно?');

    await signInAs(page, 'm06');
    await page.goto('/meeting/plan1');
    await page.getByTestId('plan-response-block-response-1').click();
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('toast')).toContainText('заблокирован');
    await expect(page.getByTestId('plan-response-response-1')).toHaveCount(0);
    await page.goto('/activity');
    await expect(page.getByTestId('screen-activity')).toContainText('Пользователь заблокирован');

    await signInAs(page, 'm02');
    await page.goto('/meeting/plan1');
    await expect(page.getByTestId('plan-unavailable')).toBeVisible();
    await expect(page.getByTestId('plan-respond')).toHaveCount(0);
    await expect(page.getByTestId('plan-go-to-chat')).toHaveCount(0);
    await page.goto('/member/m06');
    await expect(page.getByTestId('member-write')).toHaveCount(0);
  });

  test('a Встреча agreed with someone else reads «Встреча уже договорена»', async ({ page }) => {
    await signInAs(page, 'm02');
    await sendRequest(page);
    await signInAs(page, 'm06');
    await page.goto('/meeting/plan1');
    await page.getByTestId('plan-accept-response-1').click();
    await page.getByTestId('sheet-confirm-accept').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Встреча договорена');

    await signInAs(page, 'm04');
    await page.goto('/meeting/plan1');
    await expect(page.getByTestId('plan-matched-other')).toHaveText('Встреча уже договорена');
    await expect(page.getByTestId('plan-respond')).toHaveCount(0);
  });
});
