// Trips (home). T41: each row's spoken label says its state (Coming up / On now / Past) and dates.
// A 'Trips didn’t load' notice if the saved list couldn't be read, Next up card, then trips (active and upcoming first). Windowed list with stable keys.
// T50: dusk hero with a time-of-day greeting and the trip in focus ("Tokyo in 12 days" / "Day 3 of 9 in Tokyo") and
// its progress, quick stats that count up, the Next up pass, today's mini timeline, the destination clock vs home,
// and every trip as a boarding pass. T71: the "Your day" morning brief above the cards while a trip is on today. Everything is worked out on the phone (no network).
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripCover } from '../../src/core/covers.ts';
import { deviceZone, formatRange, todayIn } from '../../src/core/format.ts';
import { countdown, dayPart, destinationZone, focusTrip, quickStats } from '../../src/core/glance.ts';
import type { Trip } from '../../src/core/model.ts';
import { tripPhase } from '../../src/core/timeline.ts';
import { orderTrips } from '../../src/core/trips.ts';
import { daysBetween } from '../../src/core/tz.ts';
import { homeCountryFor } from '../../src/core/arrival.ts';
import { tripDrivingBanners } from '../../src/core/driving.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { space } from '../../src/theme/tokens.ts';
import { ArrivalHomeCard } from '../../src/ui/ArrivalCard.tsx';
import { DayBriefCard } from '../../src/ui/DayBriefCard.tsx';
import { ErrorNotice } from '../../src/ui/ErrorNotice.tsx';
import { InflightHomeCard } from '../../src/ui/InflightCard.tsx';
import { FadeInView, HeroHeader, ProgressBar, StatTile } from '../../src/ui/hero.tsx';
import { Button, EmptyState, Label, PressableScale } from '../../src/ui/kit.tsx';
import { NextUpCard } from '../../src/ui/NextUpCard.tsx';
import { LeavingSoonBanner } from '../../src/ui/ReadinessCard.tsx';
import { RecapHeroCard } from '../../src/ui/RecapHeroCard.tsx';
import { TravelsCard } from '../../src/ui/TravelsCard.tsx';
import { TripImport } from '../../src/ui/TripImport.tsx';
import { GamesEntryCard } from '../../src/ui/games.tsx';
import { DRIVING_TABLE, driveSideA11y } from '../../src/ui/driving.tsx';
import { leaveNudge } from '../../src/core/leavehome.ts';
import { LeaveHomeHomeCard, leavePillA11y } from '../../src/ui/leavehome.tsx';
import { useHomeCountry } from '../../src/ui/HomeCountryPicker.tsx';
import { ClockCard, countdownHeadline, TodayCard, TripPass } from '../../src/ui/TripPass.tsx';
import { BatteryBannerSlot } from '../../src/ui/slots/BatteryBannerSlot.tsx';
import { EmergencyShortcutSlot } from '../../src/ui/slots/EmergencyShortcutSlot.tsx';
import { LanguageHintSlot } from '../../src/ui/slots/LanguageHintSlot.tsx';
import { OfflineBannerSlot } from '../../src/ui/slots/OfflineBannerSlot.tsx';
import { WelcomeSlot } from '../../src/ui/slots/WelcomeSlot.tsx';

