// Bottom tab bar (T81, DESIGN_V2 §4 materials, MARKET "Design reference 18 Oct" §2): a frosted GlassBar with a
// hairline on top, four tabs (Trace / Templates / My drawings / Settings, src/core/tabs.ts) as Feather icons with a
// catalogue label under each. The active tab sits in a rounded inkSoft pill and pops; presses scale with the spring
// and tick a selection haptic (Haptics setting respected). Each tab is a ≥ 44 pt target with role "tab" and its
// selected state. The row uses flexDirection 'row' only, so it mirrors by itself for right-to-left languages.
// The bar stays in the layout flow (the navigator puts the screens above it) and pads for the bottom safe area
// (tab screens therefore skip that inset themselves, T92). It hides while the keyboard is open (T92).
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeV2 } from '../../theme/useTheme';
import { radiusV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { popTo, useReduceMotion } from '../../theme/motion';
import { PressableScale } from '../PressableScale';
import { useT } from '../../i18n';
import { TAB_BAR_HEIGHT, keyboardEvents, tabFor, type TabSpec } from '../../core/tabs';
import { GlassBar } from './Glass';

type TabRoute = { key: string; name: string; params?: object };

/** The part of the bottom-tab navigation object the bar uses (structural, so no navigator types are imported). */
export type TabBarNavigation = {
  emit: (event: { type: 'tabPress' | 'tabLongPress'; target: string; canPreventDefault?: boolean }) => {
    defaultPrevented?: boolean;
  };
  navigate: (name: string, params?: object) => void;
};

export type TabBarV2Props = {
  state: { index: number; routes: readonly TabRoute[] };
  navigation: TabBarNavigation;
};

/** Maximum Dynamic Type scale for tab labels (bars stay compact; Settings → larger text still reads). */
const LABEL_MAX_SCALE = 1.3;
const PILL_W = 60;
const PILL_H = 32;

/**
 * T92: true while the software keyboard is up. The navigator's tabBarHideOnKeyboard only covers its default bar,
 * so this custom bar listens itself (iOS "will" events, Android "did" events; src/core/tabs.ts keyboardEvents).
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const ev = keyboardEvents(Platform.OS);
    const show = Keyboard.addListener(ev.show, () => setOpen(true));
    const hide = Keyboard.addListener(ev.hide, () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

export function TabBarV2({ state, navigation }: TabBarV2Props) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const keyboardOpen = useKeyboardOpen();
  const focusedKey = state.routes[state.index]?.key;
  // T92: out of the way while typing (Templates search) so the bar never sits on top of the keyboard and the
  // screen gets the full height above it; it comes back as soon as the keyboard hides.
  if (keyboardOpen) return null;
  return (
    <GlassBar edge="top" style={{ paddingBottom: Math.max(insets.bottom, spaceV2.x2) }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', minHeight: TAB_BAR_HEIGHT, paddingTop: spaceV2.x1 }}>
        {state.routes.map((route) => {
          const spec = tabFor(route.name);
          if (!spec) return null;
          const focused = route.key === focusedKey;
          return (
            <TabItem
              key={route.key}
              spec={spec}
              label={t(spec.label)}
              focused={focused}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              }}
            />
          );
        })}
      </View>
    </GlassBar>
  );
}

type TabItemProps = {
  spec: TabSpec;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

function TabItem({ spec, label, focused, onPress, onLongPress }: TabItemProps) {
  const { c, text } = useThemeV2();
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    // Selection pop on the pill when a tab becomes active (not on first mount; Reduce Motion: none).
    if (first.current) {
      first.current = false;
      return;
    }
    if (!focused || reduce) return;
    const a = popTo(pop, false);
    a.start();
    return () => a.stop();
  }, [focused, reduce, pop]);

  const color = focused ? c.ink : c.muted;
  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={{ flex: 1, minHeight: sizeV2.touch + spaceV2.x2, alignItems: 'center', justifyContent: 'center', paddingVertical: spaceV2.x1 }}
    >
      <Animated.View
        style={{
          width: PILL_W,
          height: PILL_H,
          borderRadius: radiusV2.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? c.inkSoft : 'transparent',
          transform: [{ scale: pop }],
        }}
      >
        <Feather name={spec.icon} size={22} color={color} />
      </Animated.View>
      <Text
        maxFontSizeMultiplier={LABEL_MAX_SCALE}
        style={[text('caption'), { color, textAlign: 'center', marginTop: 2, fontWeight: focused ? '600' : '500' }]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
