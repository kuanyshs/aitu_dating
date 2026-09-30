import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Heart, House, Plus, Search, UserRound, type Icon } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { createStyles } from '@/ui/theme/useStyles';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { iconStroke, minTouch, tabBarLayout } from '@/ui/theme/tokens';

import { useTabBarBottomOffset } from './tabBarInset';

export type TabName = keyof typeof strings.tabs;

const icons: Record<TabName, Icon> = {
  index: House,
  search: Search,
  create: Plus,
  activity: Heart,
  profile: UserRound,
};

function isTabName(name: string): name is TabName {
  return name in icons;
}

type Props = BottomTabBarProps & {
  /** Tabs with something new, marked with a dot (Активность). */
  dots?: Partial<Record<TabName, boolean>>;
};

export function FloatingTabBar({ state, navigation, dots }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const bottom = useTabBarBottomOffset();
  const barWidth = Math.min(width - tabBarLayout.sideMargin * 2, tabBarLayout.maxWidth);

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
      <View role="tablist" testID="tab-bar" style={[styles.bar, { width: barWidth }]}>
        {state.routes.map((route, index) => {
          if (!isTabName(route.name)) return null;
          const name = route.name;
          const focused = state.index === index;
          const TabIcon = icons[name];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              role="tab"
              aria-label={
                dots?.[name] && name === 'activity' ? strings.activity.hasNew : strings.tabs[name]
              }
              aria-selected={focused}
              testID={`tab-${name}`}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <View style={[styles.pill, focused && styles.pillActive]}>
                <TabIcon
                  size={tabBarLayout.iconSize}
                  color={focused ? colors.tabIconActive : colors.tabIcon}
                  strokeWidth={focused ? iconStroke.active : iconStroke.default}
                />
                {dots?.[name] ? <View style={styles.dot} testID={`tab-${name}-dot`} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    height: tabBarLayout.height,
    borderRadius: tabBarLayout.height / 2,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tabBar,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.tabBarBorder,
    boxShadow: colors.tabBarShadow,
  },
  item: {
    flex: 1,
    minHeight: minTouch + 4,
    minWidth: minTouch + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPressed: {
    transform: [{ scale: 0.92 }],
  },
  pill: {
    width: tabBarLayout.pillWidth,
    height: tabBarLayout.pillHeight,
    borderRadius: tabBarLayout.pillHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.tabActive,
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
}));
