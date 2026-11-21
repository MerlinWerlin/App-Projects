import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { continuous } from '../theme/design';
import { fonts } from '../theme/tokens';
import type { IconName } from './icons/names';
import { RemoteIcon } from './icons/RemoteIcon';
import { haptic } from './remote/haptics';
import { Text } from './Text';
import { useDesign } from './v2';

/** The props expo-router's Tabs passes to a custom tab bar (no direct @react-navigation import). */
export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Tab route name -> icon. Unknown routes fall back to the TV icon. */
const TAB_ICON: Record<string, IconName> = { remote: 'remote', cast: 'cast', apps: 'apps', tvs: 'tv' };

/**
 * Bottom tab bar (owner TestFlight feedback 1 Nov 2026: "the writing's small, there's no defined box
 * between each of them, it looks tacky"). DESIGN.md signature: the tabs are a row of cushions on the ground,
 * separated by their gaps (no edges or shadows); the current tab is the brass cushion. Icon over a 13 pt
 * semibold label; tiles at least 56 pt tall (44 pt touch target plus label). Labels shrink to fit long
 * translations instead of wrapping.
 */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const p = useDesign();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: p.background, paddingBottom: Math.max(insets.bottom, 10) },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const opts = descriptors[route.key]?.options;
        const label = typeof opts?.tabBarLabel === 'string' ? opts.tabBarLabel : (opts?.title ?? route.name);
        const ink = focused ? p.tintInk : p.label;
        const onPress = (): void => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic('selection');
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={opts?.tabBarAccessibilityLabel ?? label}
            style={({ pressed }) => [
              styles.tile,
              continuous,
              { backgroundColor: focused ? p.tint : pressed ? p.surfacePressed : p.surface },
            ]}
          >
            <RemoteIcon name={TAB_ICON[route.name] ?? 'tv'} size={22} color={ink} />
            <Text style={[styles.label, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tile: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  label: { fontFamily: fonts.textSemi, fontSize: 13, lineHeight: 16 },
});
