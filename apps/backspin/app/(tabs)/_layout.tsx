import { Tabs } from 'expo-router';
import { useApp } from '../../src/state/app.tsx';
import { Icon, type IconName } from '../../src/ui/icons.tsx';

const icon = (name: IconName) => ({ color }: { color: unknown }) => <Icon name={name} size={24} color={typeof color === 'string' ? color : '#888888'} />;

export default function TabsLayout() {
  const { t, theme } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.recText,
        tabBarInactiveTintColor: theme.sub,
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.line },
        tabBarLabelStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.play'), tabBarIcon: icon('mic') }} />
      <Tabs.Screen name="packs" options={{ title: t('tab.packs'), tabBarIcon: icon('packs') }} />
      <Tabs.Screen name="party" options={{ title: t('tab.party'), tabBarIcon: icon('party') }} />
      <Tabs.Screen name="takes" options={{ title: t('tab.takes'), tabBarIcon: icon('takes') }} />
    </Tabs>
  );
}
