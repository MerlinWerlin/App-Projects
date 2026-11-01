import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { t } from '../../src/i18n';
import { useColors } from '../../src/theme/tokens';

export default function TabsLayout() {
  const { c } = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.ink3,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="pets" options={{ title: t('tab.pets'), tabBarIcon: ({ color, size }) => <Feather name="heart" color={color} size={size} /> }} />
      <Tabs.Screen name="dex" options={{ title: t('tab.dex'), tabBarIcon: ({ color, size }) => <Feather name="book-open" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: t('tab.settings'), tabBarIcon: ({ color, size }) => <Feather name="settings" color={color} size={size} /> }} />
    </Tabs>
  );
}
