// Russian labels for catalog keys. The only place catalog copy is written.
import type {
  ActivityCategory,
  CommunicationStyle,
  DatingIntent,
  Gender,
  Interest,
  MeetingFormat,
  MeetingGoal,
  MembershipTier,
  PaymentPolicy,
  PlanBudget,
  ChoiceQuestionKey,
  QuestionKey,
  QuestionnairePage,
  Topic,
} from './keys';
import { nationalityName, placeName } from './places';

export const genderLabels: Record<Gender, string> = {
  man: 'Мужчина',
  woman: 'Женщина',
};

export const interestLabels: Record<Interest, string> = {
  sport: 'Спорт и физическая активность',
  active_rest: 'Активный отдых и приключения',
  travel: 'Путешествия и туризм',
  art_culture: 'Искусство и культура',
  reading: 'Литература и чтение',
  cooking: 'Кулинария и гастрономия',
  photo_video: 'Фотография и видео',
  crafts: 'Творчество и рукоделие',
  digital_design: 'Дизайн и цифровое творчество',
  science: 'Наука и образование',
  technology: 'Технологии и инновации',
  languages: 'Изучение языков и культур',
  business: 'Бизнес и предпринимательство',
  finance: 'Финансы и инвестиции',
  games: 'Игры и развлечения',
  cars: 'Автомобили и мототехника',
  health: 'Здоровье и здоровый образ жизни',
  psychology: 'Психология и личностное развитие',
  beauty: 'Красота, стиль и уход за собой',
  home_garden: 'Дом, сад и хозяйство',
  pets: 'Животные и домашние питомцы',
  volunteering: 'Общественная деятельность и волонтёрство',
  spirituality: 'Духовность и религия',
  dance: 'Танцы и хореография',
  other: 'Свой вариант',
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
  friendship: 'Дружбу и общение',
  serious_relationship: 'Создание серьёзных отношений',
  marriage: 'Брак',
};

/** The Анкета «Вопросы о тебе», as the owner's document words it. */
export const questionLabels: Record<QuestionKey, string> = {
  nationality: 'Национальность',
  city: 'Где ты живёшь сейчас',
  intent: 'Что ты сейчас ищешь',
  familyPlans: 'Когда бы ты хотел(а) создать семью',
  maritalStatus: 'Какой у тебя сейчас семейный статус',
  children: 'Есть ли у тебя дети',
  childrenCount: 'Сколько у тебя детей',
  wantChildren: 'Хочешь ли ты детей',
  education: 'Какое у тебя образование',
  occupation: 'Чем ты сейчас занят(а)',
  incomeSource: 'Твой основной источник дохода',
  income: 'Какой у тебя ежемесячный доход',
  car: 'Есть ли у тебя автомобиль',
  housing: 'Какое у тебя сейчас жильё',
  livingWith: 'С кем ты сейчас живёшь',
  parents: 'Как ты относишься к совместному проживанию с родителями',
  habits: 'Какие привычки и образ жизни тебе близки',
  interests: 'Чем ты любишь заниматься в свободное время',
  interestOther: 'Свой вариант',
};

/** The same answers about another person: the profile and the «Кого ищу» filter. */
export const partnerQuestionLabels: Record<QuestionKey | 'gender' | 'age', string> = {
  gender: 'Пол',
  age: 'Возраст',
  nationality: 'Национальность',
  city: 'Где живёт',
  intent: 'Что ищет',
  familyPlans: 'Когда хотел(а) бы создать семью',
  maritalStatus: 'Семейный статус',
  children: 'Есть ли дети',
  childrenCount: 'Сколько детей',
  wantChildren: 'Отношение к детям',
  education: 'Образование',
  occupation: 'Чем занят(а)',
  incomeSource: 'Основной источник дохода',
  income: 'Ежемесячный доход',
  car: 'Автомобиль',
  housing: 'Жильё',
  livingWith: 'С кем живёт',
  parents: 'Совместное проживание с родителями',
  habits: 'Привычки и образ жизни',
  interests: 'Свободное время',
  interestOther: 'Свой вариант',
};

export const questionnairePageLabels: Record<QuestionnairePage, string> = {
  basics: 'Основное',
  relationship: 'Отношения',
  children: 'Дети',
  work: 'Учёба и работа',
  home: 'Быт',
  lifestyle: 'Образ жизни',
};

