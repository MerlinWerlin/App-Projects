import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useApp } from '../../src/state/AppState.tsx';

type Icon = keyof typeof Ionicons.glyphMap;
const TABS: { name: string; title: string; icon: Icon; on: Icon }[] = [
  { name: 'index', title: 'Bend', icon: 'git-merge-outline', on: 'git-merge' },
  { name: 'drop', title: 'V-Drop', icon: 'trending-down-outline', on: 'trending-down' },
  { name: 'fill', title: 'Fill', icon: 'ellipse-outline', on: 'ellipse' },
  { name: 'power', title: 'Power', icon: 'flash-outline', on: 'flash' },
  { name: 'tools', title: 'Tools', icon: 'construct-outline', on: 'construct' },
];

export default function TabsLayout() {
  const { theme } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.dark ? theme.accent : theme.ink,
        tabBarInactiveTintColor: theme.ink2,
        tabBarStyle: { backgroundColor: theme.tabBar, borderTopColor: theme.line, borderTopWidth: theme.rule},
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarAllowFontScaling: false,
      }}
    >
      {TABS.map(t => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title,
          tabBarAccessibilityLabel: t.title === 'V-Drop' ? 'Voltage drop' : t.title,
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? t.on : t.icon} size={26} color={color as string} />,
        }} />
      ))}
    </Tabs>
  );
}
