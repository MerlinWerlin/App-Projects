// Trip timeline: demo intro (first opening of the demo trip), warnings (nights without a bed, clashes), then each
// day with its bookings and any journey still under way from an earlier day; add a booking by kind.
// T41: rows that clash carry a worded overlap marker; a trip that has ended says so at the top (EDGE_CASES "Past
// trips": kept and available, never presented as coming up).
// T68: the jet lag card is hidden once the trip is over; a trip just imported from a file that left journal photos
// behind says how many, once (the photosLeftOut param from TripImport), until dismissed.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { overlapPartners, overlapTitles } from '../../src/core/clashes.ts';
import { tripCover } from '../../src/core/covers.ts';
import { deviceZone, formatDay, formatRange, todayIn } from '../../src/core/format.ts';
import { ITEM_KINDS, type ItemKind, type Trip } from '../../src/core/model.ts';
import { placesByName } from '../../src/core/places.ts';
import { isMapCategory } from '../../src/core/poi.ts';
import { groupByDay, nightsWithoutBed, overlaps, tripPhase, type Day } from '../../src/core/timeline.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, space, TOUCH } from '../../src/theme/tokens.ts';
import { ItemRow } from '../../src/ui/ItemRow.tsx';
import { JetLagCard } from '../../src/ui/JetLagCard.tsx';
import { ReadinessCard } from '../../src/ui/ReadinessCard.tsx';
import { KindIcon, kindKey } from '../../src/ui/kinds.tsx';
import { Body, Button, Card, Chip, EmptyState, Label, PressableScale, Screen, Warning } from '../../src/ui/kit.tsx';
import { TripPackingSlot } from '../../src/ui/slots/TripPackingSlot.tsx';
import { TripSpendingSlot } from '../../src/ui/slots/TripSpendingSlot.tsx';
import { TripJournalSlot } from '../../src/ui/slots/TripJournalSlot.tsx';
import { TripIdeasSlot } from '../../src/ui/slots/TripIdeasSlot.tsx';
import { TripRecapSlot } from '../../src/ui/slots/TripRecapSlot.tsx';
import { PlannedIdeas } from '../../src/ui/ideas.tsx';
import { SharePlan } from '../../src/ui/SharePlan.tsx';
import { AddToCalendar } from '../../src/ui/AddToCalendar.tsx';
import { TripCoverHero } from '../../src/ui/TripCover.tsx';
import { TripExport } from '../../src/ui/TripExport.tsx';
import { WeatherCard } from '../../src/ui/WeatherCard.tsx';

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
  const { id, photosLeftOut, day: focusDay } = useLocalSearchParams<{ id: string; photosLeftOut?: string; day?: string }>();
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState<string | null>(null);
  const trip = trips.find((x) => x.id === id);
  const partners = useMemo(() => overlapPartners(trip?.items ?? []), [trip]);
  const days = useMemo(() => (trip ? groupByDay(trip) : []), [trip]);
  const cover = useMemo(() => (trip ? tripCover(trip) : null), [trip]);
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

  const renderDay = useCallback(
    ({ item: day }: { item: Day }) => (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View accessible accessibilityRole="header" style={{ flex: 1 }}>
            <Label>{formatDay(day.date, lang)}</Label>
          </View>
          {/* T89: add this day's bookings to Calendar. */}
          {trip && (day.items.length || day.continuing.length) ? <AddToCalendar trip={trip} scope={{ kind: 'day', date: day.date }} compact /> : null}
        </View>
        {day.continuing.map((it) => (
          <ItemRow key={`c-${it.id}`} item={it} continuingOn={day.date} onPress={() => router.push(`/item/${it.id}`)} />
        ))}
        {day.items.map((it) => (
          <ItemRow key={it.id} item={it} overlapsWith={overlapTitles(partners, it.id) || undefined} onPress={() => router.push(`/item/${it.id}`)} />
        ))}
        {/* T81: ideas planned for this day, as light "Planned" rows. */}
        {trip ? <PlannedIdeas trip={trip} day={day.date} /> : null}
        {!day.items.length && !day.continuing.length ? <Body muted>{t('trip.dayEmpty')}</Body> : null}
        {adding === day.date ? (
          kindChooser(day.date)
        ) : (
          <Button label={t('trip.addToDay', { day: formatDay(day.date, lang) })} kind="quiet" hint={t('trip.addHint')} onPress={() => setAdding(day.date)} />
        )}
      </Card>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adding, lang, t, theme, router, partners, trip],
  );

  if (!trip) {
    return (
      <Screen>
        <EmptyState title={t('trip.title')} body={t('trip.notFound')} />
      </Screen>
    );
  }

  const nights = nightsWithoutBed(trip);
  const clashes = overlaps(trip.items);
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
            <ReadinessCard trip={trip} />
            {past ? null : <JetLagCard trip={trip} />}
            <WeatherCard trip={trip} />
            <DemoIntro trip={trip} />
            {empty ? (
              <EmptyState
                title={t('spec.timeline.emptyTitle')}
                body={t('spec.timeline.emptyBody')}
                action={adding === FIRST ? kindChooser(trip.startDate) : <Button label={t('spec.timeline.addItem')} hint={t('spec.timeline.addItemHint')} onPress={() => setAdding(FIRST)} />}
              />
            ) : null}
            {nights.length ? <Warning text={t('trip.warnNights', { n: nights.length, days: nights.map((d) => formatDay(d, lang)).join(', ') })} /> : null}
            {clashes.map(([a, b]) => (
              <Warning key={`${a.id}-${b.id}`} text={t('trip.warnClash', { a: a.title, b: b.title })} />
            ))}
            <TripRecapSlot trip={trip} />
            <TripJournalSlot trip={trip} />
            <TripIdeasSlot trip={trip} />
            <TripSpendingSlot trip={trip} />
            <TripPackingSlot trip={trip} />
            <TripPlaces trip={trip} />

            <Button label={t('trip.edit')} hint={t('spec.timeline.editHint')} kind="quiet" onPress={() => router.push({ pathname: '/trip-edit', params: { id: trip.id } })} />
            <SharePlan trip={trip} />
            {empty ? null : <AddToCalendar trip={trip} scope={{ kind: 'trip' }} />}
            <TripExport trip={trip} />
          </View>
        }
      />
    </>
  );
}
