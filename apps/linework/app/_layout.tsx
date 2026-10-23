import { useEffect, useState } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useTheme } from '../src/theme/useTheme';
import { radius, space, touch } from '../src/theme/tokens';
import { loadSettings } from '../src/native/settings';
import { setHapticsEnabled } from '../src/native/haptics';
import { pruneOutlineCache } from '../src/native/outlineDeps';
import { initI18n, useDeviceLanguageWatcher, useT } from '../src/i18n';
import { startupDirectionCheck } from '../src/i18n/direction';
import { checkForUpdateQuietly } from '../src/native/updates';
import { IntroDraw } from '../src/ui/IntroDraw';
import { INTRO_MS, startupReady } from '../src/core/introPath';
import { isRTL } from '../src/i18n/direction';

// Trace runs on a dark camera view; its backdrop is the dark graphite so Prepare → Trace fades through graphite.
const GRAPHITE = '#14130F';
// iOS push/pop duration (ms); Android uses the platform default. Polish rule 2: nothing over ~350 ms.
const NAV_MS = 300;

// T81: a deep link straight to a stack route (e.g. /trace) still gets the tab group underneath, so Back lands on it.
export const unstable_settings = { initialRouteName: '(tabs)' };

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { c, isDark, typo } = useTheme();
  const { t } = useT(); // re-renders navigation titles when the language changes
  useDeviceLanguageWatcher();
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    initI18n()
      .then(() => startupDirectionCheck())
      .catch(() => {})
      .finally(() => setI18nReady(true));
    // EAS Update: downloads a newer JS bundle in the background for the next launch; no-op in Expo Go / dev.
    try {
      checkForUpdateQuietly().catch(() => {});
    } catch {
      // ignore
    }
  }, []);
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    loadSettings()
      .then((st) => setHapticsEnabled(st.haptics))
      .catch(() => {});
  }, []);

  // Drop old outline PNGs once per launch (keeps the newest few). Never blocks or throws.
  useEffect(() => {
    try {
      pruneOutlineCache().catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  // D111-2: never an endless splash — go ahead after INTRO_MS.maxWait even if fonts or languages are still loading.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), INTRO_MS.maxWait);
    return () => clearTimeout(id);
  }, []);
  const ready = startupReady(loaded || !!error, i18nReady, timedOut ? INTRO_MS.maxWait : 0);
  // Opening (fb-1022c): the native splash hands over to IntroDraw on its first frame; the pencil draws the brand line,
  // light runs along it while fonts and languages load, then it fades away over the app. Never takes touches.
  const [introDone, setIntroDone] = useState(false);
  const intro = introDone ? null : <IntroDraw ready={ready} dark={isDark} onDone={() => setIntroDone(true)} />;

  // If fonts fail to load we still render with system fonts. The intro stays in the same place in the tree before and
  // after `ready`, so it never restarts.
  const app = ready ? (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.paper }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.paper },
            headerTintColor: c.graphite,
            // Script-aware: Fraunces for Latin, system font (with a matching weight) for CJK / Devanagari / Arabic.
            headerTitleStyle: loaded ? typo.face('display') : { fontFamily: undefined },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: c.paper },
            // Pushes slide in from the reading direction's end (mirrored for right-to-left languages).
            animation: isRTL() ? 'slide_from_left' : 'slide_from_right',
            animationDuration: NAV_MS,
          }}
        >
          {/* T81: Trace (Home) / Templates / My drawings / Settings live in the (tabs) group under the bottom tab bar;
              the routes below are full-screen and cover it. */}
          <Stack.Screen name="(tabs)" options={{ title: t('common.appName'), headerShown: false }} />
          <Stack.Screen name="prepare" options={{ title: t('common.nav.prepare') }} />
          <Stack.Screen
            name="trace"
            options={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: GRAPHITE } }}
          />
          <Stack.Screen name="lightbox" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="plus" options={{ title: t('common.nav.plus') }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {app}
      {intro}
    </View>
  );
}

// Shown by Expo Router if any screen throws while rendering.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  const { t } = useT();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: c.paper }}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ fontSize: 24, fontWeight: '600', color: c.graphite, marginBottom: space.sm, textAlign: 'center' }}>
        {t('common.errorTitle')}
      </Text>
      <Text maxFontSizeMultiplier={1.6} style={{ fontSize: 16, color: c.muted, textAlign: 'center', marginBottom: space.lg }}>
        {t('common.errorBody', { message: error.message || t('common.errorFallback') })}
      </Text>
      <Pressable
        onPress={() => {
          retry().catch(() => {});
        }}
        accessibilityRole="button"
        accessibilityLabel={t('common.tryAgain')}
        style={{
          minHeight: touch,
          paddingHorizontal: space.xl,
          borderRadius: radius.pill,
          backgroundColor: c.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text maxFontSizeMultiplier={1.6} style={{ fontSize: 16, fontWeight: '600', color: c.onInk }}>
          {t('common.tryAgain')}
        </Text>
      </Pressable>
    </View>
  );
}
