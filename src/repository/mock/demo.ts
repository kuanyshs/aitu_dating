import { z } from 'zod';

import { AccessFlowStep, MembershipSelection, PaymentReceipt } from '@/contracts';

/**
 * Mock-only switches for demos and QA. They live next to the mock backend, not in the
 * product contract: a real backend has no «fail the next request» button.
 */
export const DemoFlags = z.strictObject({
  /** The next data request fails with NETWORK_ERROR, then the flag clears itself. */
  networkErrorOnce: z.boolean(),
  /** Every data request fails with NETWORK_ERROR until switched off. */
  offline: z.boolean(),
  /** The next message send fails (used by the chats ticket). */
  failedMessageOnce: z.boolean(),
});
export type DemoFlags = z.infer<typeof DemoFlags>;

export const defaultDemoFlags = (): DemoFlags => ({
  networkErrorOnce: false,
  offline: false,
  failedMessageOnce: false,
});

/** Server-side record of the visitor's progress through the access flow. */
export const AccessFlowRecord = z.strictObject({
  step: AccessFlowStep,
  candidateId: z.string().optional(),
  rulesAcceptedVersion: z.string().optional(),
  membership: MembershipSelection.optional(),
  payment: PaymentReceipt.optional(),
});
export type AccessFlowRecord = z.infer<typeof AccessFlowRecord>;

/** Persisted mutable state of the mock backend. Later tickets add created records here. */
export const MockState = z.strictObject({
  demoFlags: DemoFlags,
  accessFlow: AccessFlowRecord.nullable(),
  /** Completed mock checkouts by idempotency key, so a retried request is not charged twice. */
  payments: z.record(z.string(), PaymentReceipt),
});
export type MockState = z.infer<typeof MockState>;

export const MOCK_STATE_VERSION = 2;

/** v1 held only demo flags; v2 adds the access flow and mock payments. */
export const mockStateMigrations = [
  (v1: unknown) => ({ ...(v1 as object), accessFlow: null, payments: {} }),
];

export const defaultMockState = (): MockState => ({
  demoFlags: defaultDemoFlags(),
  accessFlow: null,
  payments: {},
});

export type ResetNotice = 'corrupt' | 'unsupported_version' | 'invalid';

export interface DemoControls {
  getDemoFlags(): Promise<DemoFlags>;
  setDemoFlags(patch: Partial<DemoFlags>): Promise<DemoFlags>;
  /** Back to GUEST_PREVIEW and pristine seed data; clears everything the demo created. */
  resetDemo(): Promise<void>;
  /** Why persisted state was reset on startup, reported once so the UI can explain it. */
  takeResetNotice(): Promise<ResetNotice | undefined>;
}
