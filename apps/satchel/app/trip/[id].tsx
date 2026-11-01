// Trip timeline: demo intro (first opening of the demo trip), warnings (nights without a bed, clashes), then each
// day with its bookings and any journey still under way from an earlier day; add a booking by kind.
// T41: rows that clash carry a worded overlap marker; a trip that has ended says so at the top (EDGE_CASES "Past
// trips": kept and available, never presented as coming up).
// T68: the jet lag card is hidden once the trip is over; a trip just imported from a file that left journal photos
// behind says how many, once (the photosLeftOut param from TripImport), until dismissed.
// T119: the trip's own accent (src/theme/tripAccent.ts, from its cover scene) marks each day card: a stripe on the
// left and the day heading in the accent's text colour (AA on the card in both themes).
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, FlatList, findNodeHandle, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { overlapPartners, overlapTitles } from '../../src/core/clashes.ts';
import { tripCover } from '../../src/core/covers.ts';
import { deviceZone, formatDay, formatRange, todayIn } from '../../src/core/format.ts';
import { ITEM_KINDS, isTransport, type ItemKind, type Trip } from '../../src/core/model.ts';
import { placesByName } from '../../src/core/places.ts';
import { isMapCategory } from '../../src/core/poi.ts';
import { groupByDay, overlaps, tripPhase, type Day } from '../../src/core/timeline.ts';
import { connectionAfter, connectionDay, connections } from '../../src/core/layovers.ts';
import { arrivalFocusDelay } from '../../src/core/followups104.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { tripAccent } from '../../src/theme/tripAccent.ts';
import { ItemRow } from '../../src/ui/ItemRow.tsx';
import { JetLagCard } from '../../src/ui/JetLagCard.tsx';
import { MedTimesCard } from '../../src/ui/MedTimesCard.tsx';
import { ReadinessCard } from '../../src/ui/ReadinessCard.tsx';
import { KindIcon, kindKey } from '../../src/ui/kinds.tsx';
import { Body, Button, Card, Chip, EmptyState, Label, PressableScale, Screen, Warning } from '../../src/ui/kit.tsx';
import { TripPackingSlot } from '../../src/ui/slots/TripPackingSlot.tsx';
import { TripSpendingSlot } from '../../src/ui/slots/TripSpendingSlot.tsx';
import { TripJournalSlot } from '../../src/ui/slots/TripJournalSlot.tsx';
import { TripIdeasSlot } from '../../src/ui/slots/TripIdeasSlot.tsx';
import { TripTodosSlot } from '../../src/ui/slots/TripTodosSlot.tsx';
import { TripRecapSlot } from '../../src/ui/slots/TripRecapSlot.tsx';
import { TripGiftsSlot } from '../../src/ui/slots/TripGiftsSlot.tsx';
import { PlannedIdeas } from '../../src/ui/ideas.tsx';
import { SharePlan } from '../../src/ui/SharePlan.tsx';
import { AddToCalendar } from '../../src/ui/AddToCalendar.tsx';
import { ArrivalCard, useStopArrival } from '../../src/ui/ArrivalCard.tsx';
import { DriveSideBanner } from '../../src/ui/driving.tsx';
import { LeaveHomeTripCard } from '../../src/ui/leavehome.tsx';
import { GetaroundTripCard } from '../../src/ui/getaround.tsx';
import { ComeHomeTripCard } from '../../src/ui/comehome.tsx';
import { OutfitsTripCard } from '../../src/ui/outfits.tsx';
import { PostcardsTripCard } from '../../src/ui/postcards.tsx';
import { KidsTripCard } from '../../src/ui/kids.tsx';
import { InflightTripCard } from '../../src/ui/InflightCard.tsx';
import { TripCoverHero } from '../../src/ui/TripCover.tsx';
import { TripExport } from '../../src/ui/TripExport.tsx';
import { PlanAgainButton } from '../../src/ui/PlanAgainButton.tsx';
import { WeatherCard } from '../../src/ui/WeatherCard.tsx';
import { HolidayBadge, HolidaysCard, useTripHolidays } from '../../src/ui/HolidaysCard.tsx';
import { PlanDayButton } from '../../src/ui/PlanDayButton.tsx';
import { ConnectionCard, useLayoverOverrides, useLayoverPrefs } from '../../src/ui/layovers.tsx';
import { TripGapsCard } from '../../src/ui/gaps.tsx';
import { PhotoLightCard } from '../../src/ui/photolight.tsx';
import { CheckinTripCard } from '../../src/ui/checkin.tsx';
import { RainDayCard, useTripRain } from '../../src/ui/rainplan.tsx';

