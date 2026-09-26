import type { ComponentType } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { demoToolsEnabled } from '@/demo/flags';
import { SecondaryButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { ShieldCheck } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

// The demo panel stays reachable here, otherwise a tester could never lift the restriction.
const DemoPanel: ComponentType | null = demoToolsEnabled
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/demo/DemoPanel').DemoPanel
  : null;

/** Full-screen state for BLOCKED: why, the rules, and the way to support. Nothing else. */
export function RestrictedScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast((s) => s.show);
  const t = strings.restricted;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-restricted">
      <ScrollView contentContainerStyle={styles.content}>
        <ShieldCheck size={36} color={colors.text} strokeWidth={1.75} />
        <AppText variant="display" role="heading">
          {t.title}
        </AppText>
        <AppText tone="textMuted">{t.text}</AppText>

        <View style={styles.section}>
          <AppText variant="title" role="heading">
            {t.rulesTitle}
          </AppText>
          {strings.access.rules.items.map((rule) => (
            <AppText key={rule}>{`• ${rule}`}</AppText>
          ))}
        </View>

        <View style={styles.section}>
          <AppText variant="title" role="heading">
            {t.supportTitle}
          </AppText>
          <AppText tone="textMuted">{t.supportText}</AppText>
          <SecondaryButton
            label={t.support}
            onPress={() => toast(t.supportSoon)}
            testID="restricted-support"
          />
        </View>

        {DemoPanel ? (
          <View style={styles.demo}>
            <DemoPanel />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  section: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  demo: { marginTop: spacing.lg },
}));
