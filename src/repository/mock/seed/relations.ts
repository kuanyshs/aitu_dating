import { z } from 'zod';

import type {
  CommentRecord,
  FollowRecord,
  ReactionRecord,
  ReportRecord,
  RepostRecord,
} from '../records';
import { members } from './members';
import { postSpecs } from './posts';
import { hoursAfter, hoursAgo, seededRandom, shuffled } from './time';

type Follow = z.infer<typeof FollowRecord>;
type Reaction = z.infer<typeof ReactionRecord>;
type Repost = z.infer<typeof RepostRecord>;
type Report = z.infer<typeof ReportRecord>;

const memberIds = members.map((m) => m.id);

// Reactions and reposts are generated deterministically so feed counters are always
// derived from records. A post can be liked at most once by each other member, so
// the spec's target counts are capped by community size.
function pickUsers(postId: string, authorId: string, count: number, salt: number): string[] {
  const random = seededRandom([...postId].reduce((sum, ch) => sum + ch.charCodeAt(0), salt));
  const candidates = memberIds.filter((id) => id !== authorId);
  return shuffled(candidates, random).slice(0, Math.min(count, candidates.length));
}

export const reactions: Reaction[] = postSpecs.flatMap((post) =>
  pickUsers(post.id, post.authorId, post.likes, 1).map((userId, i) => ({
    userId,
    postId: post.id,
    createdAt: hoursAfter(post.createdAt, 0.5 + i * 0.25),
  })),
);

export const reposts: Repost[] = postSpecs.flatMap((post) =>
  pickUsers(post.id, post.authorId, post.repostCount, 7).map((userId, i) => ({
    userId,
    postId: post.id,
    createdAt: hoursAfter(post.createdAt, 1 + i * 0.5),
  })),
);

export const follows: Follow[] = [
  ['m01', 'm09'],
  ['m09', 'm01'],
  ['m02', 'm06'],
  ['m06', 'm02'],
  ['m03', 'm07'],
  ['m07', 'm03'],
  ['m04', 'm08'],
  ['m08', 'm04'],
  ['m10', 'm03'],
  ['m12', 'm01'],
  ['m06', 'm09'],
  ['m05', 'm07'],
].map(([followerId, followingId], i) => ({
  followerId: followerId as string,
  followingId: followingId as string,
  createdAt: hoursAgo(200 - i * 10),
}));

const rootTexts = [
  'Согласна, внимательность важнее заготовленного сценария.',
  'Для меня это всегда вопрос, который человек задаёт после паузы.',
  'Планирую заранее, но оставляю место для одного сюрприза.',
  'Хороший вопрос, сохраню себе.',
  'Звучит как отличный план, особенно в хорошую погоду.',
  'Я бы показал старые дворы в центре, там самые живые истории.',
  'Камерный концерт — можно молчать и всё равно быть вместе.',
  'Люблю такие форматы: понятно, чего ждать, и нет неловкости.',
  'Прогулка всегда, в движении разговор идёт легче.',
  'Добавлю в список маленький магазин у консерватории.',
  'Поддерживаю, честность снимает половину напряжения.',
  'Хочу научиться танцевать, но в одиночку не решаюсь.',
];

const replyTexts = [
  'Точно, и потом эта деталь становится общей шуткой.',
  'Интересно, а какой был самый удачный сюрприз?',
  'Спасибо, загляну на выходных.',
  'Согласен, в движении проще начать.',
  'Тогда давайте сделаем подборку в отдельном посте.',
  'Это очень про меня, особенно после работы.',
];

type ThreadSpec = [postId: string, roots: number, repliesPerRoot: number[]];

// 22 root comments + 33 replies = 55. Replies always answer a root comment.
const threads: ThreadSpec[] = [
  ['p01', 4, [3, 2, 1, 1]],
  ['p02', 4, [2, 2, 1, 1]],
  ['p04', 3, [2, 1, 1]],
  ['p06', 3, [2, 2, 0]],
  ['p09', 3, [3, 2, 1]],
  ['p-plan2', 2, [2, 1]],
  ['p12', 2, [1, 1]],
  ['p13', 1, [1]],
];

export const comments: CommentRecord[] = (() => {
  const random = seededRandom(42);
  const result: CommentRecord[] = [];
  let rootIndex = 0;
  let replyIndex = 0;

  for (const [postId, rootCount, repliesPerRoot] of threads) {
    const post = postSpecs.find((p) => p.id === postId);
    if (!post) throw new Error(`Unknown post ${postId}`);
    const authors = shuffled(
      memberIds.filter((id) => id !== 'm11'),
      random,
    );

    for (let r = 0; r < rootCount; r += 1) {
      const rootId = `c-${postId}-${r + 1}`;
      const rootAt = hoursAfter(post.createdAt, 1 + r);
      result.push({
        id: rootId,
        postId,
        authorId: authors[r % authors.length] as string,
        text: rootTexts[rootIndex % rootTexts.length] as string,
        createdAt: rootAt,
        deleted: false,
      });
      rootIndex += 1;

      for (let k = 0; k < (repliesPerRoot[r] ?? 0); k += 1) {
        result.push({
          id: `${rootId}-r${k + 1}`,
          postId,
          authorId: authors[(r + k + 1) % authors.length] as string,
          parentCommentId: rootId,
          text: replyTexts[replyIndex % replyTexts.length] as string,
          createdAt: hoursAfter(rootAt, 0.5 + k * 0.5),
          deleted: false,
        });
        replyIndex += 1;
      }
    }
  }
  return result;
})();

export const reports: Report[] = [
  {
    id: 'report1',
    reporterId: 'm01',
    targetType: 'post',
    targetId: 'p14',
    reason: 'spam',
    details: 'Зазывает во внешний канал.',
    status: 'resolved',
    createdAt: hoursAgo(11),
  },
  {
    id: 'report2',
    reporterId: 'm07',
    targetType: 'user',
    targetId: 'm11',
    reason: 'privacy',
    status: 'resolved',
    createdAt: hoursAgo(10),
  },
  {
    id: 'report3',
    reporterId: 'm02',
    targetType: 'comment',
    targetId: 'c-p06-1',
    reason: 'harassment',
    details: 'Резкий тон в ответе.',
    status: 'reviewing',
    createdAt: hoursAgo(20),
  },
  {
    id: 'report4',
    reporterId: 'm10',
    targetType: 'plan',
    targetId: 'plan5',
    reason: 'safety',
    details: 'Проверить, что место публичное.',
    status: 'created',
    createdAt: hoursAgo(5),
  },
  {
    id: 'report5',
    reporterId: 'm09',
    targetType: 'post',
    targetId: 'p10',
    reason: 'other',
    status: 'created',
    createdAt: hoursAgo(4),
  },
];
