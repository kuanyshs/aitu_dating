import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarLayout } from '@/ui/theme/tokens';

export function useTabBarBottomOffset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, tabBarLayout.minBottomOffset);
}

/**
 * Bottom padding a tab screen needs so its content can scroll clear of the floating
 * tab bar. The bar is absolutely positioned, so the navigator's own height helpers
 * do not apply.
 */
export function useTabBarInset(): number {
  return tabBarLayout.height + useTabBarBottomOffset() + tabBarLayout.contentGap;
}
