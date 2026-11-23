import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { usePalette } from '../../src/theme/tokens.ts';

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.text,
        tabBarInactiveTintColor: p.text3,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.line },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'PT', tabBarIcon: ({ color, size }) => <Ionicons name="thermometer" color={color as string} size={size} /> }} />
      <Tabs.Screen name="charge" options={{ title: 'Charge', tabBarIcon: ({ color, size }) => <Ionicons name="speedometer" color={color as string} size={size} /> }} />
      <Tabs.Screen name="tools" options={{ title: 'Tools', tabBarIcon: ({ color, size }) => <Ionicons name="construct" color={color as string} size={size} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
