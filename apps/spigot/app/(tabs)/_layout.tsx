import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { font, usePalette } from '../../src/ui/theme';

export default function TabsLayout() {
  const c = usePalette();
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} size={size + 2} color={color as string} />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: { fontFamily: font.display, fontSize: 24, color: c.ink },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.copper,
        tabBarInactiveTintColor: c.ink3,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Tools', headerShown: false, tabBarIcon: icon('construct') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: icon('folder-open') }} />
      <Tabs.Screen name="reference" options={{ title: 'Reference', tabBarIcon: icon('book') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
