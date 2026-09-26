import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';

import type { MembershipSelection } from '@/contracts';
import { useSelectMembership } from '@/data/hooks';
import { MembershipOptions } from '@/features/access/MembershipOptions';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, stepRoute } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { PrimaryButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';

export default function MembershipStep() {
  const router = useRouter();
  const flow = useStepGuard('membership');
  const select = useSelectMembership();
  const [chosen, setChosen] = useState<MembershipSelection | undefined>(undefined);
  const selection = chosen ?? flow.data?.membership;
  const t = strings.access.membership;

  return (
    <StepScreen
      step="membership"
      title={t.title}
      text={t.text}
      testID="access-membership"
      footer={
        <>
          {select.isError ? (
            <AppText tone="danger" role="alert">
              {accessErrorText(select.error)}
            </AppText>
          ) : null}
          <PrimaryButton
            label={strings.access.next}
            disabled={!selection}
            loading={select.isPending}
            onPress={() =>
              selection &&
              select.mutate(selection, {
                onSuccess: (next) => router.replace(stepRoute(next.step) as Href),
              })
            }
            testID="access-next"
          />
        </>
      }
    >
      <MembershipOptions value={selection} onChange={setChosen} testID="membership" />
    </StepScreen>
  );
}
