import { Tabs } from 'expo-router';
import { useT } from '../../src/i18n/react';
import { fonts } from '../../src/theme/tokens';
import { useReducedMotion } from '../../src/theme/useReducedMotion';
import { useTheme } from '../../src/theme/useTheme';

export default function TabsLayout() {
  const theme = useTheme();
  const t = useT();
  const reduce = useReducedMotion();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Premium polish rule 2: tab switches cross-fade (bottom-tabs' own option, ~150 ms, never blocks input).
        animation: reduce ? 'none' : 'fade',
        tabBarActiveTintColor: theme.ink,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.body, borderTopColor: theme.keyEdge },
        tabBarLabelStyle: { fontFamily: fonts.textSemi, fontSize: 14 },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="remote" options={{ title: t('app.tabs.remote'), tabBarLabel: t('app.tabs.remote'), tabBarAccessibilityLabel: t('app.tabs.remote') }} />
      <Tabs.Screen name="apps" options={{ title: t('app.tabs.apps'), tabBarLabel: t('app.tabs.apps'), tabBarAccessibilityLabel: t('app.tabs.apps') }} />
      <Tabs.Screen name="tvs" options={{ title: t('app.tabs.tvs'), tabBarLabel: t('app.tabs.tvs'), tabBarAccessibilityLabel: t('app.tabs.tvs') }} />
    </Tabs>
  );
}
