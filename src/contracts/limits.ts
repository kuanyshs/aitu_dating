/** Text limits shared by the client, the mock and the future backend. */
export const LIMITS = {
  postText: 1000,
  /** Posts published before the 1 000-character limit are read as they are. */
  storedPostText: 2000,
  planDescription: 500,
  /** «Где примерно» of a План. */
  placeArea: 120,
  commentText: 360,
  bio: 160,
  messageText: 2000,
  reportDetails: 500,
  appealText: 1000,
  supportText: 1000,
  /** Темы of one Пост or План. */
  topics: 2,
} as const;