/** Option labels of the questions whose options are not another catalog. */
export const questionOptionLabels: Record<
  Exclude<ChoiceQuestionKey, 'intent' | 'interests' | 'childrenCount'>,
  Record<string, string>
> = {
  familyPlans: {
    within_2_years: 'В течение 1–2 лет',
    within_5_years: 'В течение 3–5 лет',
    no_plans: 'Нет таких планов',
  },
  maritalStatus: {
    never_married: 'Не был(а) в браке',
    divorced: 'В разводе',
    widowed: 'Вдовец / вдова',
    divorcing: 'В процессе развода',
    married: 'В браке',
  },
  children: {
    no: 'Нет',
    live_together: 'Да, живут вместе',
    live_apart: 'Да, живут отдельно',
  },
  wantChildren: {
    soon: 'Да, в ближайшее время',
    later: 'Да, но не в ближайшее время',
    no: 'Нет',
  },
  education: {
    secondary: 'Среднее',
    college: 'Колледж',
    bachelor: 'Бакалавриат',
    candidate: 'Кандидат наук',
    master: 'Магистратура',
    doctor: 'Доктор наук',
    doctoral_studies: 'Докторантура',
  },
  occupation: {
    study: 'Учеба',
    employed: 'Работа по найму',
    own_business: 'Свой бизнес',
    unemployed: 'Временно без работы',
  },
  incomeSource: {
    salary: 'Зарплата по найму',
    business: 'Свой бизнес',
    freelance: 'Фриланс',
    pension: 'Пенсия, пособие или стипендия',
    no_income: 'Пока нет дохода',
  },
  income: {
    none: 'Нет дохода',
    up_to_150k: 'До 150 000',
    '150k_250k': '150 000–250 000',
    '250k_400k': '250 000–400 000',
    '400k_600k': '400 000–600 000',
    '600k_1m': '600 000–1 000 000',
    '1m_1_5m': '1 000 000–1 500 000',
    '1_5m_2m': '1 500 000–2 000 000',
    over_2m: 'Более 2 000 000',
  },
  car: { yes: 'Да', no: 'Нет' },
  housing: {
    own: 'Собственное',
    rent: 'Аренда',
    service: 'Служебное жильё',
    dormitory: 'Общежитие',
  },
  livingWith: {
    alone: 'Один / одна',
    relatives: 'С родственниками',
    others: 'С другими людьми',
  },
  parents: { no: 'Точно нет', discussable: 'Обсуждается' },
  habits: {
    smoking_never: 'Курение никогда',
    smoking_sometimes: 'Курение иногда',
    alcohol_never: 'Алкоголь никогда',
    alcohol_sometimes: 'Алкоголь иногда',
    gambling_never: 'Азартные игры никогда',
    gambling_sometimes: 'Азартные игры иногда',
  },
};

/** «Нет детей» of «Сколько у тебя детей»; the other answers are numbers. */
export const noChildrenLabel = 'Нет детей';

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

export const planBudgetLabels: Record<PlanBudget, string> = {
  up_to_3000: 'До 3 000 ₸',
  from_3000_to_7000: '3 000–7 000 ₸',
  from_7000_to_15000: '7 000–15 000 ₸',
  over_15000: 'Больше 15 000 ₸',
  not_specified: 'Не указывать',
};

export const paymentPolicyLabels: Record<PaymentPolicy, string> = {
  each_pays: 'Каждый за себя',
  creator_pays: 'Автор встречи',
  agree_in_advance: 'Договориться заранее',
};

export const membershipTierLabels: Record<MembershipTier, string> = {
  paid: 'Платный',
};

export const activityCategoryLabels: Record<ActivityCategory, string> = {
  all: 'Все',
  follows: 'Подписки',
  conversations: 'Разговоры',
  mentions: 'Упоминания',
  reactions: 'Реакции',
  plans: 'Встречи',
  system: 'Системные',
};

/** The label of an Анкета answer; «Свой вариант» is its own text. */
export function answerLabel(question: QuestionKey, option: string): string {
  switch (question) {
    case 'nationality':
      return nationalityName(option) || option;
    case 'city':
      return placeName(option) || option;
    case 'intent':
      return datingIntentLabels[option as DatingIntent] ?? option;
    case 'interests':
      return interestLabels[option as Interest] ?? option;
    case 'childrenCount':
      return option === 'none' ? noChildrenLabel : option;
    case 'interestOther':
      return option;
    default:
      return questionOptionLabels[question][option] ?? option;
  }
}
