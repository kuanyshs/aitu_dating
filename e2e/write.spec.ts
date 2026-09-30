import { expect, test, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

import { signInAs } from './helpers';

// «Написать» opens the one chat of two people, from a comment, a mutual Подписка
// (m01 and m09 share chat1) or a Встреча.

const seed = loadSeed();
/** A root comment on p02 by someone other than m04, who has no chat with them. */
const comment = seed.comments.find(
  (c) =>
    c.postId === 'p02' && !c.parentCommentId && !c.deleted && !['m04', 'm11'].includes(c.authorId),
)!;

async function expectChat(page: Page) {
  await expect(page.getByTestId('screen-chat')).toBeVisible();
  await expect(page.getByTestId('chat-messages')).toBeVisible();
}

test.describe('Написать', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('from someone else’s comment, once', async ({ page }) => {
    await signInAs(page, 'm04');
    await page.goto('/post/p02');
    const row = page.getByTestId(`comment-${comment.id}`);
    await row.getByTestId('comment-menu').first().click();
    await page.getByTestId('sheet-write').click();
    await expectChat(page);
    await expect(page.getByTestId('chat-context')).toHaveText('Из комментария');
    await expect(page.getByTestId('chat-empty')).toBeVisible();
    await page.getByTestId('chat-input').fill('Интересная мысль, расскажете подробнее?');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-input')).toHaveValue('');

    // Again from the same comment: the same chat, with the message.
    await page.goto('/post/p02');
    await row.getByTestId('comment-menu').first().click();
    await page.getByTestId('sheet-write').click();
    await expect(page.getByText('Интересная мысль, расскажете подробнее?')).toBeVisible();
    await page.goto('/chats');
    await expect(page.getByTestId('chats-list').getByRole('link')).toHaveCount(1);
  });

  test('from a mutual Подписка: the existing chat', async ({ page }) => {
    await signInAs(page, 'm01');
    await page.goto('/member/m09');
    await expect(page.getByTestId('member-mutual')).toBeVisible();
    await page.getByTestId('member-write').click();
    await expectChat(page);
    await expect(page.getByTestId('message-chat1-m25')).toBeVisible();
    // A one-way Подписка offers no chat.
    await page.goto('/member/m12');
    await expect(page.getByTestId('member-follow')).toBeVisible();
    await expect(page.getByTestId('member-write')).toHaveCount(0);
  });

  test('from a Встреча, for both of its people', async ({ page }) => {
    await signInAs(page, 'm04');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-respond').click();
    await page.getByTestId('plan-send').click();
    await expect(page.getByTestId('plan-pending')).toBeVisible();

    await signInAs(page, 'm06');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-accept-response-1').click();
    await page.getByTestId('sheet-confirm-accept').click();
    await page.getByTestId('plan-write').click();
    await expectChat(page);
    await expect(page.getByTestId('chat-context')).toContainText('Встреча: Кофе');
    await page.getByTestId('chat-input').fill('До встречи в воскресенье!');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-input')).toHaveValue('');

    // The accepted side opens the same chat.
    await signInAs(page, 'm04');
    await page.goto('/plan/plan1');
    await page.getByTestId('plan-write').click();
    await expectChat(page);
    await expect(page.getByText('До встречи в воскресенье!')).toBeVisible();
  });
});
