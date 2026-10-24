import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { t } from '../../src/i18n';
import { font, useColors } from '../../src/theme/tokens';

export default function TabsLayout() {
  const { c } = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.ink3,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: font.bodyBold, fontSize: 11 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.projects'), tabBarIcon: ({ color, size }) => <Feather name="layers" color={color} size={size} /> }} />
      <Tabs.Screen name="tools" options={{ title: t('tabs.tools'), tabBarIcon: ({ color, size }) => <Feather name="tool" color={color} size={size} /> }} />
      <Tabs.Screen name="stash" options={{ title: t('tabs.stash'), tabBarIcon: ({ color, size }) => <Feather name="archive" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: ({ color, size }) => <Feather name="settings" color={color} size={size} /> }} />
    </Tabs>
  );
}
