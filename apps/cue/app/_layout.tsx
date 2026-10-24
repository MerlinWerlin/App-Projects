import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t } from '../src/i18n';
import { AppStateProvider, useApp } from '../src/state/AppState';
import { useQuietUpdate } from '../src/state/useQuietUpdate';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
try {
  SplashScreen.setOptions?.({ duration: 250, fade: true });
} catch {
  /* older splash module */
}

export default function RootLayout() {
  useQuietUpdate();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <Shell />
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Starter-standard "no index flash": the splash stays until scripts and prefs are loaded, and nothing
 * renders behind it until then (with a 2.5 s safety net so it can never hang).
 */
function Shell() {
  const { loaded, theme, reduceMotion } = useApp();
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);
  // Portrait app; only the prompter unlocks landscape.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => SplashScreen.hideAsync().catch(() => undefined), 2500);
    return () => clearTimeout(id);
  }, []);
  if (!loaded) return null;
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.bg },
    headerTintColor: theme.ink,
    headerShadowVisible: false,
  } as const;
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          animation: reduceMotion ? 'fade' : 'default',
        }}
      >
        <Stack.Screen name="index" options={{ ...header, title: t('library.title'), headerLargeTitle: true }} />
        <Stack.Screen name="edit/[id]" options={{ ...header, title: '' }} />
        <Stack.Screen name="prompt/[id]" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
        <Stack.Screen name="record/[id]" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
        <Stack.Screen name="settings" options={{ ...header, title: t('settings.title') }} />
        <Stack.Screen name="plus" options={{ ...header, presentation: 'modal', title: t('plus.title') }} />
      </Stack>
    </>
  );
}
