// Root: the splash stays up until fonts, prefs and trips have loaded, so the first screen never flashes a raw route
// name or a white frame (App Factory starter standard). Every route below has headerShown:false or a real title.
import { Inter_400Regular, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, useFonts as useDisplayFonts } from '@expo-google-fonts/space-grotesk';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/state/app.tsx';
import { usePrivacyGuarded } from '../src/state/privacyGuard.ts';
import { TripsProvider, useTrips } from '../src/state/trips.tsx';
import { fonts } from '../src/theme/tokens.ts';
import { PrivacyCover } from '../src/ui/PrivacyCover.tsx';
import { StartupMark } from '../src/ui/StartupMark.tsx';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <TripsProvider>
          <Shell />
        </TripsProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { ready, theme, t } = useApp();
  const { loaded } = useTrips();
  const privateOnScreen = usePrivacyGuarded();
  const [bodyLoaded, bodyError] = useFonts({ Inter_400Regular, Inter_600SemiBold });
  const [displayLoaded, displayError] = useDisplayFonts({ SpaceGrotesk_500Medium, SpaceGrotesk_700Bold });
  // A font that fails to load falls back to the system font rather than holding the splash.
  const fontsDone = (bodyLoaded || !!bodyError) && (displayLoaded || !!displayError);
  const show = ready && loaded && fontsDone;

  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => {});
  }, [show]);
  // Never an endless splash: hide after 4 s even if storage or fonts are slow.
  useEffect(() => {
    const id = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(id);
  }, []);

  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.paper },
    headerTintColor: theme.ink,
    headerTitleStyle: { fontFamily: fonts.displayMedium },
    headerShadowVisible: false,
    headerBackTitle: t('common.back'),
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {show ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.paper } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="trip/[id]" options={{ ...header, title: t('trip.title') }} />
          <Stack.Screen name="item/[id]" options={{ ...header, title: t('item.title') }} />
          <Stack.Screen name="trip-edit" options={{ ...header, presentation: 'modal', title: t('tripEdit.newTitle') }} />
          <Stack.Screen name="item-edit" options={{ ...header, presentation: 'modal', title: t('itemEdit.newTitle') }} />
          <Stack.Screen name="ticket/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="address/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="stay/[itemId]" options={{ ...header, title: t('stay.route') }} />
          <Stack.Screen name="inflight/[itemId]" options={{ ...header, title: t('inflight.route') }} />
          <Stack.Screen name="emergency-edit" options={{ ...header, presentation: 'modal', title: t('route.emergencyEdit') }} />
          <Stack.Screen name="vault" options={{ ...header, title: t('route.vault') }} />
          <Stack.Screen name="doc/[id]" options={{ ...header, title: t('route.doc') }} />
          <Stack.Screen name="doc-edit" options={{ ...header, presentation: 'modal', title: t('route.docEdit') }} />
          <Stack.Screen name="packing/[tripId]" options={{ ...header, title: t('route.packing') }} />
          <Stack.Screen name="spending/[tripId]" options={{ ...header, title: t('spending.title') }} />
          <Stack.Screen name="journal/[tripId]" options={{ ...header, title: t('journal.title') }} />
          <Stack.Screen name="journal-edit" options={{ ...header, presentation: 'modal', title: t('journal.edit.newTitle') }} />
          <Stack.Screen name="ideas/[tripId]" options={{ ...header, title: t('ideas.title') }} />
          <Stack.Screen name="todos/[tripId]" options={{ ...header, title: t('todos.title') }} />
          <Stack.Screen name="recap/[tripId]" options={{ ...header, title: t('recap.route') }} />
          <Stack.Screen name="dayplan/[tripId]" options={{ ...header, title: t('dayplan.route') }} />
          <Stack.Screen name="cash/[tripId]" options={{ ...header, title: t('cash.route') }} />
          <Stack.Screen name="holidays/[tripId]" options={{ ...header, title: t('holidays.route') }} />
          <Stack.Screen name="gifts/[tripId]" options={{ ...header, title: t('gifts.route') }} />
          <Stack.Screen name="idea-edit" options={{ ...header, presentation: 'modal', title: t('ideas.edit.newTitle') }} />
          <Stack.Screen name="settings" options={{ ...header, title: t('settings.title') }} />
          <Stack.Screen name="licences" options={{ ...header, title: t('licences.title') }} />
          <Stack.Screen name="phrases" options={{ ...header, title: t('phrases.title') }} />
          <Stack.Screen name="menu" options={{ ...header, title: t('menu.title') }} />
          <Stack.Screen name="help" options={{ ...header, title: t('help.title') }} />
          <Stack.Screen name="convert" options={{ ...header, title: t('convert.route') }} />
          <Stack.Screen name="tipping" options={{ ...header, title: t('tipping.route') }} />
          <Stack.Screen name="customs/[iso2]" options={{ ...header, title: t('customs.route') }} />
          <Stack.Screen name="driving/[iso2]" options={{ ...header, title: t('driving.route') }} />
          <Stack.Screen name="rental/[itemId]" options={{ ...header, title: t('driving.rental.route') }} />
          <Stack.Screen name="units" options={{ ...header, title: t('units.route') }} />
          <Stack.Screen name="travels" options={{ ...header, title: t('travels.route') }} />
          <Stack.Screen name="passport" options={{ ...header, title: t('stamps.route') }} />
          <Stack.Screen name="jetlag" options={{ ...header, title: t('jetlag.route') }} />
          <Stack.Screen name="callhome" options={{ ...header, title: t('callhome.route') }} />
          <Stack.Screen name="safe" options={{ ...header, title: t('safe.route') }} />
          <Stack.Screen name="meds" options={{ ...header, title: t('meds.route') }} />
          <Stack.Screen name="wayback" options={{ ...header, title: t('wayback.route') }} />
          <Stack.Screen name="paste-booking" options={{ ...header, title: t('paste.route') }} />
          <Stack.Screen name="trouble/index" options={{ ...header, title: t('trouble.route') }} />
          <Stack.Screen name="trouble/[id]" options={{ ...header, title: t('trouble.route.guide') }} />
          <Stack.Screen name="trouble/numbers" options={{ ...header, title: t('trouble.route.numbers') }} />
          <Stack.Screen name="phrase-card" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="menu-card" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="helpcards" options={{ ...header, title: t('helpcards.route') }} />
          <Stack.Screen name="helpcard-edit" options={{ ...header, presentation: 'modal', title: t('helpcards.edit.route') }} />
          <Stack.Screen name="helpcard" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="loyalty/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="loyalty-edit" options={{ ...header, presentation: 'modal', title: t('loyalty.edit.newTitle') }} />
          <Stack.Screen name="trip-again/[tripId]" options={{ ...header, title: t('tripcopy.route') }} />
          <Stack.Screen name="essentials" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'none' }} />
        </Stack>
      ) : null}
      {/* T57: covers the stack (and its headers) in the app switcher while the vault or a document is open. */}
      {show ? <PrivacyCover guarded={privateOnScreen} /> : null}
      {/* Mounted in the same render as the first screen, so it is already drawn when the native splash hides. */}
      {show ? <StartupMark dark={theme.dark} /> : null}
    </View>
  );
}
