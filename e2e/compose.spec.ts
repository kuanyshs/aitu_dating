import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina, topFeedArticle } from './helpers';

/** The article on top of Home, by position: the feed list recycles its cells. */
const topText = async (page: Page) => (await topFeedArticle(page))?.text ?? '';
const byText = (page: Page, text: string) =>
  page.getByTestId('screen-home').getByRole('article').filter({ hasText: text });

async function openEditor(page: Page) {
  // The member footer of Home shows the session has loaded before the tab is tapped.
  await expect(page.getByTestId('home-member')).toBeVisible();
  await page.getByTestId('tab-create').click();
  await page.getByTestId('create-post').click();
  await expect(page.getByTestId('screen-compose')).toBeVisible();
}

test.describe('Создание поста', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a post with a topic leads «Поиск» after publishing', async ({ page }, testInfo) => {
    await joinAsMadina(page);
    await page.getByTestId('feed-tab-popular').click();
    await openEditor(page);
    await expect(page.getByRole('heading', { name: 'Новый пост' })).toBeVisible();
    await expect(page.getByTestId('compose-submit')).toHaveAttribute('aria-disabled', 'true');

    await page.getByTestId('compose-topic-meetings').click();
    await page.getByTestId('compose-input').fill('Где в Алматы тихо поговорить после работы?');
    await expect(page.getByTestId('compose-counter')).toHaveText('42 / 1000');
    await testInfo.attach('compose-question', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('compose-submit').click();

    await expect(page.getByTestId('screen-compose')).toHaveCount(0);
    await expect(page.getByTestId('toast')).toContainText('Опубликовано');
    await expect(page.getByTestId('feed-tab-for_you')).toHaveAttribute('aria-checked', 'true');
    const question = 'Где в Алматы тихо поговорить после работы?';
    await expect.poll(() => topText(page)).toContain(question);
    await expect(byText(page, question)).toBeInViewport({ ratio: 0.9 });
    await expect(byText(page, question).getByTestId('post-type')).toHaveCount(0);
    await expect(byText(page, question)).toContainText('#встречи');
    await expect(byText(page, question)).toContainText('Мадина');

    // It survives a restart.
    await page.waitForTimeout(1000);
    await page.reload();
    await expect.poll(() => topText(page)).toContain(question);
  });

  test('topics stop at two and only real text can be published', async ({ page }) => {
    await joinAsMadina(page);
    await openEditor(page);
    for (const topic of ['conversation', 'meetings']) {
      await page.getByTestId(`compose-topic-${topic}`).click();
    }
    const third = page.getByTestId('compose-topic-thoughts');
    await expect(third).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('compose-topic-meetings').click();
    await expect(page.getByTestId('compose-topic-meetings')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(third).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('compose-counter')).toHaveText('0 / 1000');
    await page.getByTestId('compose-input').fill('   ');
    await expect(page.getByTestId('compose-submit')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('compose-cancel').click();
    await expect(page.getByTestId('screen-compose')).toHaveCount(0);
  });

  test('a failed send keeps the text and «Повторить» publishes it once', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-network-error-once').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    // Straight to the editor: the feed underneath would take the one-off failure first.
    await page.goto('/compose');
    await expect(page.getByTestId('screen-compose')).toBeVisible();
    await page.getByTestId('compose-input').fill('Пост после сбоя сети');
    await page.getByTestId('compose-submit').click();
    await expect(page.getByTestId('compose-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('compose-input')).toHaveValue('Пост после сбоя сети');
    await page.getByTestId('compose-retry').click();
    await expect(page.getByTestId('toast')).toContainText('Опубликовано');
    await expect.poll(() => topText(page)).toContain('Пост после сбоя сети');
    await expect(
      page
        .getByTestId('screen-home')
        .getByRole('article')
        .filter({ hasText: 'Пост после сбоя сети' }),
    ).toHaveCount(1);
  });

  test('a guest and an expired member are shown the way in instead', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tab-create').click();
    await expect(page.getByTestId('create-access-prompt')).toBeVisible();

    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/');
    await page.getByTestId('tab-create').click();
    await expect(page.getByTestId('screen-compose')).toHaveCount(0);
    await expect(page.getByTestId('create-access-prompt')).toBeVisible();
  });
});
