import { Tabs } from 'expo-router';
import { useT } from '../../src/i18n/react';
import { useReducedMotion } from '../../src/theme/useReducedMotion';
import { TabBar } from '../../src/ui/TabBar';

export default function TabsLayout() {
  const t = useT();
  const reduce = useReducedMotion();
  return (
    <Tabs
      // Owner TestFlight feedback 1 Nov 2026: each tab is its own tile with an icon and a bigger label.
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Premium polish rule 2: tab switches cross-fade (bottom-tabs' own option, ~150 ms, never blocks input).
        animation: reduce ? 'none' : 'fade',
      }}
    >
      <Tabs.Screen name="remote" options={{ title: t('app.tabs.remote'), tabBarLabel: t('app.tabs.remote'), tabBarAccessibilityLabel: t('app.tabs.remote') }} />
      {/* cast-1024: photos and videos from the phone to the TV (free). */}
      <Tabs.Screen name="cast" options={{ title: t('app.tabs.cast'), tabBarLabel: t('app.tabs.cast'), tabBarAccessibilityLabel: t('app.tabs.cast') }} />
      <Tabs.Screen name="apps" options={{ title: t('app.tabs.apps'), tabBarLabel: t('app.tabs.apps'), tabBarAccessibilityLabel: t('app.tabs.apps') }} />
      <Tabs.Screen name="tvs" options={{ title: t('app.tabs.tvs'), tabBarLabel: t('app.tabs.tvs'), tabBarAccessibilityLabel: t('app.tabs.tvs') }} />
    </Tabs>
  );
}
