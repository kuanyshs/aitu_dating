// Stable latin keys for every reference value. Keys are what code, storage and the API
// carry; Russian labels live separately in labels.ts. Source: catalogs.json of the
// gap-resolution package.

/** Пол from Aitu Passport; the Анкета offers exactly these two. */
export const genders = ['woman', 'man'] as const;
export type Gender = (typeof genders)[number];

/** «Чем ты любишь заниматься в свободное время»: the Анкета's interests, «Свой вариант» last. */
export const interests = [
  'sport',
  'active_rest',
  'travel',
  'art_culture',
  'reading',
  'cooking',
  'photo_video',
  'crafts',
  'digital_design',
  'science',
  'technology',
  'languages',
  'business',
  'finance',
  'games',
  'cars',
  'health',
  'psychology',
  'beauty',
  'home_garden',
  'pets',
  'volunteering',
  'spirituality',
  'dance',
  'other',
] as const;
export type Interest = (typeof interests)[number];

export const topics = ['conversation', 'meetings', 'city', 'thoughts'] as const;
export type Topic = (typeof topics)[number];

export const communicationStyles = [
  'calm_dialogue',
  'short_messages',
  'voice_after_meeting',
  'common_topic_first',
] as const;
export type CommunicationStyle = (typeof communicationStyles)[number];

/** Намерение: «Что ты сейчас ищешь». */
export const datingIntents = ['friendship', 'serious_relationship', 'marriage'] as const;
export type DatingIntent = (typeof datingIntents)[number];

/** «Сколько у тебя детей»: «Нет детей» or a number from 1 to 20. */
export const MAX_CHILDREN = 20;
export const childrenCounts = [
  'none',
  ...Array.from({ length: MAX_CHILDREN }, (_, i) => String(i + 1)),
] as [string, ...string[]];

/** The habits come in pairs: «никогда» and «иногда» of one habit exclude each other. */
export const habits = [
  'smoking_never',
  'smoking_sometimes',
  'alcohol_never',
  'alcohol_sometimes',
  'gambling_never',
  'gambling_sometimes',
] as const;
export type Habit = (typeof habits)[number];
/** The habit an option is about: «smoking», «alcohol» or «gambling». */
export const habitOf = (option: string) => option.slice(0, option.indexOf('_'));

/**
 * The Анкета «Вопросы о тебе» (owner's document, block 1). Пол and возраст come from
 * Aitu Passport and are not questions here. «Национальность» takes a code of the BNS list
 * (nationalities.ts), «Где ты живёшь» KATO codes and countries (places.ts), and
 * «Свой вариант» of the interests its own text.
 */
export const questionnaire = {
  intent: datingIntents,
  familyPlans: ['within_2_years', 'within_5_years', 'no_plans'],
  maritalStatus: ['never_married', 'divorced', 'widowed', 'divorcing', 'married'],
  children: ['no', 'live_together', 'live_apart'],
  childrenCount: childrenCounts,
  wantChildren: ['soon', 'later', 'no'],
  education: [
    'secondary',
    'college',
    'bachelor',
    'candidate',
    'master',
    'doctor',
    'doctoral_studies',
  ],
  occupation: ['study', 'employed', 'own_business', 'unemployed'],
  incomeSource: ['salary', 'business', 'freelance', 'pension', 'no_income'],
  income: [
    'none',
    'up_to_150k',
    '150k_250k',
    '250k_400k',
    '400k_600k',
    '600k_1m',
    '1m_1_5m',
    '1_5m_2m',
    'over_2m',
  ],
  car: ['yes', 'no'],
  housing: ['own', 'rent', 'service', 'dormitory'],
  livingWith: ['alone', 'relatives', 'others'],
  parents: ['no', 'discussable'],
  habits,
  interests,
} as const;
export type ChoiceQuestionKey = keyof typeof questionnaire;
export const choiceQuestionKeys = Object.keys(questionnaire) as ChoiceQuestionKey[];
/** Every answer of the Анкета; «interestOther» is the text of «Свой вариант». */
export type QuestionKey = 'nationality' | 'city' | ChoiceQuestionKey | 'interestOther';
export const questionKeys: QuestionKey[] = [
  'nationality',
  'city',
  ...choiceQuestionKeys,
  'interestOther',
];

