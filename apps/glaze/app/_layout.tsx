import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Unbounded_500Medium, Unbounded_700Bold } from '@expo-google-fonts/unbounded';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { durations } from '../src/theme/motion';
import { I18nProvider, useT } from '../src/i18n';
import { restoreDownloadedPacks } from '../src/native/packs';
import { textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { ErrorFallback } from '../src/ui/ErrorBoundary';
import { ToastProvider } from '../src/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Register downloaded packs' motifs while fonts load, before any screen reads the studio (T50).
restoreDownloadedPacks().catch(() => {});
// Splash fades into the first screen once fonts are in (POLISH rule 6).
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
  const { c } = useColorsV2();
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Unbounded_500Medium,
    Unbounded_700Bold,
    // Preload the glyph font so batch icon capture never paints blank glyphs.
    ...Feather.font,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // If fonts fail we still render with system fonts rather than block the app.
  if (!loaded && !error) return null;

  return (
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

/** The stack lives under I18nProvider so its titles follow the app language. */
function RootStack() {
  const { c } = useColorsV2();
  const { t } = useT();
  return (
    <Stack
      screenOptions={{
        // Design v2 (T83): grouped bg header, berry tint, system navTitle (covers every script).
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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="theme/[id]" options={{ title: t('theme.title') }} />
      <Stack.Screen name="install" options={{ title: t('install.title') }} />
      <Stack.Screen name="wallpaper" options={{ title: t('wallpaper.title') }} />
      <Stack.Screen name="collage" options={{ title: t('wallpaper.collage.title') }} />
      <Stack.Screen name="live/[id]" options={{ title: t('live.editTitle') }} />
      <Stack.Screen name="feedback" options={{ title: t('feedback.title') }} />
      <Stack.Screen name="add-app" options={{ title: t('addApp.title') }} />
      <Stack.Screen name="tips" options={{ title: t('tips.title') }} />
      <Stack.Screen name="habit-goals" options={{ title: t('tabs.widgetsTab.goals.title') }} />
    </Stack>
  );
}
