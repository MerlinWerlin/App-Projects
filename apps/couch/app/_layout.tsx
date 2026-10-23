import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { INTRO_MS, startupReady } from '../src/core/introRemote';
import { statusBarStyle } from '../src/core/prefs';
import { useT } from '../src/i18n/react';
import { PlusThemeProvider } from '../src/plus/themes';
import { LifecycleProvider } from '../src/state/lifecycle';
import { PrefsProvider, usePrefs } from '../src/state/prefs';
import { RatingPromptHost } from '../src/state/useRatingPrompt';
import { useQuietUpdate } from '../src/state/useQuietUpdate';
import { SessionProvider } from '../src/state/session';
import { IntroRemote } from '../src/ui/IntroRemote';
import { ToastHost } from '../src/ui/Toast';
import { registerBlurView, type BlurViewLike } from '../src/ui/v2/blurRegistry';
import { useReducedMotion } from '../src/theme/useReducedMotion';
import { useScheme, useTheme } from '../src/theme/useTheme';

// Oversight D72-1: real glass behind v2 materials (expo-blur ships in Expo Go). BlurMaterial still
// draws its solid AA fallback with Reduce Transparency and on Android.
registerBlurView(BlurView as unknown as BlurViewLike);

SplashScreen.preventAutoHideAsync().catch(() => {});
// Premium polish rule 6: the splash fades into the first screen. night-intro: the splash image is the intro's first
// frame (same art, size and place), so this short fade only smooths the hand-over to IntroRemote.
try {
  SplashScreen.setOptions?.({ duration: INTRO_MS.splashFade, fade: true });
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

  // Never an endless splash: go ahead after INTRO_MS.maxWait even if fonts are still loading (system fonts until then).
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), INTRO_MS.maxWait);
    return () => clearTimeout(id);
  }, []);
  // The i18n catalogues are bundled (synchronous), so only fonts can hold startup back.
  const ready = startupReady(loaded || !!error, true, timedOut ? INTRO_MS.maxWait : 0);

  // Providers mount at once (saved TVs restore and discovery start while the intro plays); only the navigator waits.
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        {/* Remote-theme access (owner-1017): Plus unlock + "Try it", read by useRemoteTheme(). */}
        <PlusThemeProvider>
          <SessionProvider>
            <LifecycleProvider>
              <RootShell ready={ready} />
            </LifecycleProvider>
          </SessionProvider>
        </PlusThemeProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}

/**
 * night-intro: the app and the opening animation side by side. Linework fb-1023 lesson: in a store build the
 * navigator's native screens draw over any JS view above them, so the intro is the LAST sibling and the navigator only
 * mounts when the intro starts fading (onReveal). The intro keeps its place in the tree, so it never restarts.
 */
function RootShell({ ready }: { ready: boolean }) {
  const theme = useTheme();
  const { prefs, loaded } = usePrefs();
  const [revealed, setRevealed] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const app =
    ready && revealed ? (
      <>
        <RootStack />
        {/* Toasts draw above every screen (premium polish rule 5). */}
        <ToastHost />
        <RatingPromptHost />
      </>
    ) : null;
  const intro = introDone ? null : (
    <IntroRemote
      ready={ready}
      haptics={loaded && prefs.haptics}
      onReveal={() => setRevealed(true)}
      onDone={() => setIntroDone(true)}
    />
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {app}
      {intro}
    </View>
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
