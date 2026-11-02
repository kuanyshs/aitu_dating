/** Text limits shared by the client, the mock and the future backend. */
export const LIMITS = {
  postText: 2000,
  planDescription: 500,
  /** «Где примерно» of a План. */
  placeArea: 120,
  commentText: 360,
  bio: 160,
  messageText: 2000,
  reportDetails: 500,
  /** Темы of one Пост or План. */
  topics: 2,
} as const;
