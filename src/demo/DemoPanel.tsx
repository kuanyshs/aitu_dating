import { View } from 'react-native';

import { useDemoFlags, useResetDemo, useSetDemoFlags } from '@/data/hooks';
import { SecondaryButton } from '@/ui/components/buttons';
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
