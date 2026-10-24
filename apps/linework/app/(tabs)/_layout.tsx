// Tab group (T81, PLAN §3; Workshop added 24 Oct 2026): Trace (Home, /) · Templates · Workshop · My drawings · Settings under a frosted bottom tab bar
// (src/ui/v2/TabBarV2.tsx, tab list in src/core/tabs.ts). The (tabs) group adds no path segment, so the URLs stay
// /, /templates, /drawings and /settings. Prepare / Trace / Lightbox / Plus are full-screen routes on the root Stack
// (app/_layout.tsx) and cover the bar when pushed.
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { useT } from '../../src/i18n';
import { TabBarV2, type TabBarNavigation } from '../../src/ui/v2/TabBarV2';

export default function TabsLayout() {
  const { c, typo } = useTheme();
  const { t } = useT(); // re-renders tab titles when the language changes
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => (
        <TabBarV2 state={props.state} navigation={props.navigation as unknown as TabBarNavigation} />
      )}
      screenOptions={{
        // Home, Templates and Settings draw their own large titles; My drawings opts into the header below.
        headerShown: false,
        headerStyle: { backgroundColor: c.paper },
        headerTintColor: c.graphite,
        headerTitleStyle: typo.face('display'),
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('common.nav.trace') }} />
      <Tabs.Screen name="templates" options={{ title: t('common.nav.templates') }} />
      <Tabs.Screen name="workshop" options={{ title: t('common.nav.workshop') }} />
      <Tabs.Screen name="drawings" options={{ title: t('drawings.title'), headerShown: true }} />
      <Tabs.Screen name="settings" options={{ title: t('common.nav.settings') }} />
    </Tabs>
  );
}
