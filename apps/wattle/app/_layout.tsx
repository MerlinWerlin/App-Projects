import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from '../src/state/AppState.tsx';
import { DoneBar } from '../src/ui/kit.tsx';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
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

function Shell() {
  const { loaded, theme } = useApp();
  const [timedOut, setTimedOut] = useState(false);
  const ready = loaded || timedOut;
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 2500); // never an endless splash
    return () => clearTimeout(id);
  }, []);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  if (!ready) return null;
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.ground },
    headerTintColor: theme.ink,
    headerTitleStyle: { color: theme.ink, fontWeight: '700' as const },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
  };
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="unlock" options={{ presentation: 'modal' }} />
        <Stack.Screen name="save" options={{ ...header, presentation: 'formSheet', title: 'Save to a job', sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true }} />
        <Stack.Screen name="runs" options={{ ...header, title: '' }} />
        <Stack.Screen name="convert" options={{ ...header, title: '' }} />
        <Stack.Screen name="jobs" options={{ ...header, title: '' }} />
        <Stack.Screen name="job/[id]" options={{ ...header, title: '' }} />
        <Stack.Screen name="settings" options={{ ...header, title: '' }} />
        <Stack.Screen name="about" options={{ ...header, title: '' }} />
      </Stack>
      <DoneBar />
    </>
  );
}
