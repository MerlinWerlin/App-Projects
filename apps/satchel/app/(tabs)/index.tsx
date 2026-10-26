// Trips (home). T41: each row's spoken label says its state (Coming up / On now / Past) and dates.
// A 'Trips didn’t load' notice if the saved list couldn't be read, Next up card, then trips (active and upcoming first). Windowed list with stable keys.
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { daysBetween } from '../../src/core/tz.ts';
import { deviceZone, formatRange, todayIn } from '../../src/core/format.ts';
import type { Trip } from '../../src/core/model.ts';
import { tripPhase } from '../../src/core/timeline.ts';
import { orderTrips } from '../../src/core/trips.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, space } from '../../src/theme/tokens.ts';
import { Body, Button, Card, EmptyState, Label, PressableScale, Title } from '../../src/ui/kit.tsx';
import { ErrorNotice } from '../../src/ui/ErrorNotice.tsx';
import { NextUpCard } from '../../src/ui/NextUpCard.tsx';
import { TripImport } from '../../src/ui/TripImport.tsx';
import { BatteryBannerSlot } from '../../src/ui/slots/BatteryBannerSlot.tsx';
import { EmergencyShortcutSlot } from '../../src/ui/slots/EmergencyShortcutSlot.tsx';
import { OfflineBannerSlot } from '../../src/ui/slots/OfflineBannerSlot.tsx';
import { WelcomeSlot } from '../../src/ui/slots/WelcomeSlot.tsx';
import { LanguageHintSlot } from '../../src/ui/slots/LanguageHintSlot.tsx';

export default function TripsScreen() {
  const { t, theme, lang } = useApp();
  const { trips, addDemo, loadError, retryLoad } = useTrips();
  // error.trips.load (STATES_COPY): the saved list couldn't be read; Try again reads the copy kept aside.
  const [retried, setRetried] = useState(false);
  const retry = async () => {
    const ok = await retryLoad();
    setRetried(!ok);
    if (!ok) AccessibilityInfo.announceForAccessibility(t('error.trips.loadStill'));
  };
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = todayIn(deviceZone());
  const list = orderTrips(trips, today);

  const renderTrip = useCallback(
    ({ item: trip }: { item: Trip }) => {
      const phase = tripPhase(trip, today);
      const range = t('trips.dates', { range: formatRange(trip.startDate, trip.endDate, lang), n: daysBetween(trip.startDate, trip.endDate) + 1 });
      return (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('spec41.trips.rowA11y', { name: trip.name, phase: t(`trips.phase.${phase}`), range })}
          accessibilityHint={t('spec41.trips.rowHint')}
          onPress={() => router.push(`/trip/${trip.id}`)}
        >
          <Card style={{ opacity: phase === 'past' ? 0.7 : 1 }}>
            <Label>
              {t(`trips.phase.${phase}`)}
              {trip.demo ? ` · ${t('trips.demoBadge')}` : ''}
            </Label>
            <Text style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>{trip.name}</Text>
            <Body muted>
              {range} · {t('trip.items', { n: trip.items.length })}
            </Body>
          </Card>
        </PressableScale>
      );
    },
    [t, theme, lang, today, router],
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.m }}
      data={list}
      keyExtractor={(trip) => trip.id}
      renderItem={renderTrip}
      ListHeaderComponent={
        <View style={{ gap: space.m, marginBottom: space.s }}>
          <Title>{t('trips.title')}</Title>
          <Body muted>{t('app.tagline')}</Body>
          <LanguageHintSlot />
          {loadError ? (
            <ErrorNotice
              title={t('error.trips.load.title')}
              body={retried ? `${t('error.trips.load.body')} ${t('error.trips.loadStill')}` : t('error.trips.load.body')}
              action={t('common.tryAgain')}
              actionHint={t('error.trips.loadRetryHint')}
              onAction={retry}
            />
          ) : null}
          <OfflineBannerSlot />
          <WelcomeSlot />
          <BatteryBannerSlot />
          <EmergencyShortcutSlot />
          <NextUpCard trips={trips} />
        </View>
      }
      ListEmptyComponent={<EmptyState title={t('trips.empty')} body={t('trips.emptyBody')} action={<Button label={t('trips.addDemo')} kind="quiet" onPress={addDemo} />} />}
      ListFooterComponent={
        <View style={{ gap: space.s, marginTop: space.s }}>
          <Button label={t('trips.add')} hint={t('spec41.trips.addHint')} onPress={() => router.push('/trip-edit')} />
          <TripImport />
          <Button label={t('essentials.title')} hint={t('essentials.body')} kind="quiet" onPress={() => router.push('/essentials')} />
          <Button label={t('trips.settings')} hint={t('trips.settingsHint')} kind="quiet" onPress={() => router.push('/settings')} />
        </View>
      }
    />
  );
}
