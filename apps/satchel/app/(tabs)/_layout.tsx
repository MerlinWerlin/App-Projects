// Tab bar: filled glyph when focused, outline glyph otherwise (design pass 3). T171: five tabs, Itinerary in the middle (Trips, Map, Itinerary, Wallet,
// Emergency). Toilets left the bar (iOS keeps five) but its screen stays a tab route with every link to it working:
// the Map tab opens it (Toilet finder, Nearest toilet, toilet pins), as do the arrival and in-flight cards.
// 1.0 feedback ("Emergency is wrapping"): the bar says SOS (VoiceOver still says Emergency), and every tab label is
// one line at any text size: it grows with Dynamic Type up to a cap, then shrinks to fit rather than wrap.
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useApp } from '../../src/state/app.tsx';
import { fonts } from '../../src/theme/tokens.ts';
import { tabIcon } from '../../src/ui/hero.tsx';

export default function TabsLayout() {
  const { t, theme } = useApp();
  const icon = (base: string) => tabIcon(base, theme.accentSoft);
  const label =
    (text: string) =>
    ({ color }: { color: string }) => (
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1.3}
        style={{ color, fontFamily: fonts.bodyBold, fontSize: 11, textAlign: 'center' }}
      >
        {text}
      </Text>
    );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Design pass 3: a board-coloured bar with a hairline, the selected tab in carbon ink (red is kept for "now"
        // and danger), no shadow, no tinted pill, no animation between tabs (iOS default).
        tabBarActiveTintColor: theme.ink,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.paper, borderTopColor: theme.line },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.trips'), tabBarAccessibilityLabel: t('tab.trips'), tabBarLabel: label(t('tab.trips')), tabBarIcon: icon('airplane') }} />
      <Tabs.Screen name="map" options={{ title: t('tab.map'), tabBarAccessibilityLabel: t('tab.map'), tabBarLabel: label(t('tab.map')), tabBarIcon: icon('map') }} />
      <Tabs.Screen name="schedule" options={{ title: t('tab.itinerary'), tabBarAccessibilityLabel: t('tab.itinerary'), tabBarLabel: label(t('tab.itinerary')), tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="wallet" options={{ title: t('tab.wallet'), tabBarAccessibilityLabel: t('tab.wallet'), tabBarLabel: label(t('tab.wallet')), tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="emergency" options={{ title: t('tab.emergency'), tabBarAccessibilityLabel: t('tab.emergency'), tabBarLabel: label(t('tab.emergencyShort')), tabBarIcon: icon('medkit') }} />
      <Tabs.Screen name="toilets" options={{ title: t('tab.toilets'), tabBarAccessibilityLabel: t('tab.toilets'), tabBarIcon: icon('male-female'), href: null }} />
    </Tabs>
  );
}
