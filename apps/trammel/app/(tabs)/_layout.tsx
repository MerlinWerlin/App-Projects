import { Tabs } from 'expo-router';
import { fonts, useTheme, sys } from '../../src/theme/theme.ts';
import { Icon, type IconName } from '../../src/ui/Icon.tsx';

export default function TabsLayout() {
  const t = useTheme();
  const icon =
    (on: IconName, off: IconName) =>
    ({ focused, color, size }: { focused: boolean; color: unknown; size: number }) => <Icon name={focused ? on : off} size={size - 2} color={color as string} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.ink,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
        headerShadowVisible: false,
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.line },
        tabBarLabelStyle: { ...sys.bodyBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Tools', headerShown: false, tabBarIcon: icon('toolsOn', 'tools') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: icon('jobsOn', 'jobs') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settingsOn', 'settings') }} />
    </Tabs>
  );
}
