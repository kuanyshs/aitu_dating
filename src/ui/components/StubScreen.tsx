import { useRouter } from 'expo-router';

import { ChevronLeft } from '@/ui/icons';
import { strings } from '@/ui/strings';

import { IconAction } from './buttons';
import { Screen } from './Screen';
import { AppText } from './Text';

type Props = { title: string; text: string; testID: string };

/** Placeholder for a surface built in a later ticket: named, explained, with a way back. */
export function StubScreen({ title, text, testID }: Props) {
  const router = useRouter();
  return (
    <Screen testID={testID} withTabBar={false}>
      <IconAction
        icon={ChevronLeft}
        accessibilityLabel={strings.stub.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        testID="stub-back"
      />
      <AppText variant="display" role="heading">
        {title}
      </AppText>
      <AppText tone="textMuted">{text}</AppText>
    </Screen>
  );
}
