import { z } from 'zod';

import { Id, IsoDateTime, Page } from './common';
import { LIMITS } from './limits';
import { AuthorView } from './people';

/** Why a Контекстный чат exists: there are no chats out of nowhere. */
export const ChatContext = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('comment'), postId: Id, commentId: Id }),
  z.strictObject({ kind: z.literal('mutual_follow') }),
  z.strictObject({ kind: z.literal('plan_response'), planId: Id, responseId: Id }),
]);
export type ChatContext = z.infer<typeof ChatContext>;

/** `failed` stays in the list with a retry; nothing is queued behind the user's back. */
export const MessageStatus = z.enum(['sent', 'read', 'failed']);
export type MessageStatus = z.infer<typeof MessageStatus>;

export const MessageView = z.strictObject({
  id: Id,
  chatId: Id,
  fromMe: z.boolean(),
  text: z.string().min(1).max(LIMITS.messageText),
  createdAt: IsoDateTime,
  status: MessageStatus,
});
export type MessageView = z.infer<typeof MessageView>;

export const ChatSummary = z.strictObject({
  id: Id,
  context: ChatContext,
  peer: AuthorView,
  lastMessage: MessageView.optional(),
  unreadCount: z.number().int().min(0),
  /** Expired members read their chats but cannot write. */
  readOnly: z.boolean(),
});
export type ChatSummary = z.infer<typeof ChatSummary>;

export const ChatPage = Page(ChatSummary);
export type ChatPage = z.infer<typeof ChatPage>;

export const MessagePage = Page(MessageView);
export type MessagePage = z.infer<typeof MessagePage>;

export const ListQuery = z.strictObject({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;

export const ChatRef = z.strictObject({ chatId: Id });
export type ChatRef = z.infer<typeof ChatRef>;

export const MessagesQuery = z.strictObject({
  chatId: Id,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type MessagesQuery = z.infer<typeof MessagesQuery>;

export const SendMessageInput = z.strictObject({
  chatId: Id,
  text: z.string().trim().min(1, 'required').max(LIMITS.messageText, 'too_long'),
  idempotencyKey: z.string().min(8),
});
export type SendMessageInput = z.infer<typeof SendMessageInput>;

export const MessageRef = z.strictObject({ messageId: Id });
export type MessageRef = z.infer<typeof MessageRef>;
