import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ShieldCheck } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

import { PrimaryButton } from './buttons';
import { AppText } from './Text';

type Props = { text: string; testID: string; children?: ReactNode };

/** What a guest sees on a member-only surface: why, and the single way in. */
export function AccessPrompt({ text, testID, children }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md, alignItems: 'flex-start' }} testID={testID}>
      <ShieldCheck size={32} color={colors.text} strokeWidth={1.75} />
      <AppText variant="title" role="heading">
        {strings.access.prompt.title}
      </AppText>
      <AppText tone="textMuted">{text}</AppText>
      <PrimaryButton
        label={strings.access.prompt.action}
        onPress={() => router.push('/access')}
        testID={`${testID}-join`}
      />
      {children}
    </View>
  );
}
