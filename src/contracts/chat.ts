import { z } from 'zod';

import { Id, IsoDateTime, Page } from './common';
import { LIMITS } from './limits';
import { AuthorView } from './people';
import { PhotoRef } from './photo';
import { PlanSummary } from './post';
import { VoiceRef } from './voice';

/**
 * How a pair's chat came about. `direct`: one wrote to the other from a profile or a
 * Встреча, with nothing else needed (задание v4: anyone verified writes to anyone).
 */
export const ChatContext = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('direct') }),
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

/**
 * Where a Встреча in a chat stands for the two who see it, worked out each time it is
 * shown: the Запрос, then the Встреча itself.
 */
export const MeetingCardState = z.enum([
  /** A shared Встреча still taking Запросы. */
  'open',
  /** A shared Встреча whose author closed it. */
  'closed',
  'requested',
  'matched',
  'declined',
  'withdrawn',
  'cancelled',
  'deleted',
  'past',
  'unavailable',
]);
export type MeetingCardState = z.infer<typeof MeetingCardState>;

/**
 * A Встреча as a card in a chat: put there by a Запрос, or shared («Поделиться»). The
 * exact place is never in it; details are left out once it is deleted or out of reach.
 */
export const MeetingCard = z.strictObject({
  kind: z.enum(['request', 'share']),
  planId: Id,
  state: MeetingCardState,
  plan: PlanSummary.optional(),
  /** The Встреча's Фото, for active members only. */
  photo: PhotoRef.optional(),
});
export type MeetingCard = z.infer<typeof MeetingCard>;

export const MessageView = z.strictObject({
  id: Id,
  chatId: Id,
  fromMe: z.boolean(),
  /** Empty when the message is a Фото alone. */
  text: z.string().max(LIMITS.messageText),
  /** One Фото; for active members, and always for its sender. */
  photo: PhotoRef.optional(),
  /** A voice message; for active members, and always for its sender. */
  voice: VoiceRef.optional(),
  /** A Встреча this message carries; its text, if any, is what came with the Запрос. */
  meeting: MeetingCard.optional(),
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
    /** One of the sender's recorded voice messages; it goes on its own. */
    voiceId: Id.optional(),
    idempotencyKey: z.string().min(8),
  })
  .refine((m) => m.text.length > 0 || !!m.photoId || !!m.voiceId, {
    message: 'required',
    path: ['text'],
  });
export type SendMessageInput = z.infer<typeof SendMessageInput>;

export const MessageRef = z.strictObject({ messageId: Id });
export type MessageRef = z.infer<typeof MessageRef>;

/**
 * Where a chat is opened from: a person («Написать сообщение», «Перейти в чат»), someone
 * else's Комментарий, a mutual Подписка or an accepted Запрос. Two people share one chat:
 * an existing one is opened, a new reason is added to it.
 */
export const OpenChatInput = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('member'), memberId: Id }),
  z.strictObject({ kind: z.literal('comment'), commentId: Id }),
  z.strictObject({ kind: z.literal('mutual_follow'), memberId: Id }),
  z.strictObject({ kind: z.literal('plan_response'), responseId: Id }),
]);
export type OpenChatInput = z.infer<typeof OpenChatInput>;

/**
 * «Поделиться в Aitu Dating»: a Встреча sent as a card to someone (`memberId`) or into an
 * open chat (`chatId`), always the pair's one chat, with an optional note.
 */
export const ShareMeetingInput = z
  .strictObject({
    planId: Id,
    memberId: Id.optional(),
    chatId: Id.optional(),
    message: z.string().trim().max(LIMITS.messageText, 'too_long').optional(),
    idempotencyKey: z.string().min(8),
  })
  .refine((s) => !!s.memberId !== !!s.chatId, {
    message: 'Exactly one recipient',
    path: ['memberId'],
  });
export type ShareMeetingInput = z.infer<typeof ShareMeetingInput>;

/** Who a Встреча can be sent to: people one may write to, by name or Населённый пункт. */
export const ShareRecipientsQuery = z.strictObject({
  text: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type ShareRecipientsQuery = z.infer<typeof ShareRecipientsQuery>;
