import { expect, test } from '@playwright/test';

import { loadSeed } from '../src/repository/mock/seed';

import { joinAsMadina } from './helpers';

const seed = loadSeed();
const count = <T extends { postId?: string; commentId?: string }>(rows: T[], id: string) =>
  rows.filter((r) => r.postId === id || r.commentId === id).length;
const aliveOnP02 = seed.comments.filter((c) => c.postId === 'p02' && !c.deleted).length;

/** The spec «Пост и ответы» end to end: open, reply, like a reply, delete it, repost. */
test('a member opens a post, replies, likes a reply, deletes their own and reposts', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'layout-independent rule');
  test.setTimeout(90_000);
  await joinAsMadina(page);

  // Open the post from the feed.
  await page.getByTestId('post-p02').getByTestId('post-open').click();
  await expect(page.getByTestId('post-replies-count')).toHaveText(`Ответы · ${aliveOnP02}`);

  // Reply to the most popular comment.
  const thread = page
    .getByTestId('comment-thread')
    .filter({ has: page.getByTestId('comment-c-p02-2') });
  await page.getByTestId('comment-c-p02-2').getByTestId('comment-reply').click();
  await expect(page.getByTestId('reply-context')).toBeVisible();
  await page.getByTestId('reply-input').fill('Поддерживаю, это снимает напряжение.');
  await page.getByTestId('reply-submit').click();
  await expect(page.getByTestId('screen-reply')).toHaveCount(0);
  await expect(page.getByTestId('toast')).toContainText('Ответ опубликован');
  await expect(page.getByTestId('post-replies-count')).toHaveText(`Ответы · ${aliveOnP02 + 1}`);
  const mine = page
    .getByRole('article')
    .filter({ hasText: 'Поддерживаю, это снимает напряжение.' });
  await expect(mine).toBeVisible();

  // Like someone else's reply in the same thread.
  const reply = page.getByTestId('comment-c-p02-2-r1');
  const likes = count(seed.commentReactions, 'c-p02-2-r1');
  await reply.getByTestId('comment-like').click();
  await expect(reply.getByTestId('comment-like')).toHaveAttribute('aria-pressed', 'true');
  await expect(reply.getByTestId('comment-like')).toHaveAttribute(
    'aria-label',
    `Нравится: ${likes + 1}`,
  );

  // Delete the own reply.
  await mine.getByTestId('comment-menu').click();
  await page.getByTestId('sheet-delete').click();
  await page.getByTestId('sheet-confirm-delete').click();
  await expect(mine).toHaveCount(0);
  await expect(page.getByTestId('post-replies-count')).toHaveText(`Ответы · ${aliveOnP02}`);
  await expect(thread.getByTestId('comment-c-p02-2-r1')).toBeVisible();

  // Repost the post.
  const repost = page.getByTestId('screen-post').getByTestId('post-repost');
  await repost.click();
  await expect(repost).toHaveAttribute('aria-pressed', 'true');
  await expect(repost).toHaveAttribute('aria-label', `Репосты: ${count(seed.reposts, 'p02') + 1}`);
});
