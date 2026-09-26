import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/ui/navigation/tabBarInset';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

type Props = {
  children: ReactNode;
  testID?: string;
  /** Tab screens leave room for the floating tab bar; stack screens do not. */
  withTabBar?: boolean;
};

export function Screen({ children, testID, withTabBar = true }: Props) {
  const styles = useStyles();
  const tabBarInset = useTabBarInset();
  return (
    <SafeAreaView edges={['top']} style={styles.root} testID={testID}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: withTabBar ? tabBarInset : spacing.xl },
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
}));
