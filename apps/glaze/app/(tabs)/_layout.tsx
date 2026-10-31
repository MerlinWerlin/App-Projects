// Bottom tab bar (T70, docs/MARKET.md L1; order in src/core/tabNav.ts): Themes / Widgets / Icons /
// Pets / Wallpapers on the v2 `bar` glass material (docs/DESIGN_V2.md §9). T186 (owner-1101 #4):
// Pets joined, and Live left the bar (the Live Photo maker is /live, opened from Wallpapers). Settings keeps its
// route so /settings links still open it, but it has no tab button: Themes has a gear for it.
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { markFirstScreen } from '../../src/core/startupHandoff';
import { useT } from '../../src/i18n';
import { useMotionReduced } from '../../src/theme/motion';
import { radiusV2, sizeV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { GlassBar } from '../../src/ui/v2';

type FeatherName = ComponentProps<typeof Feather>['name'];
type TabIconProps = { color: ColorValue; size: number; focused: boolean };

/** Selected tab icons sit on a soft tinted capsule ("bubbly" look); Feather has no filled glyphs. */
function TabIcon({ icon, color, size, focused, bubble }: TabIconProps & { icon: FeatherName; bubble: string }) {
  return (
    <View style={[styles.bubble, focused ? { backgroundColor: bubble } : null]}>
      <Feather name={icon} color={color} size={Math.min(size, 22)} />
    </View>
  );
}

function TabBarBackground() {
  return <GlassBar material="bar" hairline="top" style={StyleSheet.absoluteFill} />;
}

export default function TabsLayout() {
  const { c } = useColorsV2();
  const reduced = useMotionReduced();
  const { t } = useT();
  const tab = (title: string, icon: FeatherName) => ({
    title,
    tabBarAccessibilityLabel: title,
    tabBarIcon: ({ color, size, focused }: TabIconProps) => (
      <TabIcon icon={icon} color={color} size={size} focused={focused} bubble={c.tintSoft} />
    ),
  });
  // fb-1024 A: the opening animation fades only once the first tab has laid out (one more frame so it has painted).
  const onFirstLayout = useCallback(() => {
    requestAnimationFrame(() => markFirstScreen());
  }, []);
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]} onLayout={onFirstLayout}>
    <Tabs
      screenOptions={{
        headerShown: false,
        // fb-1024 B: tabs mount on first visit only, and a hidden tab does not re-render when shared stores change.
        lazy: true,
        freezeOnBlur: true,
        tabBarActiveTintColor: c.tint,
        tabBarInactiveTintColor: c.inkSecondary,
        // The glass draws the colour; the navigator still adds the home-indicator inset itself.
        tabBarStyle: styles.bar,
        tabBarBackground: TabBarBackground,
        tabBarItemStyle: { minHeight: sizeV2.touch },
        // System font at 11 pt so every script renders (DESIGN_V2 §9).
        tabBarLabelStyle: styles.label,
        tabBarAllowFontScaling: true,
        // Avoid a white flash behind screens in dark mode.
        sceneStyle: { backgroundColor: c.bg },
        // Tab switches cross-fade (POLISH rule 2); Reduce Motion keeps an instant switch.
        animation: reduced ? 'none' : 'fade',
      }}
    >
      <Tabs.Screen name="themes" options={tab(t('tabs.themes'), 'layers')} />
      <Tabs.Screen name="widgets" options={tab(t('tabs.widgets'), 'layout')} />
      <Tabs.Screen name="icons" options={tab(t('tabs.icons'), 'grid')} />
      {/* T186: the pets screen (app/pets.tsx) has no title of its own, so this tab shows a plain header. */}
      <Tabs.Screen
        name="pets"
        options={{
          ...tab(t('tabs.pets'), 'smile'),
          headerShown: true,
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.ink,
          headerShadowVisible: false,
        }}
      />
      <Tabs.Screen name="wallpapers" options={tab(t('tabs.wallpapers'), 'image')} />
      {/* Reached from the gear on Themes; href null hides the button but keeps /settings working. */}
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), href: null }} />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
  label: { fontSize: 11, fontWeight: '500' },
  bubble: {
    minWidth: 52,
    height: 30,
    paddingHorizontal: 14,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
