// Root: the splash stays up until fonts, settings and jobs have loaded (no flash of an unstyled screen; 4 s cap).
import { BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, useFonts as useCondensed } from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JobsProvider, useJobs } from '../src/state/jobs.tsx';
import { SettingsProvider, useSettings } from '../src/state/settings.tsx';
import { fonts, useTheme } from '../src/theme/theme.ts';
import { loadLastInputs } from '../src/ui/ToolShell.tsx';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <JobsProvider>
          <Shell />
        </JobsProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const t = useTheme();
  const { ready, settings } = useSettings();
  const segments = useSegments();
  const { loaded } = useJobs();
  const [lastReady, setLastReady] = useState(false);
  const [a, aErr] = useFonts({ ...Ionicons.font });
  const [b, bErr] = useCondensed({ BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold });
  useEffect(() => {
    loadLastInputs().finally(() => setLastReady(true));
  }, []);
  const show = ready && loaded && lastReady && (a || !!aErr) && (b || !!bErr);
  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => {});
  }, [show]);
  // First launch: ask the country before anything else (app/welcome.tsx).
  useEffect(() => {
    if (show && !settings.country && segments[0] !== 'welcome') router.replace('/welcome');
  }, [show, settings.country, segments]);
  useEffect(() => {
    const id = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(id);
  }, []);
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: t.bg },
    headerTintColor: t.ink,
    headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
    headerShadowVisible: false,
    headerBackTitle: 'Tools',
  } as const;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {show ? (
        <Stack screenOptions={{ ...header, contentStyle: { backgroundColor: t.bg } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'Trammel Full Unlock' }} />
          <Stack.Screen name="job/[id]" options={{ title: 'Job', headerBackTitle: 'Jobs' }} />
          <Stack.Screen name="about" options={{ title: 'About the maths', headerBackTitle: 'Settings' }} />
          <Stack.Screen name="country" options={{ title: 'Country', headerBackTitle: 'Settings' }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        </Stack>
      ) : null}
    </View>
  );
}
