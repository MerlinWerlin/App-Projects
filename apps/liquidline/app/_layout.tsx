import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, useFonts } from '@expo-google-fonts/barlow-condensed';
import { Redirect, router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useLoaded, useSettings } from '../src/state/store.ts';
import { usePalette } from '../src/theme/tokens.ts';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Close({ label = 'Close' }: { label?: string }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={{ paddingHorizontal: 4, minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ fontSize: 17, color: p.text }}>{label}</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold });
  const loaded = useLoaded();
  const settings = useSettings();
  const p = usePalette();
  const scheme = useColorScheme();
  const path = usePathname();
  const ready = loaded && fontsLoaded;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  const needsOnboarding = !settings.onboarded && !path.startsWith('/onboarding');

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {needsOnboarding ? <Redirect href="/onboarding" /> : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.bg },
          headerTintColor: p.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: p.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="refrigerants" options={{ presentation: 'modal', headerLeft: () => <Close label="Cancel" />, title: 'Refrigerant' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', headerLeft: () => <Close label="Close" />, title: '' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="load" options={{ title: 'Room load estimate' }} />
        <Stack.Screen name="lineset" options={{ title: 'Line set & pipe' }} />
        <Stack.Screen name="evac" options={{ title: 'Evacuation' }} />
        <Stack.Screen name="convert" options={{ title: 'Converter' }} />
        <Stack.Screen name="flare" options={{ title: 'Flare torque' }} />
        <Stack.Screen name="chart" options={{ title: 'PT chart' }} />
        <Stack.Screen name="info" options={{ title: 'Refrigerant facts' }} />
        <Stack.Screen name="sources" options={{ title: 'Sources & standards' }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
        <Stack.Screen name="save" options={{ presentation: 'modal', headerLeft: () => <Close label="Cancel" />, title: 'Save to job' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
