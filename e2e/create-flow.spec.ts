import { expect, test } from '@playwright/test';

import { joinAsMadina, topFeedArticle } from './helpers';

const question = 'Где в Алматы тихо поговорить после работы?';
const quote = 'Отвечу сама себе: в кофейне у парка.';

/** The spec «Создание» end to end: a question, its quote, the original deleted. */
test('a question leads the feed, is quoted, and the quote outlives it', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  test.setTimeout(90_000);
  await joinAsMadina(page);
  const home = page.getByTestId('screen-home');
  const byText = (text: string) => home.getByRole('article').filter({ hasText: text });

  // A question with a topic, first in «Для вас».
  await expect(page.getByTestId('home-messages')).toBeVisible();
  await page.getByTestId('tab-create').click();
  await page.getByTestId('compose-type-question').click();
  await page.getByTestId('compose-topic-meetings').click();
  await page.getByTestId('compose-input').fill(question);
  await page.getByTestId('compose-submit').click();
  await expect(page.getByTestId('toast')).toContainText('Опубликовано');
  await expect.poll(async () => (await topFeedArticle(page))?.text ?? '').toContain(question);
  await expect(byText(question).getByTestId('post-type')).toHaveText('Вопрос');
  await expect(byText(question)).toContainText('#встречи');

  // Quote it and publish the quote: it leads the feed now.
  await byText(question).getByTestId('post-quote').click();
  await expect(page.getByRole('heading', { name: 'Цитата' })).toBeVisible();
  await page.getByTestId('compose-input').fill(quote);
  await page.getByTestId('compose-submit').click();
  await expect(page.getByTestId('toast')).toContainText('Опубликовано');
  await expect.poll(async () => (await topFeedArticle(page))?.text ?? '').toContain(quote);
  await expect(byText(quote).getByTestId('quoted-post')).toContainText(question);

  // Delete the original question from its screen.
  await byText(question)
    .filter({ hasNot: page.getByTestId('quoted-post') })
    .getByTestId('post-open')
    .click();
  await page.getByTestId('post-menu').click();
  await page.getByTestId('sheet-delete').click();
  await page.getByTestId('sheet-confirm-delete').click();
  await expect(page.getByTestId('screen-post')).toHaveCount(0);

  // The quote stays and says its original is unavailable.
  await expect(byText(question).filter({ hasNot: page.getByTestId('quoted-post') })).toHaveCount(0);
  await page.reload();
  await expect(byText(quote).getByTestId('quoted-unavailable')).toHaveText('Публикация недоступна');
  await expect(byText(question)).toHaveCount(0);
});
