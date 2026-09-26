import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import type { AccessFlowStep } from '@/contracts';
import { useAccessFlow } from '@/data/hooks';

import { canVisit, stepRoute } from './steps';

/**
 * Keeps a step screen consistent with the server's flow: no flow → start it; a step
 * that is not reachable yet (or locked after payment) → go to the current step.
 */
export function useStepGuard(step: AccessFlowStep) {
  const router = useRouter();
  const flow = useAccessFlow();

  useEffect(() => {
    if (flow.isPending || flow.isError) return;
    if (!flow.data) {
      router.replace('/access');
      return;
    }
    if (!canVisit(step, flow.data.step)) router.replace(stepRoute(flow.data.step) as Href);
  }, [flow.data, flow.isError, flow.isPending, router, step]);

  return flow;
}
