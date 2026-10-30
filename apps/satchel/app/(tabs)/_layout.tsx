// Tab bar. T50: filled glyph inside a tinted pill when focused, outline glyph otherwise; raised card bar with a soft
// shadow and the bold body face for labels. The four tabs and their order are fixed; new tabs go after these.
import { Tabs } from 'expo-router';
import { useApp } from '../../src/state/app.tsx';
import { fonts, shadowOf } from '../../src/theme/tokens.ts';
import { tabIcon } from '../../src/ui/hero.tsx';

export default function TabsLayout() {
  const { t, theme } = useApp();
  const icon = (base: string) => tabIcon(base, theme.accentSoft);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accentInk,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.cardRaised, borderTopColor: theme.line, ...shadowOf(theme, 'mid') },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.trips'), tabBarAccessibilityLabel: t('tab.trips'), tabBarIcon: icon('airplane') }} />
      <Tabs.Screen name="map" options={{ title: t('tab.map'), tabBarAccessibilityLabel: t('tab.map'), tabBarIcon: icon('map') }} />
      <Tabs.Screen name="wallet" options={{ title: t('tab.wallet'), tabBarAccessibilityLabel: t('tab.wallet'), tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="emergency" options={{ title: t('tab.emergency'), tabBarAccessibilityLabel: t('tab.emergency'), tabBarIcon: icon('medkit') }} />
      <Tabs.Screen name="toilets" options={{ title: t('tab.toilets'), tabBarAccessibilityLabel: t('tab.toilets'), tabBarIcon: icon('male-female') }} />
    </Tabs>
  );
}
