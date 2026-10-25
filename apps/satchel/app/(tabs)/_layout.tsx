import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useApp } from '../../src/state/app.tsx';
import { fonts } from '../../src/theme/tokens.ts';

type IconName = 'airplane-outline' | 'map-outline' | 'wallet-outline' | 'medkit-outline';
const icon =
  (name: IconName) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} size={size} color={color} />;

export default function TabsLayout() {
  const { t, theme } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.line },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.trips'), tabBarAccessibilityLabel: t('tab.trips'), tabBarIcon: icon('airplane-outline') }} />
      <Tabs.Screen name="map" options={{ title: t('tab.map'), tabBarAccessibilityLabel: t('tab.map'), tabBarIcon: icon('map-outline') }} />
      <Tabs.Screen name="wallet" options={{ title: t('tab.wallet'), tabBarAccessibilityLabel: t('tab.wallet'), tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="emergency" options={{ title: t('tab.emergency'), tabBarAccessibilityLabel: t('tab.emergency'), tabBarIcon: icon('medkit-outline') }} />
    </Tabs>
  );
}
