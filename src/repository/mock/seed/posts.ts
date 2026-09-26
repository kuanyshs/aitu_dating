import type { PostRecord } from '../records';
import { plans } from './plans';
import { hoursAgo } from './time';

// Twenty posts: six plan posts (one per plan), a quote, questions, a long and a very
// short text, one with media and one by a restricted member. No text mentions a
// member by name, so guest pages can be checked for name leaks.

type PostSpec = PostRecord & { likes: number; repostCount: number };

const planPosts: PostSpec[] = [
  {
    id: 'p-plan1',
    authorId: 'm06',
    type: 'plan',
    text: 'Кто со мной на утренний кофе в воскресенье? Без анкет и сценариев, просто поговорить.',
    topics: ['meetings', 'city'],
    likes: 7,
    repostCount: 1,
  },
  {
    id: 'p-plan2',
    authorId: 'm03',
    type: 'plan',
    text: 'Ищу компанию на выставку: интереснее обсуждать увиденное, чем просто сделать фото.',
    topics: ['meetings', 'thoughts'],
    likes: 9,
    repostCount: 2,
  },
  {
    id: 'p-plan3',
    authorId: 'm04',
    type: 'plan',
    text: 'Вечерняя прогулка по парку. Темп спокойный, маршрут обсудим на месте.',
    topics: ['meetings'],
    likes: 4,
    repostCount: 0,
  },
  {
    id: 'p-plan4',
    authorId: 'm09',
    type: 'plan',
    text: 'Вечерний сеанс в среду, билеты беру на себя. Жанр выберем вместе.',
    topics: ['meetings', 'city'],
    likes: 11,
    repostCount: 1,
  },
  {
    id: 'p-plan5',
    authorId: 'm10',
    type: 'plan',
    text: 'Полчаса кофе перед работой — идеальный формат для первого знакомства.',
    topics: ['meetings'],
    likes: 3,
    repostCount: 0,
  },
  {
    id: 'p-plan6',
    authorId: 'm08',
    type: 'plan',
    text: 'Фотопрогулка по центру на плёнку. Опыт не нужен, камеры хватит на двоих.',
    topics: ['meetings', 'city'],
    likes: 6,
    repostCount: 2,
  },
].map((post, index) => {
  const plan = plans[index];
  if (!plan) throw new Error(`Missing plan for ${post.id}`);
  return { ...post, type: 'plan', planId: plan.id, createdAt: plan.createdAt } as PostSpec;
});

const regularPosts: PostSpec[] = [
  {
    id: 'p01',
    authorId: 'm01',
    type: 'post',
    text: 'Самые хорошие разговоры начинаются не с идеального вопроса, а с внимательного ответа. Что помогает вам почувствовать контакт с человеком?',
    topics: ['conversation', 'thoughts'],
    createdAt: hoursAgo(3),
    likes: 18,
    repostCount: 3,
  },
  {
    id: 'p02',
    authorId: 'm07',
    type: 'question',
    text: 'Вы скорее планируете первую встречу заранее или оставляете место для импровизации?',
    topics: ['meetings', 'conversation'],
    createdAt: hoursAgo(6),
    likes: 22,
    repostCount: 4,
  },
  {
    id: 'p03',
    authorId: 'm02',
    type: 'post',
    text: 'Утренний чай без телефона — маленький ритуал, который собирает весь день.',
    topics: ['thoughts'],
    createdAt: hoursAgo(9),
    likes: 8,
    repostCount: 0,
  },
  {
    id: 'p04',
    authorId: 'm03',
    type: 'question',
    text: 'Какое место в городе вы бы показали человеку, который приехал впервые?',
    topics: ['city', 'conversation'],
    createdAt: hoursAgo(14),
    likes: 15,
    repostCount: 2,
  },
  {
    id: 'p05',
    authorId: 'm09',
    type: 'post',
    text: 'Сегодня на выставке поймала себя на мысли, что лучшие работы — те, о которых хочется рассказать кому-то сразу после выхода из зала.',
    topics: ['thoughts', 'city'],
    createdAt: hoursAgo(18),
    mediaKey: 'media-exhibition',
    likes: 14,
    repostCount: 1,
  },
  {
    id: 'p06',
    authorId: 'm04',
    type: 'post',
    text: 'Иногда честное «я волнуюсь» звучит увереннее любой заготовленной фразы.',
    topics: ['conversation', 'thoughts'],
    createdAt: hoursAgo(26),
    likes: 20,
    repostCount: 5,
  },
  {
    id: 'p07',
    authorId: 'm10',
    type: 'question',
    text: 'Какой навык вы бы с удовольствием освоили вместе с кем-то?',
    topics: ['conversation'],
    createdAt: hoursAgo(33),
    likes: 5,
    repostCount: 0,
  },
  {
    id: 'p08',
    authorId: 'm06',
    type: 'post',
    text: 'Да.',
    topics: ['thoughts'],
    createdAt: hoursAgo(40),
    likes: 2,
    repostCount: 0,
  },
  {
    id: 'p09',
    authorId: 'm07',
    type: 'post',
    text: 'Долго думала, почему некоторые знакомства остаются в памяти, а другие растворяются через неделю. Кажется, дело не в том, насколько эффектным было начало, а в том, остался ли после разговора вопрос, к которому хочется вернуться. Когда человек запоминает деталь, о которой ты сказал мимоходом, и через несколько дней спрашивает, как всё прошло, — это и есть тот самый контакт. Не нужно быть интересным собеседником каждую минуту. Достаточно быть внимательным. Поэтому мне так нравится формат, где знакомство начинается с темы, а не с фотографии: в нём есть время услышать друг друга. А вы замечали, что именно заставляет вас продолжить разговор?',
    topics: ['conversation', 'thoughts'],
    createdAt: hoursAgo(50),
    likes: 31,
    repostCount: 6,
  },
  {
    id: 'p10',
    authorId: 'm12',
    type: 'question',
    text: 'Посоветуйте тихое место в центре, где можно поговорить после работы.',
    topics: ['city'],
    createdAt: hoursAgo(58),
    likes: 4,
    repostCount: 0,
  },
  {
    id: 'p11',
    authorId: 'm08',
    type: 'quote',
    text: 'Подписываюсь под каждым словом. Внимательность — недооценённый навык.',
    topics: ['conversation'],
    createdAt: hoursAgo(2),
    quotedPostId: 'p01',
    likes: 6,
    repostCount: 0,
  },
  {
    id: 'p12',
    authorId: 'm02',
    type: 'question',
    text: 'Что выбираете для первого вечера: камерный концерт, прогулку или разговор за кофе?',
    topics: ['meetings'],
    createdAt: hoursAgo(70),
    likes: 12,
    repostCount: 1,
  },
  {
    id: 'p13',
    authorId: 'm01',
    type: 'post',
    text: 'Составляю список небольших книжных магазинов города. Дополняйте в ответах.',
    topics: ['city'],
    createdAt: hoursAgo(84),
    likes: 9,
    repostCount: 3,
  },
  {
    id: 'p14',
    authorId: 'm11',
    type: 'post',
    text: 'Пишите мне в личку, дам ссылку на закрытый канал.',
    topics: ['conversation'],
    createdAt: hoursAgo(12),
    likes: 1,
    repostCount: 0,
  },
];

export const postSpecs: PostSpec[] = [...regularPosts, ...planPosts];

export const posts: PostRecord[] = postSpecs.map(
  ({ likes: _likes, repostCount: _reposts, ...post }) => post,
);
