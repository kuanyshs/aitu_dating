import type { ChatReadRecord, ChatRecord, MessageRecord } from '../records';
import { comments } from './relations';
import { hoursAgo } from './time';

// Three Контекстные чаты between seed members. m01 is in two of them: with m09 (a mutual
// Подписка, two messages unread) and with the author of a comment on p01 (all read).

const commenter = comments.find(
  (c) => c.postId === 'p01' && !c.parentCommentId && !c.deleted && c.authorId !== 'm01',
);
if (!commenter) throw new Error('Seed has no comment on p01 by someone else');

export const chats: ChatRecord[] = [
  {
    id: 'chat1',
    memberIds: ['m01', 'm09'],
    context: { kind: 'mutual_follow' },
    createdAt: hoursAgo(30),
  },
  {
    id: 'chat2',
    memberIds: ['m01', commenter.authorId],
    context: { kind: 'comment', postId: 'p01', commentId: commenter.id },
    createdAt: hoursAgo(50),
  },
  {
    id: 'chat3',
    memberIds: ['m02', 'm06'],
    context: { kind: 'mutual_follow' },
    createdAt: hoursAgo(70),
  },
];

type Line = [authorIndex: 0 | 1, hoursAgo: number, text: string];

const lines: Record<string, Line[]> = {
  chat1: [
    [1, 29, 'Привет! Видела твой пост про кофейни, у меня есть пара мест в запасе.'],
    [0, 28, 'Привет! Рассказывай, я как раз ищу, где спокойно посидеть.'],
    [1, 27, 'Маленькая кофейня у консерватории: тихо, и музыка слышна из окон.'],
    [1, 3, 'Кстати, в субботу там будет камерный вечер.'],
    [1, 2, 'Если захочешь, можем сходить вместе.'],
  ],
  chat2: [
    [0, 49, 'Спасибо за комментарий, очень точно сказано.'],
    [1, 48, 'Рада, что откликнулось. Мне тоже близка эта мысль.'],
    [0, 47, 'Может, продолжим разговор за кофе как-нибудь?'],
  ],
  chat3: [
    [0, 69, 'Привет! Как прошла выставка?'],
    [1, 68, 'Отлично, особенно зал с фотографией.'],
    [0, 20, 'Хочу тоже сходить, подскажешь, когда меньше людей?'],
    [1, 19, 'Будни с утра, почти никого.'],
  ],
};

export const messages: MessageRecord[] = chats.flatMap((chat) =>
  (lines[chat.id] ?? []).map(([who, hours, text], i) => ({
    id: `${chat.id}-m${i + 1}`,
    chatId: chat.id,
    authorId: chat.memberIds[who],
    text,
    createdAt: hoursAgo(hours),
    status: 'sent' as const,
  })),
);

/** Everyone has read everything, except m01, who has not seen m09's last two messages. */
export const chatReads: ChatReadRecord[] = chats.flatMap((chat) =>
  chat.memberIds.map((userId) => ({
    chatId: chat.id,
    userId,
    readAt: chat.id === 'chat1' && userId === 'm01' ? hoursAgo(26) : hoursAgo(1),
  })),
);
