import type { AccessState } from '@/contracts';

/** What a tap on a social action (like, repost, reply, quote) does for this session. */
export type SocialGate = 'allow' | 'access' | 'renew' | 'wait';

/**
 * Active members act; expired members are sent to Продление, everyone else to the
 * single access flow. While the session is still loading the tap is ignored: taking
 * the viewer for a guest would send a member into the access flow, which closes
 * straight back to Home and loses both the screen and the action.
 */
export function socialGate(accessState: AccessState | undefined): SocialGate {
  if (accessState === undefined) return 'wait';
  if (accessState === 'ACTIVE_MEMBER') return 'allow';
  if (accessState === 'ACTIVE_MEMBER_EXPIRED') return 'renew';
  return 'access';
}
