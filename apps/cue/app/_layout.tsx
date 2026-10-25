import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t } from '../src/i18n';
import { AppStateProvider, useApp } from '../src/state/AppState';
import { useQuietUpdate } from '../src/state/useQuietUpdate';
import { FONT } from '../src/theme/theme';
import { LaunchIntro } from '../src/ui/LaunchIntro';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
try {
  SplashScreen.setOptions?.({ duration: 300, fade: true });
} catch {
  /* older splash module */
}

export default function RootLayout() {
  useQuietUpdate();
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <Shell fontsReady={fontsLoaded || !!fontError} />
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Starter-standard "no index flash": the splash stays until scripts, prefs and fonts are loaded and
 * nothing renders behind it until then (2.5 s safety net: never an endless splash; system fonts until loaded).
 */
function Shell({ fontsReady }: { fontsReady: boolean }) {
  const { loaded, theme, reduceMotion, prefs } = useApp();
  const [timedOut, setTimedOut] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  // Read synchronously at startup, so the intro never flashes before the async Reduce Motion check lands.
  const sysReducedNow = useReducedMotion();
  const skipIntro = reduceMotion || (prefs.reduceMotion === 'system' && sysReducedNow);
  const ready = loaded && (fontsReady || timedOut);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  // Portrait app; only the prompter unlocks landscape.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => {
      setTimedOut(true);
      SplashScreen.hideAsync().catch(() => undefined);
    }, 2500);
    return () => clearTimeout(id);
  }, []);
  if (!ready) return null;
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.bg },
    headerTintColor: theme.accentText,
    headerTitleStyle: { fontFamily: FONT.displaySemi, color: theme.ink, fontSize: 17 },
    headerLargeTitleStyle: { fontFamily: FONT.display, color: theme.ink },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
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
        <Stack.Screen name="index" options={{ ...header, title: t('library.title'), headerLargeTitle: true, headerLargeTitleShadowVisible: false }} />
        <Stack.Screen name="edit/[id]" options={{ ...header, title: '' }} />
        <Stack.Screen name="prompt/[id]" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'fade' : 'fade_from_bottom' }} />
        <Stack.Screen name="record/[id]" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'fade' : 'fade_from_bottom' }} />
        <Stack.Screen name="settings" options={{ ...header, title: t('settings.title') }} />
        <Stack.Screen name="plus" options={{ ...header, presentation: 'modal', title: '' }} />
      </Stack>
      {!introDone && !skipIntro ? <LaunchIntro onDone={() => setIntroDone(true)} /> : null}
    </>
  );
}
