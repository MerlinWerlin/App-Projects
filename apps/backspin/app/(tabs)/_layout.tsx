import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useApp } from '../../src/state/app.tsx';

const icon = (e: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{e}</Text>;

export default function TabsLayout() {
  const { t, theme } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.rec,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.line },
        tabBarLabelStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.play'), tabBarIcon: icon('🎙') }} />
      <Tabs.Screen name="packs" options={{ title: t('tab.packs'), tabBarIcon: icon('🗂') }} />
      <Tabs.Screen name="party" options={{ title: t('tab.party'), tabBarIcon: icon('🎉') }} />
      <Tabs.Screen name="takes" options={{ title: t('tab.takes'), tabBarIcon: icon('💾') }} />
    </Tabs>
  );
}
