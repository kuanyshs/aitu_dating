import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useCachedPost, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { Screen } from '@/ui/components/Screen';
import { StubScreen } from '@/ui/components/StubScreen';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

// Temporary: the post editor arrives with the «Создание» spec; «Цитировать» already
// lands here with the quoted post, so that spec only has to add the editor around it.
export default function ComposeScreen() {
  const styles = useStyles();
  const clock = useClock();
  const session = useSession();
  const { quote } = useLocalSearchParams<{ quote?: string }>();
  const quoted = useCachedPost(quote ? String(quote) : '');

  if (session.data && session.data.accessState !== 'ACTIVE_MEMBER') {
    return (
      <Screen testID="screen-compose" withTabBar={false}>
        <AccessPrompt text={strings.access.prompt.create} testID="compose-access-prompt" />
      </Screen>
    );
  }

  return (
    <StubScreen {...strings.stub.compose} testID="screen-compose">
      {quoted ? (
        <View
          style={styles.quoted}
          aria-label={strings.stub.compose.quoted}
          testID={`compose-quoted-${quoted.id}`}
        >
          <AuthorRow author={quoted.author} time={formatRelative(quoted.createdAt, clock)} />
          <AppText numberOfLines={3}>{quoted.text}</AppText>
        </View>
      ) : null}
    </StubScreen>
  );
}

const useStyles = createStyles((colors) => ({
  quoted: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
}));
