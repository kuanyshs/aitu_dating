import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CLUB_RULES_VERSION } from '@/contracts';
import { useAcceptRules } from '@/data/hooks';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, stepRoute } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { PrimaryButton } from '@/ui/components/buttons';
import { Checkbox } from '@/ui/components/Checkbox';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';

export default function RulesStep() {
  const router = useRouter();
  const flow = useStepGuard('rules');
  const accept = useAcceptRules();
  const alreadyAccepted = flow.data?.rulesAcceptedVersion === CLUB_RULES_VERSION;
  const [checked, setChecked] = useState(false);
  const agreed = checked || alreadyAccepted;
  const t = strings.access.rules;

  return (
    <StepScreen
      step="rules"
      title={t.title}
      testID="access-rules"
      footer={
        <>
          {accept.isError ? (
            <AppText tone="danger" role="alert">
              {accessErrorText(accept.error)}
            </AppText>
          ) : !agreed ? (
            <AppText variant="caption" tone="textMuted">
              {t.acceptRequired}
            </AppText>
          ) : null}
          <PrimaryButton
            label={strings.access.next}
            disabled={!agreed}
            loading={accept.isPending}
            onPress={() =>
              accept.mutate(CLUB_RULES_VERSION, {
                onSuccess: (next) => router.replace(stepRoute(next.step) as Href),
              })
            }
            testID="access-next"
          />
        </>
      }
    >
      <View style={{ gap: spacing.md }} role="list">
        {t.items.map((item, i) => (
          <View key={item} role="listitem" style={{ flexDirection: 'row', gap: spacing.sm }}>
            <AppText variant="bodyStrong">{`${i + 1}.`}</AppText>
            <AppText style={{ flex: 1 }}>{item}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" tone="textMuted">
        {t.version}
      </AppText>
      <Checkbox label={t.accept} checked={agreed} onChange={setChecked} testID="rules-accept" />
    </StepScreen>
  );
}
