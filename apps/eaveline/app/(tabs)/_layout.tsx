import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useApp } from '../../src/state/AppState';
import { FONT } from '../../src/theme/theme';

export default function TabsLayout() {
  const { theme } = useApp();
  const header = {
    headerStyle: { backgroundColor: theme.ground },
    headerTintColor: theme.ink,
    headerTitleStyle: { color: theme.ink, fontFamily: FONT.display, fontSize: 30 },
    headerTitleAlign: 'left' as const,
    headerShadowVisible: false,
  } as const;
  return (
    <Tabs screenOptions={{
      ...header,
      tabBarActiveTintColor: theme.ink,
      tabBarInactiveTintColor: theme.ink3,
      tabBarStyle: { backgroundColor: theme.sheet, borderTopColor: theme.line, height: 88, paddingTop: 6 },
      tabBarLabelStyle: { fontFamily: FONT.bold, fontSize: 12 },
      sceneStyle: { backgroundColor: theme.ground },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Tools', headerShown: false, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} size={26} color={color as string} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'folder-open' : 'folder-open-outline'} size={26} color={color as string} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={26} color={color as string} /> }} />
    </Tabs>
  );
}
