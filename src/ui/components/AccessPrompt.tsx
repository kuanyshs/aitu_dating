import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useLogin, useSession } from '@/data/hooks';
import { ShieldCheck } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

import { PrimaryButton } from './buttons';
import { AppText } from './Text';

type Props = { text: string; testID: string; children?: ReactNode };

/**
 * What a guest sees on a member-only surface: why, and the single way in. A guest
 * whose identity already has a card gets «Войти» instead of the access flow, and an
 * expired member gets Продление.
 */
export function AccessPrompt({ text, testID, children }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const session = useSession();
  const login = useLogin();
  const toast = useToast((s) => s.show);
  const canLogin = !!session.data?.canLogin;
  const expired = session.data?.accessState === 'ACTIVE_MEMBER_EXPIRED';

  if (expired) {
    return (
      <View style={{ gap: spacing.md, alignItems: 'flex-start' }} testID={testID}>
        <ShieldCheck size={32} color={colors.text} strokeWidth={1.75} />
        <AppText variant="title" role="heading">
          {strings.renew.bannerTitle}
        </AppText>
        <AppText tone="textMuted">{strings.renew.bannerText}</AppText>
        <PrimaryButton
          label={strings.renew.action}
          onPress={() => router.push('/renew')}
          testID={`${testID}-renew`}
        />
        {children}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md, alignItems: 'flex-start' }} testID={testID}>
      <ShieldCheck size={32} color={colors.text} strokeWidth={1.75} />
      <AppText variant="title" role="heading">
        {canLogin ? strings.access.prompt.loginTitle : strings.access.prompt.title}
      </AppText>
      <AppText tone="textMuted">{canLogin ? strings.access.prompt.loginText : text}</AppText>
      {canLogin ? (
        <PrimaryButton
          label={strings.session.login}
          accessibilityLabel={strings.session.loginLabel}
          loading={login.isPending}
          onPress={() =>
            login.mutate(undefined, {
              onSuccess: () => toast(strings.session.loggedIn),
              onError: () => toast(strings.session.failed),
            })
          }
          testID={`${testID}-login`}
        />
      ) : (
        <PrimaryButton
          label={strings.access.prompt.action}
          onPress={() => router.push('/access')}
          testID={`${testID}-join`}
        />
      )}
      {children}
    </View>
  );
}
