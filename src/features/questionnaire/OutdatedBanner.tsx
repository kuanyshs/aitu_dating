import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { PrimaryButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

/** «Анкета обновилась»: someone who filled the Анкета before v5 answers the new questions. */
export function OutdatedBanner({ testID }: { testID: string }) {
  const styles = useStyles();
  const router = useRouter();
  const t = strings.questionnaireEdit;
  return (
    <View style={styles.root} testID={testID} role="region" aria-label={t.outdatedTitle}>
      <AppText variant="bodyStrong" role="heading">
        {t.outdatedTitle}
      </AppText>
      <AppText tone="textMuted">{t.outdatedText}</AppText>
      <PrimaryButton
        label={t.outdatedAction}
        onPress={() => router.push('/card-edit')}
        testID={`${testID}-action`}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
}));
