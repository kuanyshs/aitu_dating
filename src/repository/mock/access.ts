import { membershipOffers } from '@/catalogs';
import {
  CLUB_RULES_VERSION,
  MembershipSelection,
  type AccessFlowState,
  type AccessFlowStep,
  type ApiError,
  type PassportCandidate,
  type PaymentReceipt,
} from '@/contracts';

import type { AccessFlowRecord } from './demo';

// Pure access-flow rules of the mock backend. Each transition checks that the earlier
// steps are done; skipping ahead is a CONFLICT, bad input is a VALIDATION_ERROR.

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: Omit<ApiError, 'requestId'> };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const conflict = (message: string): Outcome<never> => ({
  ok: false,
  error: { code: 'CONFLICT', message },
});
const invalid = (message: string, fieldErrors?: Record<string, string>): Outcome<never> => ({
  ok: false,
  error: { code: 'VALIDATION_ERROR', message, ...(fieldErrors ? { fieldErrors } : {}) },
});

/** Once paid (or free confirmed) the identity and plan are locked. */
function isLocked(flow: AccessFlowRecord): boolean {
  return flow.step === 'profile' || flow.step === 'questionnaire';
}

export function priceOf(selection: MembershipSelection): number {
  const offer = membershipOffers.find(
    (o) => o.tier === selection.tier && o.periodMonths === selection.periodMonths,
  );
  if (!offer) throw new Error('Unknown membership offer');
  return offer.priceKzt;
}

export function start(flow: AccessFlowRecord | null): AccessFlowRecord {
  return flow ?? { step: 'passport' };
}

export function selectPassport(
  flow: AccessFlowRecord | null,
  candidateId: string,
  candidates: PassportCandidate[],
): Outcome<AccessFlowRecord> {
  if (!flow) return conflict('Access flow has not been started.');
  if (isLocked(flow)) return conflict('Identity is locked after membership is confirmed.');
  if (!candidates.some((c) => c.id === candidateId)) {
    return invalid('Unknown Passport candidate.', { candidateId: 'unknown' });
  }
  // Choosing an identity (again) restarts the steps that depend on it.
  return ok({ step: 'rules', candidateId });
}

export function acceptRules(
  flow: AccessFlowRecord | null,
  rulesVersion: string,
): Outcome<AccessFlowRecord> {
  if (!flow?.candidateId) return conflict('Choose a Passport identity first.');
  if (isLocked(flow)) return conflict('Rules were already accepted.');
  if (rulesVersion !== CLUB_RULES_VERSION) {
    return invalid('Outdated club rules.', { rulesVersion: 'outdated' });
  }
  return ok({
    step: 'membership',
    candidateId: flow.candidateId,
    rulesAcceptedVersion: rulesVersion,
    ...(flow.membership ? { membership: flow.membership } : {}),
  });
}

export function selectMembership(
  flow: AccessFlowRecord | null,
  input: unknown,
  paidAt: string,
): Outcome<AccessFlowRecord> {
  if (!flow?.rulesAcceptedVersion) return conflict('Accept the club rules first.');
  if (isLocked(flow)) return conflict('Membership is already confirmed.');
  const parsed = MembershipSelection.safeParse(input);
  if (!parsed.success)
    return invalid('Choose exactly one membership period.', { periodMonths: 'invalid' });
  const membership = parsed.data;

  if (membership.tier === 'free_verified') {
    // Free verified skips checkout: it is confirmed at once with a zero receipt.
    return ok({
      step: 'profile',
      candidateId: flow.candidateId,
      rulesAcceptedVersion: flow.rulesAcceptedVersion,
      membership,
      payment: { reference: `free-${flow.candidateId}`, amountKzt: 0, paidAt },
    });
  }
  return ok({
    step: 'payment',
    candidateId: flow.candidateId,
    rulesAcceptedVersion: flow.rulesAcceptedVersion,
    membership,
  });
}

export function confirmPayment(
  flow: AccessFlowRecord | null,
  receipt: PaymentReceipt,
): Outcome<AccessFlowRecord> {
  if (!flow?.membership) return conflict('Choose a membership period first.');
  if (flow.membership.tier !== 'paid') return conflict('Free verified needs no payment.');
  if (flow.step !== 'payment') return conflict('Payment is not expected at this step.');
  return ok({ ...flow, step: 'profile', payment: receipt });
}

export function toFlowState(
  flow: AccessFlowRecord,
  candidates: PassportCandidate[],
): AccessFlowState {
  const candidate = candidates.find((c) => c.id === flow.candidateId);
  return {
    step: flow.step as AccessFlowStep,
    ...(candidate ? { candidate } : {}),
    ...(flow.rulesAcceptedVersion ? { rulesAcceptedVersion: flow.rulesAcceptedVersion } : {}),
    ...(flow.membership ? { membership: flow.membership } : {}),
    ...(flow.payment ? { payment: flow.payment } : {}),
  };
}