const DEMO_INTRO_KEY = 'satchel.demoIntro.done.v1';
const NOT_DONE = false;
/** `adding` value for the empty-trip prompt's kind chooser (dates are never this). */
const FIRST = 'first';

/** FLOWS §1.2: says the demo is sample data, once. "Remove demo trip" asks first, then returns to the trips list. */
function DemoIntro({ trip }: { trip: Trip }) {
  const { t } = useApp();
  const { deleteTrip } = useTrips();
  const router = useRouter();
  const [done, setDone, loaded] = usePersisted<boolean>(DEMO_INTRO_KEY, NOT_DONE);
  if (!trip.demo || !loaded || done) return null;
  const remove = () =>
    Alert.alert(t('spec.demoIntro.removeConfirm'), t('spec.demoIntro.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('spec.demoIntro.remove'),
        style: 'destructive',
        onPress: async () => {
          if (!(await deleteTrip(trip.id))) {
            Alert.alert(t('error.trips.save.title'), t('error.trips.save.body'));
            return;
          }
          setDone(true);
          router.back();
        },
      },
    ]);
  return (
    <Card style={{ gap: space.m }}>
      <Label>{t('trips.demoBadge')}</Label>
      <Body>{t('spec.demoIntro.body')}</Body>
      <Body muted>{t('spec.demoIntro.replace')}</Body>
      <Button label={t('spec.demoIntro.open')} hint={t('spec.demoIntro.openHint')} onPress={() => setDone(true)} />
      <Button label={t('spec.demoIntro.remove')} hint={t('spec.demoIntro.removeHint')} kind="quiet" onPress={remove} />
    </Card>
  );
}

