// Stable latin keys for every reference value. Keys are what code, storage and the API
// carry; Russian labels live separately in labels.ts. Source: catalogs.json of the
// gap-resolution package.

export const cities = ['almaty', 'astana', 'karaganda', 'shymkent', 'other'] as const;
export type City = (typeof cities)[number];

export const genders = ['woman', 'man', 'non_binary'] as const;
export type Gender = (typeof genders)[number];

export const interests = [
  'coffee',
  'cinema',
  'books',
  'sport',
  'walks',
  'music',
  'exhibitions',
  'travel',
  'photo',
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

/** Намерение: what a person is looking for in the community. */
export const datingIntents = ['communication', 'dating', 'friendship', 'new_experiences'] as const;
export type DatingIntent = (typeof datingIntents)[number];

export const questionnaire = {
  city: cities,
  intent: datingIntents,
  communication: ['messages_first', 'topic_comment_first', 'short_meeting_first', 'slow_pace'],
  pace: ['gradual', 'active_dialogue_first', 'meet_soon'],
  firstMeeting: ['coffee_talk', 'exhibition_or_cinema', 'active_walk'],
  boundaries: ['public_place', 'agree_in_advance', 'respect_boundaries'],
  dateFormat: ['short_meeting', 'walk', 'joint_activity'],
} as const;
export type QuestionKey = keyof typeof questionnaire;
export const questionKeys = Object.keys(questionnaire) as QuestionKey[];

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

/** Shared by the plan builder, search filters and the plan card; never duplicate these lists. */
export const meetingCatalog = {
  formats: meetingFormats,
  durations: meetingDurations,
  goals: meetingGoals,
  paymentPolicies,
} as const;

export const membershipTiers = ['free_verified', 'paid'] as const;
export type MembershipTier = (typeof membershipTiers)[number];

export const membershipOffers = [
  { tier: 'free_verified', periodMonths: 12, priceKzt: 0 },
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
