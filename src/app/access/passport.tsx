import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { cityLabels, genderLabels } from '@/catalogs';
import { usePassportCandidates, useSelectPassport } from '@/data/hooks';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, stepRoute } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { NeutralAvatar } from '@/ui/components/Avatar';
import { PrimaryButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

export default function PassportStep() {
  const styles = useStyles();
  const router = useRouter();
  const flow = useStepGuard('passport');
  const candidates = usePassportCandidates();
  const select = useSelectPassport();
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const selectedId = chosen ?? flow.data?.candidate?.id;
  const t = strings.access.passport;

  const onNext = () => {
    if (!selectedId) return;
    select.mutate(selectedId, {
      onSuccess: (next) => router.replace(stepRoute(next.step) as Href),
    });
  };

  return (
    <StepScreen
      step="passport"
      title={t.title}
      text={t.text}
      testID="access-passport"
      footer={
        <>
          {select.isError ? (
            <AppText tone="danger" role="alert">
              {accessErrorText(select.error)}
            </AppText>
          ) : null}
          <PrimaryButton
            label={strings.access.next}
            onPress={onNext}
            disabled={!selectedId}
            loading={select.isPending}
            testID="access-next"
          />
        </>
      }
    >
      {candidates.isPending ? <FeedSkeleton rows={3} /> : null}
      {candidates.isError ? (
        <ErrorState
          title={t.error}
          text={accessErrorText(candidates.error)}
          action={{ label: strings.feed.retry, onPress: () => candidates.refetch() }}
        />
      ) : null}
      <View role="radiogroup" aria-label={t.title} style={styles.list}>
        {candidates.data?.map((candidate) => {
          const selected = candidate.id === selectedId;
          const label = t.candidate(
            candidate.name,
            candidate.age,
            genderLabels[candidate.gender],
            cityLabels[candidate.city],
          );
          return (
            <Pressable
              key={candidate.id}
              role="radio"
              aria-checked={selected}
              aria-label={label}
              testID={`candidate-${candidate.id}`}
              onPress={() => setChosen(candidate.id)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && styles.pressed,
              ]}
            >
              <NeutralAvatar size={44} />
              <View style={styles.cardText}>
                <AppText variant="bodyStrong">{label}</AppText>
                <AppText variant="caption" tone="textMuted">
                  {t.readOnly}
                </AppText>
                <AppText variant="caption" tone="textMuted" testID="passport-subject">
                  {t.subject(candidate.aituSubjectId)}
                </AppText>
              </View>
              <View style={[styles.ring, selected && styles.ringSelected]}>
                {selected ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </StepScreen>
  );
}

const useStyles = createStyles((colors) => ({
  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: minTouch + 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  cardSelected: { borderColor: colors.primary, borderWidth: 2 },
  pressed: { backgroundColor: colors.surfacePressed },
  cardText: { flex: 1, gap: 2 },
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
