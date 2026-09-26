import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { membershipOffers } from '@/catalogs';
import { useConfirmPayment } from '@/data/hooks';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, newIdempotencyKey, stepRoute } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

export default function PaymentStep() {
  const styles = useStyles();
  const router = useRouter();
  const flow = useStepGuard('payment');
  const confirm = useConfirmPayment();
  // One key per checkout attempt on this screen: a retry after a failure reuses it,
  // so the server can recognise a duplicate and never charge twice.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const t = strings.access.payment;

  const membership = flow.data?.membership;
  const offer = membership
    ? membershipOffers.find(
        (o) => o.tier === membership.tier && o.periodMonths === membership.periodMonths,
      )
    : undefined;

  const pay = () =>
    confirm.mutate(idempotencyKey, {
      onSuccess: (next) => router.replace(stepRoute(next.step) as Href),
    });

  return (
    <StepScreen
      step="payment"
      title={t.title}
      text={t.text}
      testID="access-payment"
      footer={
        <>
          {confirm.isPending ? (
            <AppText tone="textMuted" role="status" testID="payment-processing">
              {t.processing}
            </AppText>
          ) : null}
          {confirm.isError ? (
            <AppText tone="danger" role="alert" testID="payment-error">
              {`${t.failed} ${accessErrorText(confirm.error)}`}
            </AppText>
          ) : null}
          {confirm.isError ? (
            <SecondaryButton label={t.retry} onPress={pay} testID="payment-retry" />
          ) : (
            <PrimaryButton
              label={t.pay}
              onPress={pay}
              disabled={!offer}
              loading={confirm.isPending}
              testID="payment-pay"
            />
          )}
        </>
      }
    >
      {offer ? (
        <View style={styles.summary} testID="payment-summary">
          <AppText>{t.summary(strings.access.membership.months(offer.periodMonths))}</AppText>
          <AppText variant="display">{strings.access.membership.price(offer.priceKzt)}</AppText>
        </View>
      ) : null}
    </StepScreen>
  );
}

const useStyles = createStyles((colors) => ({
  summary: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
}));
