import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import { View } from 'react-native';

import { demoToolsEnabled } from '@/demo/flags';
import { useSettings } from '@/settings';
import { IconAction } from '@/ui/components/buttons';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/Text';
import { X } from '@/ui/icons';
import { strings } from '@/ui/strings';
import type { ThemePreference } from '@/ui/theme/scheme';
import { spacing } from '@/ui/theme/tokens';

// Dead code when the flag is off at build time, so the panel never ships in production.
const DemoPanel: ComponentType | null = demoToolsEnabled
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/demo/DemoPanel').DemoPanel
  : null;

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: strings.settings.theme.system },
  { value: 'light', label: strings.settings.theme.light },
  { value: 'dark', label: strings.settings.theme.dark },
];

export default function SettingsScreen() {
  const router = useRouter();
  const themePreference = useSettings((s) => s.themePreference);
  const setThemePreference = useSettings((s) => s.setThemePreference);

  return (
    <Screen testID="screen-settings" withTabBar={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="display" role="heading">
          {strings.settings.title}
        </AppText>
        <IconAction
          icon={X}
          accessibilityLabel={strings.settings.close}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          testID="settings-close"
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="title" role="heading">
          {strings.settings.appearance}
        </AppText>
        <RadioGroup
          label={strings.settings.appearance}
          options={themeOptions}
          value={themePreference}
          onChange={setThemePreference}
          testID="theme"
        />
        <AppText variant="caption" tone="textMuted">
          {strings.settings.themeHint}
        </AppText>
      </View>

      {DemoPanel ? (
        <View style={{ marginTop: spacing.lg }}>
          <DemoPanel />
        </View>
      ) : null}
    </Screen>
  );
}
