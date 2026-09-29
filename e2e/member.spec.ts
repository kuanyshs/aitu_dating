import { expect, test, type Page } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

import { joinAsMadina, signInAsSeedAuthor } from './helpers';

const seed = loadSeed();
const m01 = seed.members.find((m) => m.id === 'm01')!;
/** Someone who follows m01 while m01 does not follow them back. */
const follower = seed.follows.find(
  (f) =>
    f.followingId === 'm01' &&
    f.followerId !== 'm11' &&
    !seed.follows.some((g) => g.followerId === 'm01' && g.followingId === f.followerId),
)!.followerId;

async function openM01FromFeed(page: Page) {
  await expect(page.getByTestId('home-messages')).toBeVisible();
  await page.getByTestId('post-p01').getByTestId('post-author').click();
  await expect(page.getByTestId('member-name')).toHaveText(m01.name);
}

test.describe('Чужой профиль', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  });

  test('a member opens an author from the feed, follows and unfollows', async ({
    page,
  }, testInfo) => {
    await joinAsMadina(page);
    await openM01FromFeed(page);
    await expect(page.getByTestId('member-card')).toContainText(m01.card.bio);
    await expect(page.getByTestId('member-posts').getByTestId('post-p01')).toBeVisible();
    const followers = page.getByTestId('member-stat-followers');
    const before = Number((await followers.innerText()).split('\n')[0]);

    await page.getByTestId('member-follow').click();
    await expect(page.getByTestId('member-follow')).toHaveText('Вы подписаны');
    await expect(followers).toContainText(String(before + 1));
    await testInfo.attach('member-following', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // Their posts are in «Подписки» now.
    await page.getByTestId('member-back').click();
    await page.getByTestId('feed-tab-following').click();
    await expect(page.getByTestId('post-p01')).toBeVisible();

    await page.getByTestId('post-p01').getByTestId('post-author').click();
    await page.getByTestId('member-follow').click();
    await expect(page.getByTestId('member-follow')).toHaveText('Подписаться');
    await expect(followers).toContainText(String(before));
  });

  test('following back someone who follows you makes it mutual', async ({ page }) => {
    await signInAsSeedAuthor(page);
    await page.goto(`/member/${follower}`);
    await expect(page.getByTestId('member-follow')).toHaveText('Подписаться');
    await expect(page.getByTestId('member-mutual')).toHaveCount(0);
    await page.getByTestId('member-follow').click();
    await expect(page.getByTestId('member-mutual')).toHaveText('Взаимная подписка');
  });

  test('«•••» blocks them: the profile closes and is unavailable', async ({ page }) => {
    await joinAsMadina(page);
    await openM01FromFeed(page);
    await page.getByTestId('member-menu').click();
    await page.getByTestId('sheet-block').click();
    await expect(page.getByTestId('member-sheet')).toContainText(`Вы и ${m01.name}`);
    await page.getByTestId('sheet-confirm-block').click();
    await expect(page.getByTestId('toast')).toContainText('Автор заблокирован');
    await expect(page.getByTestId('screen-member')).toHaveCount(0);
    await page.goto('/member/m01');
    await expect(page.getByTestId('member-unavailable')).toContainText('Профиль недоступен');
  });

  test('«•••» reports them, and the form shows who', async ({ page }) => {
    await joinAsMadina(page);
    await openM01FromFeed(page);
    await page.getByTestId('member-menu').click();
    await page.getByTestId('sheet-report').click();
    await expect(page.getByTestId('report-target')).toContainText('Жалоба на участника');
    await expect(page.getByTestId('report-target')).toContainText(m01.name);
    await page.getByTestId('report-reason-harassment').click();
    await page.getByTestId('report-submit').click();
    await expect(page.getByTestId('report-sent')).toBeVisible();
    await page.getByTestId('report-block').click();
    await expect(page.getByTestId('toast')).toContainText('Автор заблокирован');
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('screen-member')).toHaveCount(0);
  });

  test('an author opens from a comment on the post screen', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/post/p01');
    await page.getByTestId('comment-c-p01-5').getByTestId('comment-author').first().click();
    await expect(page.getByTestId('screen-member')).toBeVisible();
    await expect(page.getByTestId('member-name')).toBeVisible();
  });

  test('an expired member sees the safe view and is offered Продление', async ({ page }) => {
    await joinAsMadina(page);
    await page.goto('/settings');
    await page.getByTestId('demo-expire').click();
    await expect(page.getByTestId('demo-restore')).toBeVisible();
    await page.goto('/member/m01');
    await expect(page.getByTestId('member-renew')).toBeVisible();
    await expect(page.getByTestId('member-card')).toHaveCount(0);
    await expect(page.getByTestId('member-follow')).toHaveCount(0);
    await expect(page.getByTestId('member-name')).not.toHaveText(m01.name);
    await expect(page.getByTestId('member-menu')).toBeVisible();
  });

  test('restricted people are unavailable; one’s own id opens the Profile tab', async ({
    page,
  }) => {
    await joinAsMadina(page);
    await page.goto('/member/m11');
    await expect(page.getByTestId('member-unavailable')).toBeVisible();
    await page.goto('/member/me-passport-3');
    await expect(page.getByTestId('screen-profile')).toBeVisible();
  });

  test('a guest is invited to join', async ({ page }) => {
    await page.goto('/member/m01');
    await expect(page.getByTestId('member-access-prompt')).toBeVisible();
  });
});
