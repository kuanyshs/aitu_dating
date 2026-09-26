import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useSession } from '@/data/hooks';

import { RestrictedScreen } from './RestrictedScreen';

/**
 * Under Ограничение every other surface is closed. Navigation stays mounted but hidden,
 * so lifting the restriction returns the person exactly where they were.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const blocked = useSession().data?.accessState === 'BLOCKED';
  return (
    <>
      <View style={{ flex: 1, display: blocked ? 'none' : 'flex' }} aria-hidden={blocked}>
        {children}
      </View>
      {blocked ? <RestrictedScreen /> : null}
    </>
  );
}
