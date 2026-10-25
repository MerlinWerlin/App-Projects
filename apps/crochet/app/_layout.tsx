import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t } from '../src/i18n';
import { loadPlus } from '../src/plus/entitlement';
import { loadData } from '../src/store/data';
import { loadSettings, useSettings } from '../src/store/settings';
import { font, useColors } from '../src/theme/tokens';
import { ToastProvider } from '../src/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Shown instead of a screen that crashed while rendering: a real message and a way back. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { c } = useColors();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <Text style={{ fontFamily: font.display, fontSize: 24, color: c.ink, textAlign: 'center' }}>{t('error.title')}</Text>
      <Text style={{ fontFamily: font.body, fontSize: 15, color: c.ink2, textAlign: 'center' }}>{t('error.body')}</Text>
      <Text selectable style={{ fontFamily: font.body, fontSize: 12, color: c.ink3, textAlign: 'center' }}>
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
        <Text style={{ fontFamily: font.bodyBold, color: c.accentInk, fontSize: 16 }}>{t('error.retry')}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const { c, dark } = useColors();
  const { language } = useSettings();
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    ...Feather.font,
  });
  const [dataReady, setDataReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    Promise.all([loadSettings(), loadData(), loadPlus()])
      .catch(() => {})
      .finally(() => setDataReady(true));
    // Never an endless splash.
    const id = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(id);
  }, []);

  const ready = (dataReady && (fontsLoaded || !!fontError)) || timedOut;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Keep the splash colour underneath until ready, so there's no flash of an empty "index" screen.
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    // Keyed on the language so every screen re-renders its strings after a change in the picker.
    <GestureHandlerRootView key={language} style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <ToastProvider>
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: c.bg },
              headerTintColor: c.accent,
              headerTitleStyle: { fontFamily: font.bodyBold, color: c.ink },
              headerBackTitle: t('nav.back'),
              contentStyle: { backgroundColor: c.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
            <Stack.Screen name="project/new" options={{ presentation: 'modal', title: t('project.new') }} />
            <Stack.Screen name="project/[id]/index" options={{ title: '' }} />
            <Stack.Screen name="project/[id]/edit" options={{ presentation: 'modal', title: t('project.edit') }} />
            <Stack.Screen name="project/[id]/pattern" options={{ title: t('pattern.title') }} />
            <Stack.Screen name="project/[id]/paste" options={{ presentation: 'modal', title: t('pattern.paste') }} />
            <Stack.Screen name="project/[id]/file" options={{ headerShown: false }} />
            <Stack.Screen name="yarn/[id]" options={{ presentation: 'modal', title: t('stash.yarn') }} />
            <Stack.Screen name="plus" options={{ presentation: 'modal', title: '' }} />
            <Stack.Screen name="tools/[tool]" options={{ title: '' }} />
          </Stack>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
