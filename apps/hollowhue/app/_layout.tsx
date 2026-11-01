import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t } from '../src/i18n';
import { flushProgress, loadAllProgress } from '../src/store/progress';
import { loadSettings } from '../src/store/settings';
import { type as ty, useColors } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Shown instead of a screen that crashed: a real message and a way back. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { c } = useColors();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <Text style={[ty.h2, { color: c.ink, textAlign: 'center' }]}>{t('error.title')}</Text>
      <Text style={[ty.body, { color: c.ink2, textAlign: 'center' }]}>{t('error.body')}</Text>
      <Text selectable style={[ty.small, { color: c.ink3, textAlign: 'center' }]}>
        {String(error?.message ?? error).slice(0, 300)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('error.retry')}
        onPress={() => {
          retry().catch(() => {});
        }}
        style={{ minHeight: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: c.accent, justifyContent: 'center' }}
      >
        <Text style={[ty.bodyBold, { color: c.accentInk }]}>{t('error.retry')}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const { c, dark } = useColors();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([loadSettings(), loadAllProgress()])
      .catch(() => {})
      .finally(() => setReady(true));
    // Never an endless splash.
    const id = setTimeout(() => setReady(true), 3000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flushProgress();
    });
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Keep the splash colour underneath until ready, so no route name ever flashes.
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="scene/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="language" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
