import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from '../src/state/AppState';
import { FONT } from '../src/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Shell fontsReady={fontsLoaded || !!fontError} />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

/** No route-name flash: the splash stays until settings and fonts are in (2.5 s safety net). */
function Shell({ fontsReady }: { fontsReady: boolean }) {
  const { loaded, theme } = useApp();
  const [timedOut, setTimedOut] = useState(false);
  const ready = loaded && (fontsReady || timedOut);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  useEffect(() => {
    const id = setTimeout(() => { setTimedOut(true); SplashScreen.hideAsync().catch(() => undefined); }, 2500);
    return () => clearTimeout(id);
  }, []);
  if (!ready) return null;
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.ground },
    headerTintColor: theme.ink,
    headerTitleStyle: { color: theme.ink, fontSize: 20, fontFamily: FONT.numBold },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
  } as const;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.ground }, statusBarStyle: theme.dark ? 'light' : 'dark' }}>
      <Stack.Screen name="(tabs)" options={{ title: 'Tools' }} />
      <Stack.Screen name="tool/[id]" options={{ ...header, title: '' }} />
      <Stack.Screen name="job/[id]" options={{ ...header, title: '' }} />
      <Stack.Screen name="checklist" options={{ ...header, title: 'Pour & curing checklist' }} />
      <Stack.Screen name="sources" options={{ ...header, title: 'Sources' }} />
      <Stack.Screen name="unlock" options={{ presentation: 'modal', title: 'Full Unlock' }} />
    </Stack>
  );
}
