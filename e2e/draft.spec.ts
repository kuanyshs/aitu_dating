import { expect, test, type Page } from '@playwright/test';

import { joinAsMadina } from './helpers';

async function openEditor(page: Page) {
  // The member header shows the session has loaded before the tab is tapped.
  await expect(page.getByTestId('home-messages')).toBeVisible();
  await page.getByTestId('tab-create').click();
  await expect(page.getByTestId('compose-input')).toBeVisible();
}

async function writeAndKeep(page: Page, text: string) {
  await page.getByTestId('compose-type-question').click();
  await page.getByTestId('compose-topic-city').click();
  await page.getByTestId('compose-input').fill(text);
  await page.getByTestId('compose-cancel').click();
  await expect(page.getByTestId('compose-sheet')).toContainText('Сохранить черновик?');
  await page.getByTestId('draft-save').click();
  await expect(page.getByTestId('toast')).toContainText('Черновик сохранён');
  await expect(page.getByTestId('screen-compose')).toHaveCount(0);
}

test.describe('Создание: a draft', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('is kept on closing, comes back on opening and is gone once published', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await openEditor(page);
    await writeAndKeep(page, 'Черновой вопрос про город');

    // Also after a restart.
    await page.reload();
    await openEditor(page);
    await expect(page.getByTestId('compose-input')).toHaveValue('Черновой вопрос про город');
    await expect(page.getByTestId('compose-type-question')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('compose-topic-city')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('compose-sheet')).toHaveCount(0);
    await testInfo.attach('draft-restored', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByTestId('compose-submit').click();
    await expect(page.getByTestId('toast')).toContainText('Опубликовано');
    await openEditor(page);
    await expect(page.getByTestId('compose-input')).toHaveValue('');
  });

  test('«Удалить» drops the text, and an empty editor closes without asking', async ({ page }) => {
    await joinAsMadina(page);
    await openEditor(page);
    await page.getByTestId('compose-input').fill('Не нужно');
    await page.getByTestId('compose-cancel').click();
    await page.getByTestId('draft-discard').click();
    await expect(page.getByTestId('screen-compose')).toHaveCount(0);

    await openEditor(page);
    await expect(page.getByTestId('compose-input')).toHaveValue('');
    await page.getByTestId('compose-cancel').click();
    await expect(page.getByTestId('screen-compose')).toHaveCount(0);
  });

  test('«Отмена» in the question goes back to writing', async ({ page }) => {
    await joinAsMadina(page);
    await openEditor(page);
    await page.getByTestId('compose-input').fill('Ещё пишу');
    await page.getByTestId('compose-cancel').click();
    await page.getByTestId('compose-sheet-cancel').click();
    await expect(page.getByTestId('compose-input')).toHaveValue('Ещё пишу');
  });

  test('a draft for something else offers to continue it or start over', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await openEditor(page);
    await writeAndKeep(page, 'Черновик нового поста');

    // Quoting p02 while a new-post draft waits: continue it.
    await page.getByTestId('post-p02').getByTestId('post-open').click();
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('screen-post').getByTestId('post-quote').click();
    await expect(page.getByTestId('compose-sheet')).toContainText('У вас есть черновик');
    await testInfo.attach('draft-conflict', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByTestId('draft-continue').click();
    await expect(page.getByTestId('compose-input')).toHaveValue('Черновик нового поста');
    await expect(page.getByTestId('compose-quoted-p02')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Новый вопрос' })).toBeVisible();
    await page.getByTestId('compose-cancel').click();
    await page.getByTestId('draft-save').click();

    // And again: start over, which deletes the draft.
    await page.goto('/');
    await page.getByTestId('post-p02').getByTestId('post-open').click();
    await expect(page.getByTestId('reply-composer')).toBeVisible();
    await page.getByTestId('screen-post').getByTestId('post-quote').click();
    await page.getByTestId('draft-start-over').click();
    await expect(page.getByTestId('compose-quoted-p02')).toBeVisible();
    await expect(page.getByTestId('compose-input')).toHaveValue('');
    await page.getByTestId('compose-cancel').click();

    await page.goto('/');
    await openEditor(page);
    await expect(page.getByTestId('compose-input')).toHaveValue('');
    await expect(page.getByTestId('compose-sheet')).toHaveCount(0);
  });

  test('«Выйти» and «Войти» keep the draft', async ({ page }) => {
    await joinAsMadina(page);
    await openEditor(page);
    await writeAndKeep(page, 'Переживёт выход');
    await page.getByTestId('tab-profile').click();
    await page.getByRole('button', { name: 'Выйти в preview' }).click();
    await expect(page.getByTestId('profile-access-prompt-login')).toBeVisible();
    await page.getByTestId('tab-index').click();
    await page.getByRole('button', { name: 'Войти в зарегистрированный режим' }).click();
    await openEditor(page);
    await expect(page.getByTestId('compose-input')).toHaveValue('Переживёт выход');
  });

  test('«Сбросить демо» forgets the draft', async ({ page }) => {
    await joinAsMadina(page);
    await openEditor(page);
    await writeAndKeep(page, 'Исчезнет со сбросом');
    await page.goto('/settings');
    await page.getByTestId('demo-reset').click();
    await expect(page.getByTestId('toast')).toBeVisible();

    await joinAsMadina(page);
    await openEditor(page);
    await expect(page.getByTestId('compose-input')).toHaveValue('');
  });
});
