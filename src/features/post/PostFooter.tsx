import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLogin, useMyProfile, useSession } from '@/data/hooks';
import { Avatar } from '@/ui/components/Avatar';
import { PrimaryButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

type Props = { onCompose: () => void };

/**
 * The bottom of the post screen: the collapsed reply composer for members, the way in
 * for guests (or back in, with a saved card) and Продление for expired members.
 */
export function PostFooter({ onCompose }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const login = useLogin();
  const toast = useToast((s) => s.show);
  const state = session.data?.accessState;
  const me = useMyProfile(state === 'ACTIVE_MEMBER');
  const t = strings.postDetail;
  const pad = { paddingBottom: Math.max(insets.bottom, spacing.md) };

  if (state === 'ACTIVE_MEMBER') {
    return (
      <View style={[styles.bar, pad]}>
        {me.data ? <Avatar avatar={me.data.avatar} size={32} /> : null}
        <Pressable
          role="button"
          aria-label={t.composer}
          onPress={onCompose}
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
          testID="reply-composer"
        >
          <AppText tone="textMuted">{t.composer}</AppText>
        </Pressable>
      </View>
    );
  }

  const expired = state === 'ACTIVE_MEMBER_EXPIRED';
  const canLogin = !!session.data?.canLogin;
  return (
    <View style={[styles.card, pad]} testID={expired ? 'post-footer-expired' : 'post-footer-guest'}>
      <AppText variant="bodyStrong">{expired ? t.expiredTitle : t.guestTitle}</AppText>
      <AppText tone="textMuted">{expired ? t.expiredText : t.guestText}</AppText>
      {expired ? (
        <PrimaryButton label={t.renew} onPress={() => router.push('/renew')} testID="post-renew" />
      ) : canLogin ? (
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
          testID="post-login"
        />
      ) : (
        <PrimaryButton
          label={strings.home.join}
          onPress={() => router.push('/access')}
          testID="post-join"
        />
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  pill: {
    flex: 1,
    minHeight: minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  card: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
}));
