import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { AppText } from '@/ui/components/Text';
import { ChevronRight } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.about;

/** «О продукте»: what the club is, its three principles and where the rules live. Open to everyone. */
export default function AboutScreen() {
  const styles = useStyles();
  return (
    <Screen testID="screen-about" withTabBar={false}>
      <SheetHeader title={t.title} closeLabel={t.close} testID="about-close" />
      <AppText testID="about-intro">{t.intro}</AppText>

      <View style={styles.section}>
        <AppText variant="title" role="heading">
          {t.principlesTitle}
        </AppText>
        <View style={styles.card} testID="about-principles">
          {t.principles.map((principle, index) => (
            <View key={principle.title} style={[styles.principle, index > 0 && styles.divided]}>
              <AppText variant="bodyStrong">{principle.title}</AppText>
              <AppText tone="textMuted">{principle.text}</AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="title" role="heading">
          {t.linksTitle}
        </AppText>
        <View style={styles.card}>
          <LinkRow label={t.rules} href="/rules" testID="about-rules" />
          <LinkRow label={t.safety} href="/safety" testID="about-safety" divided />
        </View>
      </View>

      <AppText variant="caption" tone="textMuted" testID="about-demo">
        {t.demo}
      </AppText>
    </Screen>
  );
}

function LinkRow({
  label,
  href,
  divided,
  testID,
}: {
  label: string;
  href: Href;
  divided?: boolean;
  testID: string;
}) {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      role="link"
      aria-label={label}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.link, divided && styles.divided, pressed && styles.pressed]}
      testID={testID}
    >
      <AppText variant="bodyStrong" style={styles.grow}>
        {label}
      </AppText>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={1.75} aria-hidden />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.sm, marginTop: spacing.md },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  principle: { gap: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  grow: { flex: 1 },
}));
