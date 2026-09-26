import { z } from 'zod';

/** Server-side preferences of a member; the theme stays on the device. */
export const NotificationSettings = z.strictObject({
  messages: z.boolean(),
  comments: z.boolean(),
  mentions: z.boolean(),
  follows: z.boolean(),
  planResponses: z.boolean(),
});
export type NotificationSettings = z.infer<typeof NotificationSettings>;

export const UserSettings = z.strictObject({ notifications: NotificationSettings });
export type UserSettings = z.infer<typeof UserSettings>;

export const UpdateSettingsInput = z.strictObject({
  notifications: NotificationSettings.partial(),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInput>;

export const defaultUserSettings = (): UserSettings => ({
  notifications: {
    messages: true,
    comments: true,
    mentions: true,
    follows: true,
    planResponses: true,
  },
});
