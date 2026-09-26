import type { ReactNode } from 'react';

import { AppText } from './Text';
import { Screen } from './Screen';

type Props = {
  title: string;
  text: string;
  testID: string;
  children?: ReactNode;
};

/** Temporary tab content until the surface is built in its own ticket. */
export function PlaceholderScreen({ title, text, testID, children }: Props) {
  return (
    <Screen testID={testID}>
      <AppText variant="display" role="heading">
        {title}
      </AppText>
      <AppText tone="textMuted">{text}</AppText>
      {children}
    </Screen>
  );
}