const cityOf = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ');

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
  const { homeIso } = useHomeCountry();
  const insets = useSafeAreaInsets();
  const today = todayIn(deviceZone());
  const list = useMemo(() => orderTrips(trips, today), [trips, today]);
  const focus = useMemo(() => focusTrip(trips, today), [trips, today]);
  const stats = useMemo(() => quickStats(trips, today), [trips, today]);
  const dest = useMemo(() => (focus ? destinationZone(focus) : null), [focus]);
  const greeting = t(`design.greeting.${dayPart(new Date().getHours())}`);

  const renderTrip = useCallback(
    ({ item: trip, index }: { item: Trip; index: number }) => {
      const phase = tripPhase(trip, today);
      const range = t('trips.dates', { range: formatRange(trip.startDate, trip.endDate, lang), n: daysBetween(trip.startDate, trip.endDate) + 1 });
      // T122: "Drive on the LEFT / RIGHT" for car bookings abroad (not on past trips).
      const driving = phase === 'past' ? [] : tripDrivingBanners(trip, DRIVING_TABLE, homeCountryFor(trip, homeIso));
      const drivingLine = driveSideA11y(t, driving);
      // T124: "Lock up today / tomorrow" while the leaving-home checklist isn't finished.
      const leaving = phase === 'past' ? null : leaveNudge(trip, Date.now());
      return (
        <FadeInView delay={Math.min(index, 4) * 40}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={[t('spec41.trips.rowA11y', { name: trip.name, phase: t(`trips.phase.${phase}`), range }), drivingLine, leavePillA11y(t, leaving)].filter(Boolean).join('. ')}
            accessibilityHint={t('spec41.trips.rowHint')}
            onPress={() => router.push(`/trip/${trip.id}`)}
          >
            <TripPass trip={trip} today={today} cover={tripCover(trip)} driving={driving} leaving={leaving} />
          </PressableScale>
        </FadeInView>
      );
    },
    [t, lang, today, router, homeIso],
  );

  const c = focus ? countdown(focus, today) : null;
  const place = focus ? (dest ? cityOf(dest) : focus.name) : '';

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: insets.top + space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.m }}
      data={list}
      keyExtractor={(trip) => trip.id}
      renderItem={renderTrip}
      initialNumToRender={6}
      windowSize={7}
      ListHeaderComponent={
        <View style={{ gap: space.m, marginBottom: space.s }}>
          <FadeInView>
            <HeroHeader
              tone="trips"
              illustration="route"
              eyebrow={greeting}
              title={focus && c ? countdownHeadline(t, c, place) : t('design.trips.heroNone')}
              subtitle={
                focus ? t('design.trips.countdownBody', { trip: focus.name, range: formatRange(focus.startDate, focus.endDate, lang) }) : t('design.trips.heroNoneBody')
              }
            >
              {c && c.kind === 'active' ? (
                <ProgressBar progress={c.progress} tone="ok" track={theme.heroWash} label={t('design.pass.progressA11y', { day: c.day, total: c.total })} />
              ) : null}
            </HeroHeader>
          </FadeInView>
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
          <LeavingSoonBanner trips={trips} />
          {/* T113: "In the air" while a flight is under way (24 h before, 6 h after). */}
          <InflightHomeCard trips={list} />
          {/* T71: "Your day" sits above the other cards, only while a trip is on today. */}
          <DayBriefCard trips={trips} />
          {/* T124: "You leave tomorrow" with the leaving-home checklist, when no Your day brief shows it. */}
          <LeaveHomeHomeCard trips={trips} />
          {/* T95: the arrival card for the first trip in the list reaching a new country. */}
          <ArrivalHomeCard trips={list} />
          {trips.length ? (
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <StatTile value={stats.trips} label={t('design.stats.trips')} icon="airplane" tone="sea" />
              <StatTile value={stats.bookings} label={t('design.stats.bookings')} icon="ticket" tone="accent" />
              <StatTile value={stats.daysAway} label={t('design.stats.daysAway')} icon="sunny" tone="teal" />
            </View>
          ) : null}
          <TravelsCard />
          <RecapHeroCard trips={trips} />
          <NextUpCard trips={trips} />
          <TodayCard trips={trips} />
          {focus && dest ? <ClockCard destTz={dest} homeTz={focus.homeTz} /> : null}
          <EmergencyShortcutSlot />
          {/* T125: Travel games for the wait. */}
          {trips.length ? <GamesEntryCard trips={trips} /> : null}
          {list.length ? (
            <View accessibilityRole="header" style={{ marginTop: space.s }}>
              <Label>{t('trips.title')}</Label>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState art="suitcase" title={t('trips.empty')} body={t('trips.emptyBody')} action={<Button label={t('trips.addDemo')} kind="quiet" onPress={addDemo} />} />
      }
      ListFooterComponent={
        <View style={{ gap: space.s, marginTop: space.s }}>
          <Button label={t('trips.add')} hint={t('spec41.trips.addHint')} icon="add" onPress={() => router.push('/trip-edit')} />
          {list.length ? <Button label={t('paste.open')} hint={t('paste.openHint')} kind="secondary" icon="clipboard-outline" onPress={() => router.push('/paste-booking')} /> : null}
          <TripImport />
          <Button label={t('essentials.title')} hint={t('essentials.body')} kind="quiet" icon="battery-half-outline" onPress={() => router.push('/essentials')} />
          <Button label={t('trips.settings')} hint={t('trips.settingsHint')} kind="quiet" icon="settings-outline" onPress={() => router.push('/settings')} />
        </View>
      }
    />
  );
}
