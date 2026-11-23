import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useApp } from '../../src/state/AppState';
import { FONT } from '../../src/theme/theme';
import { Icon } from '../../src/ui/kit';

export default function TabLayout() {
  const { theme } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.ink,
        tabBarInactiveTintColor: theme.ink2,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.line, borderTopWidth: theme.name === 'sun' ? 2 : StyleSheet.hairlineWidth, height: 92, paddingTop: 8 },
        tabBarLabelStyle: { fontFamily: FONT.bold, fontSize: 13 },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarButtonTestID: 'tab-index', title: 'Tools', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'calculator-variant' : 'calculator-variant-outline'} size={30} color={color as string} /> }} />
      <Tabs.Screen name="jobs" options={{ tabBarButtonTestID: 'tab-jobs', title: 'Jobs', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'clipboard-text' : 'clipboard-text-outline'} size={30} color={color as string} /> }} />
      <Tabs.Screen name="settings" options={{ tabBarButtonTestID: 'tab-settings', title: 'Settings', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'cog' : 'cog-outline'} size={30} color={color as string} /> }} />
    </Tabs>
  );
}
