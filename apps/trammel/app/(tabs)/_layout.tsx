import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { fonts, useTheme } from '../../src/theme/theme.ts';

export default function TabsLayout() {
  const t = useTheme();
  const icon =
    (on: keyof typeof Ionicons.glyphMap, off: keyof typeof Ionicons.glyphMap) =>
    ({ focused, color, size }: { focused: boolean; color: unknown; size: number }) => <Ionicons name={focused ? on : off} size={size} color={color as string} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.ink,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
        headerShadowVisible: false,
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.line },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Tools', headerShown: false, tabBarIcon: icon('grid', 'grid-outline') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: icon('folder-open', 'folder-open-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
