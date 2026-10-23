import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { statusBarStyle } from '../src/core/prefs';
import { useT } from '../src/i18n/react';
import { PlusThemeProvider } from '../src/plus/themes';
import { LifecycleProvider } from '../src/state/lifecycle';
import { PrefsProvider } from '../src/state/prefs';
import { RatingPromptHost } from '../src/state/useRatingPrompt';
import { useQuietUpdate } from '../src/state/useQuietUpdate';
import { SessionProvider } from '../src/state/session';
import { ToastHost } from '../src/ui/Toast';
import { registerBlurView, type BlurViewLike } from '../src/ui/v2/blurRegistry';
import { useReducedMotion } from '../src/theme/useReducedMotion';
import { useScheme, useTheme } from '../src/theme/useTheme';

// Oversight D72-1: real glass behind v2 materials (expo-blur ships in Expo Go). BlurMaterial still
// draws its solid AA fallback with Reduce Transparency and on Android.
registerBlurView(BlurView as unknown as BlurViewLike);

SplashScreen.preventAutoHideAsync().catch(() => {});
// Premium polish rule 6: the splash fades into the first screen once fonts are loaded.
try {
  SplashScreen.setOptions?.({ duration: 320, fade: true });
} catch {
  // Older expo-splash-screen without setOptions: plain hide.
}

export default function RootLayout() {
  // owner-1016 R2: quiet OTA check (no-op in Expo Go and development).
  useQuietUpdate();
  const [loaded, error] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // Fall back to system fonts if loading fails; never block the remote on fonts.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <PrefsProvider>
        {/* Remote-theme access (owner-1017): Plus unlock + "Try it", read by useRemoteTheme(). */}
        <PlusThemeProvider>
          <SessionProvider>
            <LifecycleProvider>
              <RootStack />
              {/* Toasts draw above every screen (premium polish rule 5). */}
              <ToastHost />
              <RatingPromptHost />
            </LifecycleProvider>
          </SessionProvider>
        </PlusThemeProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}

/** Inside PrefsProvider so the Theme setting drives colours and the status bar. */
function RootStack() {
  const theme = useTheme();
  const t = useT();
  const scheme = useScheme();
  const reduce = useReducedMotion();
  return (
    <>
      <StatusBar style={statusBarStyle(scheme)} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          // Premium polish rule 2: pushes use the native slide; modals use the native sheet (springs up, dims behind).
          animation: reduce ? 'fade' : 'default',
          animationDuration: 300,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: t('app.settings.title'),
            headerStyle: { backgroundColor: theme.body },
            headerTintColor: theme.ink,
          }}
        />
        <Stack.Screen
          name="diagnostics"
          options={{
            headerShown: true,
            title: t('app.diagnostics.title'),
            headerStyle: { backgroundColor: theme.body },
            headerTintColor: theme.ink,
          }}
        />
        <Stack.Screen
          name="add-tv"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: t('app.addTv.title'),
            headerStyle: { backgroundColor: theme.body },
            headerTintColor: theme.ink,
          }}
        />
        <Stack.Screen name="choose-apps" options={{ headerShown: true, title: t('app.chooseApps.title'), headerStyle: { backgroundColor: theme.body }, headerTintColor: theme.ink }} />
        <Stack.Screen name="themes" options={{ headerShown: true, title: t('app.themes.title'), headerStyle: { backgroundColor: theme.body }, headerTintColor: theme.ink }} />
        <Stack.Screen name="plus" options={{ headerShown: true, title: t('app.plus.title'), headerStyle: { backgroundColor: theme.body }, headerTintColor: theme.ink }} />
        <Stack.Screen name="add-tv-ir" options={{ presentation: 'modal', headerShown: true, title: t('app.addTvIr.title'), headerStyle: { backgroundColor: theme.body }, headerTintColor: theme.ink }} />
      </Stack>
    </>
  );
}
