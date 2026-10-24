// Root: the splash stays up until settings, stats and Plus have loaded, so the first screen never flashes an
// empty "index" view (App Factory lesson from Linework/Couch). First launch shows the 3-step how-to.
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/state/app.tsx';

SplashScreen.preventAutoHideAsync().catch(() => {});
try {
  SplashScreen.setOptions?.({ duration: 250, fade: true });
} catch {
  // older splash module
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { ready, theme, prefs, t } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    if (!prefs.introSeen) setTimeout(() => router.push('/intro'), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  // Never an endless splash: hide after 4 s even if storage is slow.
  useEffect(() => {
    const id = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(id);
  }, []);
  const header = { headerShown: true, headerStyle: { backgroundColor: theme.bg }, headerTintColor: theme.ink, headerShadowVisible: false } as const;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {ready ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg }, animation: 'default' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="round" options={{ ...header, title: t('round.title') }} />
          <Stack.Screen name="pack/[id]" options={{ ...header, title: '' }} />
          <Stack.Screen name="party-play" options={{ ...header, title: t('party.title'), gestureEnabled: false }} />
          <Stack.Screen name="settings" options={{ ...header, title: t('settings.title') }} />
          <Stack.Screen name="plus" options={{ ...header, presentation: 'modal', title: t('plus.title') }} />
          <Stack.Screen name="intro" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        </Stack>
      ) : null}
    </View>
  );
}
