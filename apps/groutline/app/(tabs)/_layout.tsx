import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useTheme } from '../../src/theme/theme.ts';

type Glyph = keyof typeof Ionicons.glyphMap;
const icon = (on: Glyph, off: Glyph) => ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => <Ionicons name={focused ? on : off} color={color as string} size={size} />;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: t.ink,
      tabBarInactiveTintColor: t.ink3,
      tabBarStyle: { backgroundColor: t.ground, borderTopColor: t.line },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Tools', tabBarIcon: icon('grid', 'grid-outline') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: icon('bookmark', 'bookmark-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
