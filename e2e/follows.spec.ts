import { expect, test } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

import { joinAsMadina } from './helpers';

const m01 = loadSeed().members.find((m) => m.id === 'm01')!;

test.describe('Подписчики и Подписки', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a new member starts with both lists empty', async ({ page }) => {
    await joinAsMadina(page);
    await page.getByTestId('tab-profile').click();
    await expect(page.getByTestId('profile-stat-followers')).toContainText('0');
    await page.getByTestId('profile-stat-followers').click();
    await expect(page.getByTestId('follows-empty')).toContainText('Пока нет подписчиков');
    await page.getByTestId('follows-tab-following').click();
    await expect(page.getByTestId('follows-empty')).toContainText('Пока ни на кого не подписаны');
  });

  test('following someone lists them, and them it', async ({ page }, testInfo) => {
    await joinAsMadina(page);
    await page.goto('/member/m01');
    await page.getByTestId('member-follow').click();
    await expect(page.getByTestId('member-follow')).toHaveText('Вы подписаны');

    // Their «Подписчики»: I am the newest one, and my row opens my own Profile tab.
    await page.getByTestId('member-stat-followers').click();
    await expect(page.getByTestId('follows-tab-followers')).toHaveAttribute('aria-checked', 'true');
    const first = page.getByTestId('follows-list').getByRole('link').first();
    await expect(first).toContainText('Мадина');
    await testInfo.attach('followers', { body: await page.screenshot(), contentType: 'image/png' });
    await first.click();
    await expect(page.getByTestId('screen-profile')).toBeVisible();

    // My «Подписки»: them, and their row opens their profile.
    await expect(page.getByTestId('profile-stat-following')).toContainText('1');
    await page.getByTestId('profile-stat-following').click();
    await page.getByTestId('follows-person-m01').click();
    // Their first profile screen is still underneath: work on the top one.
    const top = page.getByTestId('screen-member').last();
    await expect(top.getByTestId('member-name')).toHaveText(m01.name);

    // Unfollowed, they leave the list.
    await top.getByTestId('member-follow').click();
    await expect(top.getByTestId('member-follow')).toHaveText('Подписаться');
    await top.getByTestId('member-back').click();
    await expect(page.getByTestId('follows-empty').last()).toBeVisible();
  });

  test('an expired member cannot open the lists', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/profile');
    await expect(page.getByTestId('profile-stat-followers')).toBeVisible();
    await expect(page.getByTestId('profile-stat-followers')).not.toHaveAttribute('role', 'link');
    await page.goto('/follows?memberId=m01&tab=followers');
    await expect(page.getByTestId('follows-renew')).toBeVisible();
  });
});
