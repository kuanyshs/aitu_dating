import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useMyProfile } from '@/data/hooks';
import { TOTAL_STEPS } from '@/features/access/steps';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { FlowScreen } from '@/ui/components/FlowScreen';
import { AppText } from '@/ui/components/Text';
import { Check } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

const t = strings.access.welcome;

/** The last step of Вступление: what is open now and until when. */
export default function WelcomeStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const me = useMyProfile(true);
  const done = (to: '/' | '/profile') => router.dismissTo(to);

  return (
    <FlowScreen
      title={t.title}
      text={t.text}
      progress={strings.access.step(TOTAL_STEPS, TOTAL_STEPS)}
      progressTestID="access-progress"
      close={{ label: t.feed, onPress: () => done('/'), testID: 'welcome-close' }}
      testID="access-welcome"
      footer={
        <>
          <PrimaryButton label={t.feed} onPress={() => done('/')} testID="welcome-feed" />
          <SecondaryButton
            label={t.profile}
            onPress={() => done('/profile')}
            testID="welcome-profile"
          />
        </>
      }
    >
      <View style={{ gap: spacing.md }}>
        {t.can.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Check size={18} color={colors.text} aria-hidden />
            <AppText style={{ flex: 1 }}>{line}</AppText>
          </View>
        ))}
        {me.data ? (
          <AppText variant="bodyStrong" testID="welcome-until">
            {t.until(format(new Date(me.data.membership.endsAt), 'd MMMM yyyy', { locale: ru }))}
          </AppText>
        ) : null}
      </View>
    </FlowScreen>
  );
}
