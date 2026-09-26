import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { PrimaryButton } from './buttons';
import { AppText } from './Text';

/** The expired member's way back: what changed, and the one action that fixes it. */
export function RenewBanner({ testID }: { testID: string }) {
  const styles = useStyles();
  const router = useRouter();
  const t = strings.renew;
  return (
    <View style={styles.root} testID={testID} role="region" aria-label={t.bannerTitle}>
      <AppText variant="bodyStrong" role="heading">
        {t.bannerTitle}
      </AppText>
      <AppText tone="textMuted">{t.bannerText}</AppText>
      <PrimaryButton
        label={t.action}
        onPress={() => router.push('/renew')}
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
