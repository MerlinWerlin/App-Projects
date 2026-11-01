import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Unbounded_500Medium, Unbounded_700Bold } from '@expo-google-fonts/unbounded';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { durations } from '../src/theme/motion';
import { INTRO_MS, startupReady } from '../src/core/introGlaze';
import { I18nProvider, loadLocaleOverride, useT } from '../src/i18n';
import { startLaunchWork } from '../src/store/launchWork';
import { textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { ErrorFallback } from '../src/ui/ErrorBoundary';
import { IntroGlaze } from '../src/ui/IntroGlaze';
import { ToastProvider } from '../src/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});
// T250: nothing heavy at module load. Downloaded packs' motifs (T50) are restored by the first
// deferred step, and src/store/studio.ts awaits the same memoised promise before it parses a style.
// The native splash (the unlit Prism diamond on the dark bg) hands over to IntroGlaze on its first frame; the two are drawn
// identically, so this fade is invisible (POLISH rule 6).
try {
  SplashScreen.setOptions({ fade: true, duration: durations.slow });
} catch {
  // Older expo-splash-screen: plain hide.
}

/** expo-router renders this in place of any route below that throws while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    // Never leave the splash screen up over the fallback.
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <ErrorFallback
        error={error}
        onRetry={() => {
          retry().catch(() => {});
        }}
      />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const { c, scheme } = useColorsV2();
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Unbounded_500Medium,
    Unbounded_700Bold,
    // Preload the glyph font so batch icon capture never paints blank glyphs.
    ...Feather.font,
  });

  // The saved language is read once at launch (I18nProvider shares the same promise), so the first app frame is
  // already in the right language when the intro fades.
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    loadLocaleOverride()
      .catch(() => null)
      .finally(() => setI18nReady(true));
  }, []);

  // T250 (owner-1101h #1): the launch work (T50 pack motifs, T125 widget theme re-write to the App Group,
  // T229 installed-apps check, at most daily) is queued here and runs only after the first screen has drawn,
  // one deferred step at a time (src/store/launchWork.ts). Nothing here awaits it.
  useEffect(() => {
    startLaunchWork();
  }, []);

  // Never an endless splash: go ahead after INTRO_MS.maxWait even if fonts or languages are still loading.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), INTRO_MS.maxWait);
    return () => clearTimeout(id);
  }, []);
  // If fonts fail we still render with system fonts rather than block the app.
  const ready = startupReady(loaded || !!error, i18nReady, timedOut ? INTRO_MS.maxWait : 0);

  useEffect(() => {
    // Belt and braces: IntroGlaze hides the splash on its first frame; never leave it up once the app can show.
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Opening: a beam of light through the Prism diamond (full screen), then the intro fades over the app. In a store build the app's native
  // screens draw over any JS view above the navigator (Linework fb-1023), so the intro is a sibling after the app and
  // the app mounts only once the intro starts fading (onReveal), never on top of it. The intro keeps its place in the
  // tree before and after `ready`, so it never restarts.
  const [revealed, setRevealed] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const intro = introDone ? null : (
    <IntroGlaze ready={ready} dark={scheme === 'dark'} onReveal={() => setRevealed(true)} onDone={() => setIntroDone(true)} />
  );

  // (Built in an if-block, not a ternary: same meaning as `ready && revealed ? (...) : null`.)
  let app: ReactNode = null;
  if (ready && revealed) {
    app = (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <I18nProvider>
            <ToastProvider>
              <RootStack />
            </ToastProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {app}
      {intro}
    </View>
  );
}

/** The stack lives under I18nProvider so its titles follow the app language. */
function RootStack() {
  const { c } = useColorsV2();
  const { t } = useT();
  return (
    <Stack
      screenOptions={{
        // Design v2 (T83): grouped bg header, berry tint, system navTitle (covers every script).
        // fb-1024 A: a route without its own title shows nothing, never its file name ("index").
        title: '',
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.tint,
        headerTitleStyle: { fontSize: textV2.navTitle.fontSize, fontWeight: '600', color: c.ink },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
        // Native slide for pushes (POLISH rule 2); iOS keeps the interactive back swipe.
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      {/* The redirect to Themes: no header and no transition, so nothing flashes between the intro and Themes. */}
      <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="theme/[id]" options={{ title: t('theme.title') }} />
      <Stack.Screen name="install" options={{ title: t('install.title') }} />
      <Stack.Screen name="icons-cleanup" options={{ title: t('install.cleanup.title') }} />
      <Stack.Screen name="wallpaper" options={{ title: t('wallpaper.title') }} />
      <Stack.Screen name="collage" options={{ title: t('wallpaper.collage.title') }} />
      {/* T186: the Live Photo maker left the tab bar; it draws its own large title and back button. */}
      <Stack.Screen name="live/index" options={{ headerShown: false }} />
      <Stack.Screen name="live/[id]" options={{ title: t('live.editTitle') }} />
      <Stack.Screen name="feedback" options={{ title: t('feedback.title') }} />
      <Stack.Screen name="add-app" options={{ title: t('addApp.title') }} />
      <Stack.Screen name="home-scan" options={{ title: t('addApp.scan.title') }} />
      <Stack.Screen name="tips" options={{ title: t('tips.title') }} />
      <Stack.Screen name="habit-goals" options={{ title: t('tabs.widgetsTab.goals.title') }} />
      <Stack.Screen name="widget-studio" options={{ title: t('themeUi.widgetStudio.title') }} />
    </Stack>
  );
}
