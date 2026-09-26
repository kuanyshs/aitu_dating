import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useStartAccess } from '@/data/hooks';
import { stepRoute } from '@/features/access/steps';
import { ErrorState } from '@/ui/components/StateViews';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';

/** «Вступить» lands here: start (or resume) the flow and jump to the current step. */
export default function AccessEntry() {
  const router = useRouter();
  const { colors } = useTheme();
  const start = useStartAccess();
  const { mutate } = start;

  useEffect(() => {
    mutate(undefined, { onSuccess: (flow) => router.replace(stepRoute(flow.step) as Href) });
  }, [mutate, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
      }}
      testID="screen-access"
    >
      {start.isError ? (
        <ErrorState
          title={strings.access.passport.title}
          text={strings.access.errors.default}
          action={{
            label: strings.feed.retry,
            onPress: () =>
              mutate(undefined, {
                onSuccess: (flow) => router.replace(stepRoute(flow.step) as Href),
              }),
          }}
        />
      ) : (
        <ActivityIndicator color={colors.textMuted} />
      )}
    </View>
  );
}
