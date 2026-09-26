// Russian labels for catalog keys. The only place catalog copy is written.
import type {
  ActivityCategory,
  City,
  CommunicationStyle,
  DatingIntent,
  Gender,
  Interest,
  MeetingFormat,
  MeetingGoal,
  MembershipTier,
  PaymentPolicy,
  QuestionKey,
  Topic,
} from './keys';

export const cityLabels: Record<City, string> = {
  almaty: 'Алматы',
  astana: 'Астана',
  karaganda: 'Караганда',
  shymkent: 'Шымкент',
  other: 'Другой город',
};

export const genderLabels: Record<Gender, string> = {
  woman: 'Женщина',
  man: 'Мужчина',
  non_binary: 'Небинарная персона',
};

export const interestLabels: Record<Interest, string> = {
  coffee: 'кофе',
  cinema: 'кино',
  books: 'книги',
  sport: 'спорт',
  walks: 'прогулки',
  music: 'музыка',
  exhibitions: 'выставки',
  travel: 'путешествия',
  photo: 'фото',
};

export const topicLabels: Record<Topic, string> = {
  conversation: 'разговор',
  meetings: 'встречи',
  city: 'город',
  thoughts: 'мысли',
};

export const communicationStyleLabels: Record<CommunicationStyle, string> = {
  calm_dialogue: 'спокойный диалог',
  short_messages: 'короткие сообщения',
  voice_after_meeting: 'голосом после знакомства',
  common_topic_first: 'сначала общая тема',
};

export const datingIntentLabels: Record<DatingIntent, string> = {
  communication: 'Общение',
  dating: 'Свидания',
  friendship: 'Дружба',
  new_experiences: 'Новые впечатления',
};

export const questionLabels: Record<QuestionKey, string> = {
  city: 'В каком городе ты сейчас живёшь?',
  intent: 'Что ты сейчас ищешь?',
  communication: 'Как тебе комфортнее начинать общение?',
  pace: 'Какой темп знакомства тебе подходит?',
  firstMeeting: 'Как лучше провести первую встречу?',
  boundaries: 'Что важно для безопасного общения?',
  dateFormat: 'Какой формат встречи тебе ближе?',
};

/** Option labels for questions whose options are not another catalog. */
export const questionOptionLabels: Record<string, string> = {
  messages_first: 'С переписки',
  topic_comment_first: 'С комментария к теме',
  short_meeting_first: 'С короткой встречи',
  slow_pace: 'Не спеша',
  gradual: 'Постепенно',
  active_dialogue_first: 'Сначала активный диалог',
  meet_soon: 'Быстро перейти к встрече',
  coffee_talk: 'Кофе и разговор',
  exhibition_or_cinema: 'Выставка или кино',
  active_walk: 'Активная прогулка',
  public_place: 'Публичное место',
  agree_in_advance: 'Договориться заранее',
  respect_boundaries: 'Уважать личные границы',
  short_meeting: 'Короткая встреча',
  walk: 'Прогулка',
  joint_activity: 'Совместное занятие',
};

export const meetingFormatLabels: Record<MeetingFormat, string> = {
  coffee: 'Кофе',
  walk: 'Прогулка',
  cinema: 'Кино',
  exhibition: 'Выставка',
  dinner: 'Ужин',
  other: 'Другое',
};

export const meetingGoalLabels: Record<MeetingGoal, string> = {
  get_acquainted: 'Познакомиться',
  talk: 'Поговорить',
  joint_activity: 'Совместное занятие',
};

export const paymentPolicyLabels: Record<PaymentPolicy, string> = {
  each_pays: 'Каждый за себя',
  creator_pays: 'Создатель плана',
  agree_in_advance: 'Договориться заранее',
};

export const membershipTierLabels: Record<MembershipTier, string> = {
  free_verified: 'Бесплатный verified',
  paid: 'Платный',
};

export const activityCategoryLabels: Record<ActivityCategory, string> = {
  all: 'Все',
  follows: 'Подписки',
  conversations: 'Разговоры',
  mentions: 'Упоминания',
  reactions: 'Реакции',
  plans: 'Планы',
  system: 'Системные',
};
