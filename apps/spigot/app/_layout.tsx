import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/state/AppState';
import { font, usePalette } from '../src/ui/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Root() {
  const c = usePalette();
  const { loaded, prefs } = useApp();
  const segments = useSegments();
  const [fontsLoaded, fontError] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold });
  const ready = loaded && (fontsLoaded || !!fontError);
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  // First launch: ask where the person works before anything else (one step, device region pre-selected).
  const needsCountry = ready && prefs.country === null && segments[0] !== 'welcome';
  useEffect(() => { if (needsCountry) router.replace('/welcome'); }, [needsCountry]);
  if (!ready) return null;
  return (
    <>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.copper,
          headerTitleStyle: { fontFamily: font.display, fontSize: 22, color: c.ink },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Tools' }} />
        <Stack.Screen name="unlock" options={{ presentation: 'modal', title: 'Spigot Full Unlock' }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <Root />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
