import { expect, test } from '@playwright/test';

import { choosePhotos, joinAsMadina } from './helpers';

test.describe('Фото в публикации', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a post takes one Фото; only a generated one reads «Сгенерировано с ИИ» (v4 §30, 41–45)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await joinAsMadina(page);
    await page.goto('/compose');
    await expect(page.getByTestId('screen-compose')).toBeVisible();
    await page.getByTestId('compose-input').fill('Фотография с вечерней прогулки');
    await choosePhotos(page, () => page.getByTestId('compose-photos-add').click(), ['red']);
    // One fits: «Добавить фото» is gone once it is chosen.
    await expect(page.getByTestId('compose-photos-slot-0')).toBeVisible();
    await expect(page.getByTestId('compose-photos-slot-1')).toHaveCount(0);
    await expect(page.getByTestId('compose-photos-add')).toHaveCount(0);
    await expect(page.getByTestId('compose-photos-ai-0')).toHaveCount(0);
    await page.getByTestId('compose-submit').click();
    await expect(page.getByTestId('toast')).toContainText('Опубликовано');

    const home = page.getByTestId('screen-home');
    const plain = home.getByRole('article').filter({ hasText: 'Фотография с вечерней прогулки' });
    await expect(plain.getByRole('button', { name: 'Открыть фото 1 из 1' })).toBeVisible();
    await expect(plain).not.toContainText('Сгенерировано с ИИ');

    // A generated picture is told by its file, whatever the text says.
    await page.goto('/compose');
    await page.getByTestId('compose-input').fill('Картинка, которую нарисовала нейросеть');
    await choosePhotos(page, () => page.getByTestId('compose-photos-add').click(), ['ai']);
    await expect(page.getByTestId('compose-photos-ai-0')).toHaveText('Сгенерировано с ИИ');
    await page.getByTestId('compose-submit').click();
    await expect(page.getByTestId('toast')).toContainText('Опубликовано');
    const generated = home.getByRole('article').filter({ hasText: 'нарисовала нейросеть' });
    await expect(generated.getByText('Сгенерировано с ИИ', { exact: true })).toBeVisible();
    await generated.getByRole('button', { name: 'Открыть фото 1 из 1' }).click();
    await expect(page.getByTestId('photo-ai')).toHaveText('Сгенерировано с ИИ');
    await page.getByTestId('photo-close').click();
  });

  test('closing with only Фото offers to keep a draft, and the draft brings them back', async ({
    page,
  }) => {
    await joinAsMadina(page);
    await page.goto('/compose');
    await choosePhotos(page, () => page.getByTestId('compose-photos-add').click(), ['red']);
    await expect(page.getByTestId('compose-photos-remove-0')).toHaveAttribute(
      'aria-label',
      'Удалить фото',
    );
    await page.getByTestId('compose-cancel').click();
    await page.getByTestId('draft-save').click();

    await page.goto('/compose');
    await expect(page.getByTestId('compose-photos-slot-0')).toBeVisible();
  });
});
