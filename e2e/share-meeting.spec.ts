import { expect, test, type Page } from '@playwright/test';

import { signInAs } from './helpers';

// plan1 is m06's open coffee Встреча in Almaty; its exact place is «Кофейня на Панфилова».

async function openShareMenu(page: Page) {
  await page.goto('/meeting/plan1');
  await page.getByTestId('plan-share').click();
  await expect(page.getByTestId('plan-share-sheet')).toBeVisible();
}

test.describe('«Поделиться» встречей (v4 §30, 88–116)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('in Aitu Dating: find a person, skip the blocked, send into the pair’s chat (88–98)', async ({
    page,
  }) => {
    await signInAs(page, 'm03');
    // Someone blocked never shows up among recipients.
    await page.goto('/member/m09');
    await page.getByTestId('member-menu').click();
    await page.getByTestId('sheet-block').click();
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('toast')).toBeVisible();

    await openShareMenu(page);
    await expect(page.getByTestId('plan-share-sheet').getByRole('menuitem')).toHaveText([
      'Поделиться в Aitu Dating',
      'Поделиться через другое приложение',
      'Скопировать ссылку',
    ]);
    await page.getByTestId('share-in-app').click();
    await expect(page.getByTestId('screen-share-meeting')).toBeVisible();
    await expect(page.getByTestId('share-to-m09')).toHaveCount(0);
    await expect(page.getByTestId('share-to-m03')).toHaveCount(0);

    const recipient = page.locator('[data-testid^="share-to-"]').first();
    const name = (await recipient.innerText()).split('\n')[0]!;
    await page.getByTestId('share-search').fill(name.slice(0, 4));
    await expect(page.locator('[data-testid^="share-to-"]').first()).toContainText(name);
    await page.getByTestId('share-note').fill('Сходим вместе?');
    await page.locator('[data-testid^="share-to-"]').first().click();

    await expect(page.getByTestId('screen-chat')).toBeVisible();
    const card = page.locator('[data-testid$="-meeting"]').last();
    await expect(card).toContainText('Вы поделились встречей');
    await expect(page.locator('[data-testid$="-meeting-status"]').last()).toHaveText(
      'Встреча открыта',
    );
    await expect(page.getByTestId('chat-messages')).toContainText('Сходим вместе?');
    await expect(card).not.toContainText('Кофейня на Панфилова');
    await page.locator('[data-testid$="-meeting-open"]').last().click();
    await expect(page).toHaveURL(/\/meeting\/plan1$/);

    await page.goto('/chats');
    await expect(
      page.getByTestId('chats-list').getByRole('link').filter({ hasText: name }),
    ).toHaveCount(1);
  });

  test('from a chat: the person is already chosen, one tap is one card, status follows (99–105)', async ({
    page,
  }) => {
    await signInAs(page, 'm06');
    await page.goto('/member/m10');
    await page.getByTestId('member-write').click();
    await expect(page.getByTestId('screen-chat')).toBeVisible();
    await page.getByTestId('chat-share').click();
    await expect(page.getByTestId('share-picker')).toContainText('Выберите встречу для отправки');
    await page.getByTestId('share-pick-plan1').click();
    const cards = page.locator('[data-testid$="-meeting"]');
    await expect(cards).toHaveCount(1);
    await expect(page.getByTestId('chat-messages')).toContainText(
      'Хочу пригласить тебя на эту встречу',
    );
    await page.reload();
    await expect(cards).toHaveCount(1);

    // Closing the Встреча shows on the card already sent.
    await page.goto('/meeting/plan1');
    await page.getByTestId('plan-menu').click();
    await page.getByTestId('sheet-close-plan').click();
    await expect(page.getByTestId('plan-status')).toHaveText('Набор закрыт');
    await signInAs(page, 'm10');
    await page.goto('/chats');
    await page.getByTestId('chats-list').getByRole('link').first().click();
    await expect(page.locator('[data-testid$="-meeting"]').last()).toContainText(
      'Пользователь поделился встречей',
    );
    await expect(page.locator('[data-testid$="-meeting-status"]').last()).toHaveText(
      'Набор закрыт',
    );
  });

  test('through another app and as a link: the meeting only, never its place (106–115)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      // The system share sheet, as the browser would hand it the invitation.
      (window as unknown as { shared: unknown[] }).shared = [];
      Object.defineProperty(navigator, 'share', {
        value: async (data: unknown) => {
          (window as unknown as { shared: unknown[] }).shared.push(data);
        },
      });
    });
    await signInAs(page, 'm03');
    await openShareMenu(page);
    await page.getByTestId('share-elsewhere').click();
    const shared = await page.evaluate(
      () =>
        (window as unknown as { shared: { title: string; text: string; url: string }[] }).shared,
    );
    expect(shared).toHaveLength(1);
    expect(shared[0]!.title).toBe('Приглашение на встречу в Aitu Dating');
    expect(shared[0]!.text).toMatch(/^Хочу пригласить тебя на встречу в Aitu Dating: Кофе/);
    expect(shared[0]!.url).toMatch(/\/meeting\/plan1$/);
    expect(JSON.stringify(shared[0])).not.toContain('Кофейня на Панфилова');

    await openShareMenu(page);
    await page.getByTestId('share-copy').click();
    await expect(page.getByTestId('toast')).toHaveText('Ссылка на встречу скопирована');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/meeting\/plan1$/);
  });

  test('the link opens the safe view without signing in (116)', async ({ browser }) => {
    const guest = await browser.newContext();
    const page = await guest.newPage();
    await page.goto('/meeting/plan1');
    await expect(page.getByTestId('screen-plan')).toBeVisible();
    await expect(page.getByTestId('plan-place')).toHaveCount(0);
    await expect(page.getByTestId('plan-place-hidden')).toBeVisible();
    await page.getByTestId('plan-share').click();
    // A guest shares outside the app only.
    await expect(page.getByTestId('share-in-app')).toHaveCount(0);
    await expect(page.getByTestId('share-copy')).toBeVisible();
    await guest.close();
  });
});
