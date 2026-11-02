import { z } from 'zod';

import { Id, IsoDateTime, Page } from './common';
import { LIMITS } from './limits';
import { AuthorView } from './people';
import { PhotoRef } from './photo';

/** Why a Контекстный чат exists: there are no chats out of nowhere. */
export const ChatContext = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('comment'), postId: Id, commentId: Id }),
  z.strictObject({ kind: z.literal('mutual_follow') }),
  z.strictObject({ kind: z.literal('plan_response'), planId: Id, responseId: Id }),
]);
export type ChatContext = z.infer<typeof ChatContext>;

/**
 * A Контекст чата as the viewer sees it now: a Встреча says whether it was cancelled (the
 * План cancelled or the chosen one stepped out), and a context whose source is gone (the
 * Комментарий deleted or hidden, the Подписка no longer mutual) reads as «Переписка».
 */
export const ChatContextView = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('comment'), postId: Id, commentId: Id }),
  z.strictObject({ kind: z.literal('mutual_follow') }),
  z.strictObject({
    kind: z.literal('plan_response'),
    planId: Id,
    responseId: Id,
    cancelled: z.boolean(),
  }),
  z.strictObject({ kind: z.literal('conversation') }),
]);
export type ChatContextView = z.infer<typeof ChatContextView>;
export type ChatContextKind = ChatContextView['kind'];

/** `failed` stays in the list with a retry; nothing is queued behind the user's back. */
export const MessageStatus = z.enum(['sent', 'read', 'failed']);
export type MessageStatus = z.infer<typeof MessageStatus>;

export const MessageView = z.strictObject({
  id: Id,
  chatId: Id,
  fromMe: z.boolean(),
  /** Empty when the message is a Фото alone. */
  text: z.string().max(LIMITS.messageText),
  /** One Фото; for active members, and always for its sender. */
  photo: PhotoRef.optional(),
  createdAt: IsoDateTime,
  status: MessageStatus,
});
export type MessageView = z.infer<typeof MessageView>;

export const ChatSummary = z.strictObject({
  id: Id,
  /** The latest of `contexts`. */
  context: ChatContextView,
  /** Every reason the two talk, newest first; one chat gathers them all. */
  contexts: z.array(ChatContextView).min(1),
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

/**
 * Reads a chat up to the message that was on screen (all of it without one); the mark
 * never moves back.
 */
export const MarkChatReadInput = z.strictObject({ chatId: Id, upToMessageId: Id.optional() });
export type MarkChatReadInput = z.infer<typeof MarkChatReadInput>;

/** Unread messages across all of the member's chats. */
export const UnreadCount = z.strictObject({ count: z.number().int().min(0) });
export type UnreadCount = z.infer<typeof UnreadCount>;

export const MessagesQuery = z.strictObject({
  chatId: Id,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type MessagesQuery = z.infer<typeof MessagesQuery>;

export const SendMessageInput = z
  .strictObject({
    chatId: Id,
    text: z.string().trim().max(LIMITS.messageText, 'too_long'),
    /** One of the sender's uploaded Фото. */
    photoId: Id.optional(),
    idempotencyKey: z.string().min(8),
  })
  .refine((m) => m.text.length > 0 || !!m.photoId, { message: 'required', path: ['text'] });
export type SendMessageInput = z.infer<typeof SendMessageInput>;

export const MessageRef = z.strictObject({ messageId: Id });
export type MessageRef = z.infer<typeof MessageRef>;

/**
 * Where a chat is opened from: someone else's Комментарий, a mutual Подписка or an
 * accepted Отклик. The server fills in the rest of the context; two people share one chat,
 * and a new context is added to it.
 */
export const OpenChatInput = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('comment'), commentId: Id }),
  z.strictObject({ kind: z.literal('mutual_follow'), memberId: Id }),
  z.strictObject({ kind: z.literal('plan_response'), responseId: Id }),
]);
export type OpenChatInput = z.infer<typeof OpenChatInput>;