/** Places saved on this trip from the map (FLOWS §11.2). A tap opens the trip map at that place (Remove is there). */
function TripPlaces({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const places = placesByName(trip);
  return (
    <Card>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>
        {t('timeline.places')}
      </Text>
      {places.length === 0 ? <Body muted>{t('timeline.placesNone')}</Body> : null}
      {places.map((p, i) => (
        <PressableScale
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={t('timeline.placeOpen', { name: p.name })}
          accessibilityHint={t('timeline.placeOpenHint')}
          onPress={() => router.navigate({ pathname: '/map', params: { tripId: trip.id, placeId: p.id } })}
          style={{ minHeight: TOUCH, justifyContent: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: theme.line, paddingVertical: space.xs }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{p.name}</Text>
          {p.category || p.sample ? (
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>
              {[p.category && isMapCategory(p.category) ? t(`map.cat.${p.category}`) : null, p.sample ? t('timeline.placeSample') : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </PressableScale>
      ))}
    </Card>
  );
}

export default function TripScreen() {
  // `day` (T71): open scrolled to that day's section, e.g. today from the "Your day" card on the Trips tab.
  // `arrival` (T134): open with that stop's arrival card (ISO country code) at the top, e.g. from a long layover.
  const { id, photosLeftOut, day: focusDay, arrival: arrivalParam } = useLocalSearchParams<{ id: string; photosLeftOut?: string; day?: string; arrival?: string }>();
  const { t, theme, lang, reduceMotion } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState<string | null>(null);
  const trip = trips.find((x) => x.id === id);
  const partners = useMemo(() => overlapPartners(trip?.items ?? []), [trip]);
  const days = useMemo(() => (trip ? groupByDay(trip) : []), [trip]);
  // T140: outdoor plans with wet weather in their hours (cached forecasts only) and the last Plan B change's undo.
  const dayDates = useMemo(() => days.map((d) => d.date), [days]);
  const rain = useTripRain(trip ?? null, dayDates);
  // T131: changes between back-to-back journeys, shown as a card after the leg that lands (on its arrival day).
  const [layoverPrefs] = useLayoverPrefs();
  // T134: a change's own limits (set on its card) decide its status.
  const [layoverOwn] = useLayoverOverrides();
  const conns = useMemo(() => connections(trip?.items ?? [], layoverPrefs, trip ? { tripId: trip.id, overrides: layoverOwn } : undefined), [trip, layoverPrefs, layoverOwn]);
  // T134: the arrival card opened for one stop (a long layover's "Arrival card for <country>"), scrolled into view.
  const stopArrival = useStopArrival(trip);
  const [arrivalFocus, setArrivalFocus] = useState<string | null>(typeof arrivalParam === 'string' && arrivalParam ? arrivalParam : null);
  const arrivalY = useRef<number | null>(null);
  const arrivalPending = useRef(!!arrivalFocus);
  // T138: the stop card's heading; VoiceOver focus moves there once the scroll has settled.
  const arrivalHeading = useRef<View | null>(null);
  const cover = useMemo(() => (trip ? tripCover(trip) : null), [trip]);
  const accent = useMemo(() => (cover ? tripAccent(cover, theme) : null), [cover, theme]);
  // T106: public holidays at the trip's stops, for the day-header badges.
  const holidays = useTripHolidays(trip);
  const listRef = useRef<FlatList<Day>>(null);
  const focusIndex = focusDay ? days.findIndex((d) => d.date === focusDay) : -1;
  const scrolled = useRef(false);
  const retries = useRef(0);
  useEffect(() => {
    if (focusIndex < 0 || scrolled.current) return;
    scrolled.current = true;
    const id = setTimeout(() => listRef.current?.scrollToIndex({ index: focusIndex, animated: false, viewOffset: space.l }), 0);
    return () => clearTimeout(id);
  }, [focusIndex]);

  const scrollToArrival = useCallback(() => {
    if (arrivalY.current === null) {
      arrivalPending.current = true;
      return;
    }
    arrivalPending.current = false;
    listRef.current?.scrollToOffset({ offset: Math.max(0, arrivalY.current), animated: !reduceMotion });
    setTimeout(() => {
      const tag = arrivalHeading.current ? findNodeHandle(arrivalHeading.current) : null;
      if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
    }, arrivalFocusDelay(reduceMotion));
  }, [reduceMotion]);
  const openArrival = useCallback(
    (iso2: string) => {
      setArrivalFocus(iso2);
      setTimeout(scrollToArrival, 0);
    },
    [scrollToArrival],
  );

  const add = (kind: ItemKind, date: string) => {
    setAdding(null);
    router.push({ pathname: '/item-edit', params: { tripId: id, kind, date } });
  };

  const pasteBooking = () => {
    setAdding(null);
    router.push({ pathname: '/paste-booking', params: { tripId: id } });
  };

  const kindChooser = (date: string) => (
    <View style={{ gap: space.s }}>
      <Label>{t('trip.chooseKind')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('trip.chooseKind')}>
        {ITEM_KINDS.map((k) => (
          <Chip key={k} label={t(kindKey(k))} selected={false} icon={<KindIcon kind={k} color={theme.accent} size={18} />} onPress={() => add(k, date)} />
        ))}
      </View>
      {/* T77: or paste a confirmation and let Satchel draft it. */}
      <Button label={t('paste.open')} hint={t('paste.openHint')} kind="secondary" icon="clipboard-outline" onPress={pasteBooking} />
      <Button label={t('common.cancel')} hint={t('spec.timeline.cancelAddHint')} kind="quiet" onPress={() => setAdding(null)} />
    </View>
  );

  /** T131: the change after this leg, on the day the leg lands. */
  const connectionCard = (arriveId: string, date: string) => {
    const c = connectionAfter(conns, arriveId);
    return c && trip && connectionDay(c) === date ? <ConnectionCard c={c} tripId={trip.id} usual={layoverPrefs} arrival={stopArrival(c.country)} onArrival={openArrival} /> : null;
  };

  const renderDay = useCallback(
    ({ item: day }: { item: Day }) => (
      <Card style={accent ? { borderLeftWidth: 4, borderLeftColor: accent.strong } : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <View accessible accessibilityRole="header">
              {accent ? <Text style={[typeScale.caption, { fontSize: 13, color: accent.ink }]}>{formatDay(day.date, lang)}</Text> : <Label>{formatDay(day.date, lang)}</Label>}
            </View>
            {/* T106: a public holiday at a stop on this day. */}
            <HolidayBadge holidays={holidays?.byDate.get(day.date)} />
          </View>
          {/* T98: a walking plan for this day. */}
          {trip ? <PlanDayButton tripId={trip.id} day={day.date} /> : null}
          {/* T89: add this day's bookings to Calendar. */}
          {trip && (day.items.length || day.continuing.length) ? <AddToCalendar trip={trip} scope={{ kind: 'day', date: day.date }} compact /> : null}
        </View>
        {day.continuing.map((it) => (
          <View key={`c-${it.id}`}>
            <ItemRow item={it} continuingOn={day.date} onPress={() => router.push(`/item/${it.id}`)} />
            {connectionCard(it.id, day.date)}
          </View>
        ))}
        {day.items.map((it) => (
          <View key={it.id}>
            <ItemRow item={it} overlapsWith={overlapTitles(partners, it.id) || undefined} onPress={() => router.push(`/item/${it.id}`)} />
            {connectionCard(it.id, day.date)}
          </View>
        ))}
        {/* T81: ideas planned for this day, as light "Planned" rows. */}
        {trip ? <PlannedIdeas trip={trip} day={day.date} /> : null}
        {/* T140: Plan B for outdoor plans with rain, snow or storms in their hours. */}
        {trip ? <RainDayCard trip={trip} day={day.date} rain={rain} /> : null}
        {!day.items.length && !day.continuing.length ? <Body muted>{t('trip.dayEmpty')}</Body> : null}
        {adding === day.date ? (
          kindChooser(day.date)
        ) : (
          <Button label={t('trip.addToDay', { day: formatDay(day.date, lang) })} kind="quiet" hint={t('trip.addHint')} onPress={() => setAdding(day.date)} />
        )}
      </Card>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adding, lang, t, theme, router, partners, trip, holidays, accent, conns, layoverPrefs, stopArrival, openArrival, rain],
  );

  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('trip.title')} body={t('trip.notFound')} />
      </Screen>
    );
  }

  // T135: nights with no stay and overlapping stays / journeys are in the Trip gaps card; other clashes stay here.
  const clashes = overlaps(trip.items).filter(([a, b]) => !(a.kind === 'hotel' && b.kind === 'hotel') && !(isTransport(a.kind) && isTransport(b.kind)));
  const empty = trip.items.length === 0;
  const past = tripPhase(trip, todayIn(deviceZone())) === 'past';
  const leftOut = Math.max(0, Math.floor(Number(photosLeftOut) || 0));
  return (
    <>
      <Stack.Screen options={{ title: trip.name }} />
      <FlatList
        ref={listRef}
        style={{ flex: 1, backgroundColor: theme.paper }}
        contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}
        data={days}
        keyExtractor={(d) => d.date}
        renderItem={renderDay}
        extraData={adding}
        initialNumToRender={Math.max(10, focusIndex + 1)}
        onScrollToIndexFailed={(info) => {
          // Rows above it aren't measured yet: jump near it, then try again once they are.
          if (retries.current >= 3) return;
          retries.current += 1;
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false, viewOffset: space.l }), 100);
        }}
        ListHeaderComponent={
          <View style={{ gap: space.s, marginBottom: space.s }}>
            {/* T83: the trip's illustrated cover with its name and dates. */}
            {cover ? <TripCoverHero scene={cover} title={trip.name} subtitle={formatRange(trip.startDate, trip.endDate, lang)} /> : null}
            {/* T113: "In the air" for this trip's flight (24 h before to 6 h after). */}
            {past ? null : <InflightTripCard trip={trip} />}
            {past ? (
              <Card>
                <Label>{t('trips.phase.past')}</Label>
                <Body>{t('spec41.trip.pastNotice')}</Body>
              </Card>
            ) : null}
            {leftOut > 0 ? (
              <Card>
                <View accessible accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
                  <Label>{t('tripfile.photos.leftOutTitle')}</Label>
                  <Body>{leftOut === 1 ? t('tripfile.photos.leftOutOne') : t('tripfile.photos.leftOutMany', { n: leftOut })}</Body>
                  <Body muted>{t('tripfile.photos.leftOutAsk')}</Body>
                </View>
                <Button label={t('tripfile.photos.dismiss')} hint={t('tripfile.photos.dismissHint')} kind="quiet" onPress={() => router.setParams({ photosLeftOut: '' })} />
              </Card>
            ) : null}
            {/* T69: the trip on the map, day by day (numbered stops, dashed day routes). */}
            <Button
              label={t('triproute.seeOnMap')}
              hint={t('triproute.seeOnMapHint')}
              kind="secondary"
              icon="map-outline"
              onPress={() => router.navigate({ pathname: '/map', params: { tripId: trip.id, placeId: '' } })}
            />
            <Button label={t('paste.open')} hint={t('paste.openHint')} kind="quiet" icon="clipboard-outline" onPress={pasteBooking} />
            {/* T95: "Welcome to <country>" while a trip country is arriving, else the countries strip. */}
            {/* T134: also opened for one stop (arrivalFocus), past trips included; the list scrolls to it. */}
            {/* T138: measured on the card itself (no wrapper, so no extra gap when it is hidden); focus follows. */}
            {past && !arrivalFocus ? null : (
              <ArrivalCard
                trip={trip}
                focusIso2={arrivalFocus}
                onCloseFocus={() => setArrivalFocus(null)}
                stopHeadingRef={arrivalHeading}
                onLayout={(e) => {
                  arrivalY.current = e.nativeEvent.layout.y;
                  if (arrivalPending.current) setTimeout(scrollToArrival, 0);
                }}
              />
            )}
            {/* T122: "Drive on the LEFT / RIGHT" for each country the trip has a car booking in. */}
            {past ? null : <DriveSideBanner trip={trip} />}
            {/* T132: getting around each covered trip country (transit cards, bank card, taxis, airport). */}
            {past ? null : <GetaroundTripCard trip={trip} />}
            {/* T124: before you lock the door, timed to the first departure (hidden once you've left). */}
            {past ? null : <LeaveHomeTripCard trip={trip} />}
            {/* T128: coming home, from three days before the final departure to the day after you're back. */}
            <ComeHomeTripCard trip={trip} />
            {/* T136: what to wear each day, from the packing list's clothes. */}
            {past ? null : <OutfitsTripCard trip={trip} />}
            {/* T147: people to send a postcard to, "3 of 5 sent" (kept after the trip, for the stragglers). */}
            <PostcardsTripCard trip={trip} />
            {/* T149: travelling with kids (who is coming, lost card, packing rows, journey reminders). */}
            {past ? null : <KidsTripCard trip={trip} />}
            <ReadinessCard trip={trip} />
            {/* T143: when check-in opens and closes for the next bookings (each on its own clock). */}
            {past ? null : <CheckinTripCard trip={trip} />}
            {/* T135: holes and clashes in the plan (nights with no stay, missing journeys, overlaps, no way home). */}
            {past ? null : <TripGapsCard trip={trip} />}
            {/* T93: the trip's to-do list (hidden once the trip has ended). */}
            <TripTodosSlot trip={trip} />
            {past ? null : <JetLagCard trip={trip} />}
            {/* T101: Medicine times for this trip's stops. */}
            {past ? null : <MedTimesCard tripId={trip.id} />}
            <WeatherCard trip={trip} />
            {/* T139: golden and blue hour for each trip day at its stay or place (same stops as the weather card). */}
            {past ? null : <PhotoLightCard trip={trip} />}
            {/* T106: public holidays at the trip's stops. */}
            <HolidaysCard trip={trip} />
            <DemoIntro trip={trip} />
            {empty ? (
              <EmptyState
                art="suitcase"
                title={t('spec.timeline.emptyTitle')}
                body={t('spec.timeline.emptyBody')}
                action={adding === FIRST ? kindChooser(trip.startDate) : <Button label={t('spec.timeline.addItem')} hint={t('spec.timeline.addItemHint')} onPress={() => setAdding(FIRST)} />}
              />
            ) : null}
            {clashes.map(([a, b]) => (
              <Warning key={`${a.id}-${b.id}`} text={t('trip.warnClash', { a: a.title, b: b.title })} />
            ))}
            <TripRecapSlot trip={trip} />
            <TripJournalSlot trip={trip} />
            <TripIdeasSlot trip={trip} />
            <TripSpendingSlot trip={trip} />
            <TripPackingSlot trip={trip} />
            {/* T107: gifts and souvenirs. */}
            <TripGiftsSlot trip={trip} />
            <TripPlaces trip={trip} />

            <Button label={t('trip.edit')} hint={t('spec.timeline.editHint')} kind="quiet" onPress={() => router.push({ pathname: '/trip-edit', params: { id: trip.id } })} />
            {/* T118: copy this trip to new dates. */}
            <PlanAgainButton trip={trip} />
            <SharePlan trip={trip} />
            {empty ? null : <AddToCalendar trip={trip} scope={{ kind: 'trip' }} />}
            <TripExport trip={trip} />
          </View>
        }
      />
    </>
  );
}
