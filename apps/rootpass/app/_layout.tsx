import { Barlow_500Medium, Barlow_700Bold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from '../src/state/AppState.tsx';
import { C, FONT } from '../src/ui/theme.ts';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Barlow_500Medium, Barlow_700Bold, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Shell fontsReady={fontsLoaded || !!fontError} />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

/** The splash stays until prefs, jobs and fonts are ready (2.5 s safety net: never an endless splash). */
function Shell({ fontsReady }: { fontsReady: boolean }) {
  const { loaded } = useApp();
  const [timedOut, setTimedOut] = useState(false);
  const ready = (loaded && fontsReady) || timedOut;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(id);
  }, []);
  if (!ready) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: C.ground },
          headerStyle: { backgroundColor: C.ground },
          headerTintColor: C.accent,
          headerTitleStyle: { color: C.ink, fontFamily: FONT.display, fontSize: 21 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Tools' }} />
        <Stack.Screen name="unlock" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </>
  );
}
