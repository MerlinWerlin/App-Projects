import { Tabs } from 'expo-router';
import { useTheme } from '../../src/theme/theme.ts';
import { Icon, type IconName } from '../../src/ui/Icon.tsx';

const icon = (on: IconName, off: IconName) => ({ color, focused }: { color: unknown; focused: boolean }) => <Icon name={focused ? on : off} color={color as string} size={22} />;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      animation: 'none',
      tabBarActiveTintColor: t.ink,
      tabBarInactiveTintColor: t.ink3,
      tabBarStyle: { backgroundColor: t.ground, borderTopColor: t.line },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Tools', tabBarIcon: icon('toolsOn', 'tools') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: icon('jobsOn', 'jobs') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settingsOn', 'settings') }} />
    </Tabs>
  );
}
