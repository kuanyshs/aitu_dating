import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useSession } from '@/data/hooks';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/Text';
import { ChevronRight } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.create;

const options = [
  { key: 'post', href: '/compose' },
  { key: 'question', href: '/compose?type=question' },
  { key: 'plan', href: '/plan/new' },
] as const satisfies readonly { key: keyof typeof t.options; href: Href }[];

/**
 * «Создать» opened by a link: a choice of Пост, Вопрос or План. The tab bar itself takes
 * members straight to the editor; everyone else sees why they cannot create yet.
 */
export default function CreateScreen() {
  const styles = useStyles();
  const session = useSession();
  if (session.data?.accessState !== 'ACTIVE_MEMBER') {
    return (
      <Screen testID="screen-create">
        <AccessPrompt text={strings.access.prompt.create} testID="create-access-prompt" />
      </Screen>
    );
  }
  return (
    <Screen testID="screen-create">
      <AppText variant="display" role="heading">
        {t.title}
      </AppText>
      <AppText tone="textMuted">{t.intro}</AppText>
      <View style={styles.card}>
        {options.map((option, index) => (
          <Option key={option.key} option={option} divided={index > 0} />
        ))}
      </View>
    </Screen>
  );
}

function Option({ option, divided }: { option: (typeof options)[number]; divided: boolean }) {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  const { title, text } = t.options[option.key];
  return (
    <Pressable
      role="link"
      aria-label={title}
      onPress={() => router.push(option.href)}
      style={({ pressed }) => [styles.option, divided && styles.divided, pressed && styles.pressed]}
      testID={`create-${option.key}`}
    >
      <View style={styles.grow}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText tone="textMuted">{text}</AppText>
      </View>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={1.75} aria-hidden />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.surfacePressed },
  grow: { flex: 1, gap: 2 },
}));
