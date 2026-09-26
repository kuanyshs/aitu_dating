import { isRepositoryError, type AccessFlowStep } from '@/contracts';
import { strings } from '@/ui/strings';

export const stepOrder: AccessFlowStep[] = [
  'passport',
  'rules',
  'membership',
  'payment',
  'profile',
  'questionnaire',
];

export const stepRoute = (step: AccessFlowStep) => `/access/${step}` as const;

export function stepNumber(step: AccessFlowStep): number {
  return stepOrder.indexOf(step) + 1;
}

/** Steps before profile can be revisited until membership is confirmed. */
export function canVisit(target: AccessFlowStep, current: AccessFlowStep): boolean {
  const locked = stepNumber(current) >= stepNumber('profile');
  if (locked)
    return stepNumber(target) >= stepNumber('profile') && stepNumber(target) <= stepNumber(current);
  return stepNumber(target) <= stepNumber(current);
}

export function accessErrorText(error: unknown): string {
  if (isRepositoryError(error)) {
    if (error.code === 'NETWORK_ERROR') return strings.access.errors.network;
    if (error.code === 'CONFLICT') return strings.access.errors.conflict;
  }
  return strings.access.errors.default;
}

/** Client-generated key so a retried checkout is recognised by the server. */
export function newIdempotencyKey(): string {
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
