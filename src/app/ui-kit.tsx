import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { IconAction, PrimaryButton, SecondaryButton, TextButton } from '@/ui/components/buttons';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/Text';
import { ChevronLeft, Heart, Plus, Search } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';

const noop = () => undefined;

/** Manual QA surface: every base button in each state, in the current theme. */
export default function UiKitScreen() {
  const router = useRouter();
  const t = strings.uiKit;

  return (
    <Screen testID="screen-ui-kit" withTabBar={false}>
      <IconAction icon={ChevronLeft} accessibilityLabel={t.back} onPress={() => router.back()} />
      <AppText variant="display" role="heading">
        {t.title}
      </AppText>

      <AppText variant="bodyStrong" tone="textMuted">
        {t.sections.default}
      </AppText>
      <PrimaryButton label={t.primary} onPress={noop} />
      <SecondaryButton label={t.secondary} onPress={noop} />
      <TextButton label={t.text} onPress={noop} />

      <AppText variant="bodyStrong" tone="textMuted">
        {t.sections.disabled}
      </AppText>
      <PrimaryButton label={t.disabled} onPress={noop} disabled />
      <SecondaryButton label={t.disabled} onPress={noop} disabled />
      <TextButton label={t.disabled} onPress={noop} disabled />

      <AppText variant="bodyStrong" tone="textMuted">
        {t.sections.loading}
      </AppText>
      <PrimaryButton label={t.loading} onPress={noop} loading />
      <SecondaryButton label={t.loading} onPress={noop} loading />

      <AppText variant="bodyStrong" tone="textMuted">
        {t.sections.icon}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <IconAction icon={Heart} accessibilityLabel={t.iconAction} onPress={noop} />
        <IconAction icon={Search} accessibilityLabel={t.iconAction} onPress={noop} />
        <IconAction icon={Plus} accessibilityLabel={t.iconAction} onPress={noop} disabled />
      </View>
    </Screen>
  );
}
