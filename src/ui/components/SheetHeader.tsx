import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { X } from '@/ui/icons';

import { IconAction } from './buttons';
import { AppText } from './Text';

type Props = { title: string; closeLabel: string; testID: string };

/** A sheet's title with «Закрыть»; opened from a link there is nothing underneath, so it lands on Home. */
export function SheetHeader({ title, closeLabel, testID }: Props) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="display" role="heading">
        {title}
      </AppText>
      <IconAction
        icon={X}
        accessibilityLabel={closeLabel}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        testID={testID}
      />
    </View>
  );
}
