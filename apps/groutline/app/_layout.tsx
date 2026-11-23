// Root: splash stays up until fonts and stored prefs load, then the country picker shows on first launch.
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, useFonts } from '@expo-google-fonts/barlow-condensed';
import { Redirect, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/state/AppState.tsx';
import { useTheme } from '../src/theme/theme.ts';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Web preview only (design checks): react-native-svg's web shim warns about native accessibility props.
if (Platform.OS === 'web') LogBox.ignoreAllLogs();

export const unstable_settings = { initialRouteName: '(tabs)' };

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
  const { ready, prefs } = useApp();
  const t = useTheme();
  const path = usePathname();
  const [loaded, error] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });
  const show = ready && (loaded || !!error);
  useEffect(() => { if (show) SplashScreen.hideAsync().catch(() => {}); }, [show]);
  useEffect(() => { const id = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000); return () => clearTimeout(id); }, []);
  if (!show) return null;
  const needsCountry = prefs.country === null && path !== '/welcome';
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {needsCountry ? <Redirect href="/welcome" /> : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.ground },
          headerTintColor: t.ink,
          headerTitleStyle: { fontWeight: '700', color: t.ink },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: t.ground },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Tools' }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="unlock" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="country" options={{ presentation: 'modal', title: 'Country' }} />
        <Stack.Screen name="standards" options={{ title: 'Standards & rules' }} />
        <Stack.Screen name="tool/tiles" options={{ title: 'Tiles & boxes' }} />
        <Stack.Screen name="tool/setout" options={{ title: 'Set-out' }} />
        <Stack.Screen name="tool/materials" options={{ title: 'Materials' }} />
        <Stack.Screen name="tool/falls" options={{ title: 'Falls' }} />
        <Stack.Screen name="tool/trim" options={{ title: 'Trim' }} />
        <Stack.Screen name="tool/stairs" options={{ title: 'Stairs' }} />
      </Stack>
    </>
  );
}
