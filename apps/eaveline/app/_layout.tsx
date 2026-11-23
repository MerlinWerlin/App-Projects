import { ArchivoNarrow_600SemiBold, ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from '../src/state/AppState';
import { FONT } from '../src/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ ArchivoNarrow_600SemiBold, ArchivoNarrow_700Bold, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Shell fontsReady={fontsLoaded || !!fontError} />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const TITLES: Record<string, string> = {
  roof: 'Roof size & area', pitch: 'Pitch', level: 'Phone level', rafter: 'Rafters, hips & valleys', sheets: 'Sheets', tiles: 'Tiles & battens',
  shingles: 'Shingles', flashings: 'Flashings & cappings', fall: 'Gutter fall', downpipes: 'Downpipes', fixings: 'Fixings',
  sources: 'Standards & sources', safety: 'Working at heights', 'job/[id]': 'Job',
};

function Shell({ fontsReady }: { fontsReady: boolean }) {
  const { loaded, theme, prefs, country } = useApp();
  const [timedOut, setTimedOut] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const ready = loaded && (fontsReady || timedOut);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  useEffect(() => {
    const id = setTimeout(() => { setTimedOut(true); SplashScreen.hideAsync().catch(() => undefined); }, 2500);
    return () => clearTimeout(id);
  }, []);
  // Country comes first: until one is chosen, onboarding is the only screen.
  useEffect(() => {
    if (!ready) return;
    const onOnboarding = segments[0] === 'onboarding';
    if (!prefs.country && !onOnboarding) router.replace('/onboarding');
  }, [ready, prefs.country, segments, router]);
  if (!ready) return null;
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.ground },
    headerTintColor: theme.ink,
    headerTitleStyle: { color: theme.ink, fontFamily: FONT.display, fontSize: 20 },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
  } as const;
  const words = country.terms;
  const titles = { ...TITLES, fall: `${words.gutter[0]!.toUpperCase()}${words.gutter.slice(1)} fall`, downpipes: `${words.downpipes[0]!.toUpperCase()}${words.downpipes.slice(1)}` };
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="unlock" options={{ presentation: 'modal' }} />
        {Object.entries(titles).map(([name, title]) => <Stack.Screen key={name} name={name} options={{ ...header, title }} />)}
      </Stack>
    </>
  );
}