/** How many options each question takes. */
export const QUESTION_MAX: Record<QuestionKey, number> = {
  nationality: 1,
  city: 3,
  intent: datingIntents.length,
  familyPlans: 1,
  maritalStatus: 1,
  children: 1,
  childrenCount: 1,
  wantChildren: 1,
  education: questionnaire.education.length,
  occupation: questionnaire.occupation.length,
  incomeSource: questionnaire.incomeSource.length,
  income: 1,
  car: 1,
  housing: 1,
  livingWith: 1,
  parents: questionnaire.parents.length,
  habits: 3,
  interests: 10,
  interestOther: 1,
};

/** «Свой вариант»: its text. */
export const INTEREST_OTHER_MAX = 40;

/**
 * The six pages of the Анкета during onboarding and the sections of «Редактировать
 * анкету». The first page also shows Пол and возраст from Passport.
 */
export const questionnairePages = [
  { key: 'basics', questions: ['nationality', 'city'] },
  { key: 'relationship', questions: ['intent', 'familyPlans', 'maritalStatus'] },
  { key: 'children', questions: ['children', 'childrenCount', 'wantChildren'] },
  { key: 'work', questions: ['education', 'occupation', 'incomeSource', 'income'] },
  { key: 'home', questions: ['car', 'housing', 'livingWith', 'parents'] },
  { key: 'lifestyle', questions: ['habits', 'interests', 'interestOther'] },
] as const satisfies readonly { key: string; questions: readonly QuestionKey[] }[];
export type QuestionnairePage = (typeof questionnairePages)[number]['key'];

/** Answers only the owner and search see: never shown in someone else's profile. */
export const privateQuestions: readonly QuestionKey[] = ['incomeSource', 'income'];

export const meetingFormats = [
  'coffee',
  'walk',
  'cinema',
  'exhibition',
  'dinner',
  'other',
] as const;
export type MeetingFormat = (typeof meetingFormats)[number];

export const meetingDurations = [30, 60, 90, 120] as const;
export type MeetingDuration = (typeof meetingDurations)[number];

/** Цель встречи: why a specific plan exists. */
export const meetingGoals = ['get_acquainted', 'talk', 'joint_activity'] as const;
export type MeetingGoal = (typeof meetingGoals)[number];

export const paymentPolicies = ['each_pays', 'creator_pays', 'agree_in_advance'] as const;
export type PaymentPolicy = (typeof paymentPolicies)[number];

/** Бюджет: approximate spend per person on a План. */
export const planBudgets = [
  'up_to_3000',
  'from_3000_to_7000',
  'from_7000_to_15000',
  'over_15000',
  'not_specified',
] as const;
export type PlanBudget = (typeof planBudgets)[number];

/** Shared by the plan builder, search filters and the plan card; never duplicate these lists. */
export const meetingCatalog = {
  formats: meetingFormats,
  durations: meetingDurations,
  goals: meetingGoals,
  paymentPolicies,
  budgets: planBudgets,
} as const;

export const membershipTiers = ['paid'] as const;
export type MembershipTier = (typeof membershipTiers)[number];

export const membershipOffers = [
  { tier: 'paid', periodMonths: 1, priceKzt: 1990 },
  { tier: 'paid', periodMonths: 3, priceKzt: 4990, badge: 'best_value' },
  { tier: 'paid', periodMonths: 6, priceKzt: 8490 },
  { tier: 'paid', periodMonths: 12, priceKzt: 14990 },
] as const;

export const activityCategories = [
  'all',
  'follows',
  'conversations',
  'mentions',
  'reactions',
  'plans',
  'system',
] as const;
export type ActivityCategory = (typeof activityCategories)[number];
