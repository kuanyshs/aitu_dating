import { Pressable, View } from 'react-native';

import { membershipOffers } from '@/catalogs';
import type { MembershipSelection } from '@/contracts';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

type Offer = (typeof membershipOffers)[number];

const keyOf = (s: MembershipSelection) => `${s.tier}:${s.periodMonths}`;

type Props = {
  value: MembershipSelection | undefined;
  onChange: (value: MembershipSelection) => void;
  /** Prefix of each option's testID: `${testID}-${tier}-${months}`. */
  testID: string;
};

/** One radio group across paid and free options: exactly one Период at a time. */
export function MembershipOptions({ value: selection, onChange, testID }: Props) {
  const styles = useStyles();
  const t = strings.access.membership;
  const paid = membershipOffers.filter((o) => o.tier === 'paid');
  const free = membershipOffers.filter((o) => o.tier === 'free_verified');

  const option = (offer: Offer) => {
    const value: MembershipSelection = { tier: offer.tier, periodMonths: offer.periodMonths };
    const selected = selection ? keyOf(selection) === keyOf(value) : false;
    const isFree = offer.tier === 'free_verified';
    const title = isFree ? t.free : t.months(offer.periodMonths);
    const label = `${title}, ${t.price(offer.priceKzt)}`;
    return (
      <Pressable
        key={keyOf(value)}
        role="radio"
        aria-checked={selected}
        aria-label={label}
        testID={`${testID}-${offer.tier}-${offer.periodMonths}`}
        onPress={() => onChange(value)}
        style={({ pressed }) => [
          styles.option,
          selected && styles.optionSelected,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.ring, selected && styles.ringSelected]}>
          {selected ? <View style={styles.dot} /> : null}
        </View>
        <View style={styles.optionText}>
          <AppText variant="bodyStrong">{title}</AppText>
          {isFree ? (
            <AppText variant="caption" tone="textMuted">
              {t.freeHint}
            </AppText>
          ) : null}
        </View>
        {'badge' in offer ? (
          <View style={styles.badge}>
            <AppText variant="caption" tone="onPrimary">
              {t.bestValue}
            </AppText>
          </View>
        ) : null}
        <AppText variant="bodyStrong">{t.price(offer.priceKzt)}</AppText>
      </Pressable>
    );
  };

  return (
    <View role="radiogroup" aria-label={t.title} style={styles.group}>
      <AppText variant="caption" tone="textMuted" style={styles.groupLabel}>
        {t.paidGroup}
      </AppText>
      {paid.map(option)}
      <AppText variant="caption" tone="textMuted" style={styles.groupLabel}>
        {t.freeGroup}
      </AppText>
      {free.map(option)}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  group: { gap: spacing.sm },
  groupLabel: { marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: minTouch + 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  optionSelected: { borderColor: colors.primary, borderWidth: 2 },
  pressed: { backgroundColor: colors.surfacePressed },
  optionText: { flex: 1, gap: 2, paddingVertical: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSelected: { borderColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
}));
