import { View } from 'react-native';

import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const rules = strings.access.rules;

/** «Правила клуба» to read at any time; accepting them happens in the access flow. */
export default function RulesScreen() {
  const styles = useStyles();
  return (
    <Screen testID="screen-rules" withTabBar={false}>
      <SheetHeader
        title={strings.rulesScreen.title}
        closeLabel={strings.rulesScreen.close}
        testID="rules-close"
      />
      <View style={styles.card} testID="rules-list">
        {rules.items.map((rule, index) => (
          <View key={rule} style={[styles.rule, index > 0 && styles.divided]}>
            <AppText variant="bodyStrong" tone="textMuted" style={styles.number}>
              {`${index + 1}`}
            </AppText>
            <AppText style={styles.grow}>{rule}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" tone="textMuted">
        {rules.version}
      </AppText>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  rule: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  number: { width: 16 },
  grow: { flex: 1 },
}));
