import { useCallback, useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { create } from 'zustand';

import { spacing } from '@/ui/theme/tokens';

import { useTabBarInset } from './tabBarInset';

/**
 * Height of a full-screen surface's own bottom bar (the editor's or «Ответ»'s footer
 * with its button and error). The app-wide banner and toast rise above it instead of
 * covering it; tab screens have none and keep the tab bar offset.
 */
const useFooterHeight = create<{ height: number }>(() => ({ height: 0 }));

/** Bottom offset for the offline banner and toasts on the current screen. */
export function useStatusBottom(): number {
  const tabBar = useTabBarInset() - spacing.sm;
  const footer = useFooterHeight((s) => s.height);
  return footer > 0 ? footer + spacing.sm : tabBar;
}

/** Put on a surface's bottom bar: `<View onLayout={useReportFooter()}>`. */
export function useReportFooter() {
  useEffect(() => () => useFooterHeight.setState({ height: 0 }), []);
  return useCallback((event: LayoutChangeEvent) => {
    useFooterHeight.setState({ height: event.nativeEvent.layout.height });
  }, []);
}
