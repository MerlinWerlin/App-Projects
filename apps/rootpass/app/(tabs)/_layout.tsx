import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { C, FONT } from '../../src/ui/theme.ts';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.ground },
        headerShadowVisible: false,
        headerTitleStyle: { color: C.ink, fontFamily: FONT.display, fontSize: 21 },
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.line, height: 88, paddingTop: 6 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.ink3,
        tabBarLabelStyle: { fontFamily: FONT.displayMed, fontSize: 13, letterSpacing: 0.6 },
        sceneStyle: { backgroundColor: C.ground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Tools', headerShown: false, tabBarIcon: ({ color }) => <Ionicons name="construct" size={27} color={color as string} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ color }) => <Ionicons name="bookmarks" size={25} color={color as string} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Ionicons name="settings-sharp" size={25} color={color as string} /> }} />
    </Tabs>
  );
}
