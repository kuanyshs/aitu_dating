import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { membershipOffers } from '@/catalogs';
import type { MembershipSelection } from '@/contracts';
import { useRenewMembership } from '@/data/hooks';
import { MembershipOptions } from '@/features/access/MembershipOptions';
import { accessErrorText, newIdempotencyKey } from '@/features/access/steps';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { FlowScreen } from '@/ui/components/FlowScreen';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

/**
 * Продление: choose exactly one Период, pay for a paid one (demo), and the member is
 * active again. The card and the Анкета are kept, so nothing else is asked.
 */
export default function RenewScreen() {
  const styles = useStyles();
  const router = useRouter();
  const renew = useRenewMembership();
  const toast = useToast((s) => s.show);
  // Opened from a link there is nothing underneath; land on Home instead.
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const [selection, setSelection] = useState<MembershipSelection | undefined>(undefined);
  const [phase, setPhase] = useState<'choose' | 'pay'>('choose');
  // One key per chosen period: a retry after a failure reuses it, a new choice gets a new one.
  const [idempotencyKey, setKey] = useState(newIdempotencyKey);
  const t = strings.renew;

  const offer = selection
    ? membershipOffers.find(
        (o) => o.tier === selection.tier && o.periodMonths === selection.periodMonths,
      )
    : undefined;
  const isFree = selection?.tier === 'free_verified';

  const choose = (next: MembershipSelection) => {
    setSelection(next);
    setKey(newIdempotencyKey());
    renew.reset();
  };

  const submit = () =>
    selection &&
    renew.mutate(
      { selection, idempotencyKey },
      {
        onSuccess: (me) => {
          toast(t.done(format(new Date(me.membership.endsAt), 'd MMMM yyyy', { locale: ru })));
          leave();
        },
      },
    );

  const error = renew.isError ? (
    <AppText tone="danger" role="alert" testID="renew-error">
      {`${t.failed} ${accessErrorText(renew.error)}`}
    </AppText>
  ) : null;

  const close = { label: t.close, onPress: leave, testID: 'renew-close' };

  if (phase === 'pay' && offer) {
    return (
      <FlowScreen
        title={t.payTitle}
        text={strings.access.payment.text}
        progress={t.step(2, 2)}
        back={{ label: t.changePeriod, onPress: () => setPhase('choose'), testID: 'renew-back' }}
        close={close}
        testID="renew-payment"
        footer={
          <>
            {renew.isPending ? (
              <AppText tone="textMuted" role="status" testID="renew-processing">
                {strings.access.payment.processing}
              </AppText>
            ) : null}
            {error}
            {renew.isError ? (
              <SecondaryButton
                label={strings.access.payment.retry}
                onPress={submit}
                testID="renew-retry"
              />
            ) : (
              <PrimaryButton
                label={strings.access.payment.pay}
                loading={renew.isPending}
                onPress={submit}
                testID="renew-pay"
              />
            )}
          </>
        }
      >
        <View style={styles.summary} testID="renew-summary">
          <AppText>
            {strings.access.payment.summary(strings.access.membership.months(offer.periodMonths))}
          </AppText>
          <AppText variant="display">{strings.access.membership.price(offer.priceKzt)}</AppText>
        </View>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      title={t.title}
      text={t.text}
      progress={isFree ? undefined : t.step(1, 2)}
      close={close}
      testID="renew-choose"
      footer={
        <>
          {isFree ? error : null}
          {isFree ? (
            <PrimaryButton
              label={t.renewFree}
              loading={renew.isPending}
              onPress={submit}
              testID="renew-free"
            />
          ) : (
            <PrimaryButton
              label={t.next}
              disabled={!selection}
              onPress={() => setPhase('pay')}
              testID="renew-next"
            />
          )}
        </>
      }
    >
      <MembershipOptions value={selection} onChange={choose} testID="renew" />
    </FlowScreen>
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
