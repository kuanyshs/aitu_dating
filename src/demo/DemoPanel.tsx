import { View } from 'react-native';

import {
  useCandidateStatus,
  useDemoFlags,
  useExpireMembership,
  useResetDemo,
  useRestoreMembership,
  useSession,
  useSetDemoFlags,
  useSetModeratorRole,
  useSetRestricted,
  useSwitchCandidate,
} from '@/data/hooks';
import { SecondaryButton } from '@/ui/components/buttons';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { AppText } from '@/ui/components/Text';
import { ToggleRow } from '@/ui/components/ToggleRow';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { spacing } from '@/ui/theme/tokens';

/** Settings → Demo controls. Only imported when demo tools are enabled for the build. */
export function DemoPanel() {
  const flags = useDemoFlags();
  const setFlags = useSetDemoFlags();
  const reset = useResetDemo();
  const session = useSession();
  const candidates = useCandidateStatus();
  const switchCandidate = useSwitchCandidate();
  const expire = useExpireMembership();
  const restore = useRestoreMembership();
  const accessState = session.data?.accessState;
  const setRestricted = useSetRestricted();
  const setModerator = useSetModeratorRole();
  const blocked = accessState === 'BLOCKED';
  const hasCandidate = !!session.data?.candidateId;
  const toast = useToast((s) => s.show);
  const t = strings.demo;

  return (
    <View style={{ gap: spacing.sm }} testID="demo-panel">
      <AppText variant="title" role="heading">
        {t.title}
      </AppText>
      <AppText variant="caption" tone="textMuted">
        {t.hint}
      </AppText>
      {candidates.data ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="bodyStrong">{t.candidate}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t.candidateHint}
          </AppText>
          <RadioGroup
            label={t.candidate}
            options={candidates.data.map((c) => ({
              value: c.candidateId,
              label: t.candidateStatus(c.name, c.hasCard),
            }))}
            value={session.data?.candidateId ?? ''}
            onChange={(candidateId) => {
              if (switchCandidate.isPending || candidateId === session.data?.candidateId) return;
              const name = candidates.data.find((c) => c.candidateId === candidateId)?.name ?? '';
              switchCandidate.mutate(candidateId, {
                onSuccess: () => toast(t.candidateSwitched(name)),
              });
            }}
            testID="demo-candidate"
          />
        </View>
      ) : null}
      {accessState === 'ACTIVE_MEMBER' || accessState === 'ACTIVE_MEMBER_EXPIRED' ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="bodyStrong">{t.membership}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t.expireHint}
          </AppText>
          {accessState === 'ACTIVE_MEMBER' ? (
            <SecondaryButton
              label={t.expire}
              loading={expire.isPending}
              onPress={() => expire.mutate(undefined, { onSuccess: () => toast(t.expired) })}
              testID="demo-expire"
            />
          ) : (
            <SecondaryButton
              label={t.restore}
              loading={restore.isPending}
              onPress={() => restore.mutate(undefined, { onSuccess: () => toast(t.restored) })}
              testID="demo-restore"
            />
          )}
        </View>
      ) : null}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="bodyStrong">{t.moderation}</AppText>
        <AppText variant="caption" tone="textMuted">
          {hasCandidate ? t.restrictHint : t.restrictNeedsCandidate}
        </AppText>
        <SecondaryButton
          label={blocked ? t.unrestrict : t.restrict}
          disabled={!hasCandidate || !session.data}
          loading={setRestricted.isPending}
          onPress={() =>
            setRestricted.mutate(!blocked, {
              onSuccess: () => toast(blocked ? t.unrestricted : t.restricted),
            })
          }
          testID={blocked ? 'demo-unrestrict' : 'demo-restrict'}
        />
        <ToggleRow
          label={t.moderator}
          hint={t.moderatorHint}
          value={!!session.data?.roles.includes('moderator')}
          // Until the session loads the switch would read «off» and a tap would mean «on».
          disabled={setModerator.isPending || !session.data}
          onChange={(enabled) => setModerator.mutate(enabled)}
          testID="demo-moderator"
        />
      </View>
      <ToggleRow
        label={t.networkErrorOnce}
        hint={t.networkErrorOnceHint}
        value={flags.networkErrorOnce}
        disabled={setFlags.isPending}
        onChange={(networkErrorOnce) =>
          setFlags.mutate(
            { networkErrorOnce },
            { onSuccess: () => networkErrorOnce && toast(t.networkErrorArmed) },
          )
        }
        testID="demo-network-error-once"
      />
      <ToggleRow
        label={t.offline}
        hint={t.offlineHint}
        value={flags.offline}
        disabled={setFlags.isPending}
        onChange={(offline) => setFlags.mutate({ offline })}
        testID="demo-offline"
      />
      <SecondaryButton
        label={t.reset}
        loading={reset.isPending}
        onPress={() => reset.mutate(undefined, { onSuccess: () => toast(t.resetDone) })}
        testID="demo-reset"
      />
    </View>
  );
}
