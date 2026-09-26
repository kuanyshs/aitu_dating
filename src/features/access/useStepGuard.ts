import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import type { AccessFlowStep } from '@/contracts';
import { useAccessFlow, useSession } from '@/data/hooks';

import { canVisit, stepRoute } from './steps';

/**
 * Keeps a step screen consistent with the server's flow: no flow → start it; a step
 * that is not reachable yet (or locked after payment) → go to the current step.
 */
export function useStepGuard(step: AccessFlowStep) {
  const router = useRouter();
  const flow = useAccessFlow();
  // Publishing the card clears the flow and makes a member: the last step then leaves
  // on its own, so only a guest without a flow is sent to start one.
  const isGuest = useSession().data?.accessState === 'GUEST_PREVIEW';

  useEffect(() => {
    if (flow.isPending || flow.isError) return;
    if (!flow.data) {
      if (!isGuest) return;
      router.replace('/access');
      return;
    }
    if (!canVisit(step, flow.data.step)) router.replace(stepRoute(flow.data.step) as Href);
  }, [flow.data, flow.isError, flow.isPending, isGuest, router, step]);

  return flow;
}
