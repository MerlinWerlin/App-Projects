// Trip timeline: demo intro (first opening of the demo trip), warnings (nights without a bed, clashes), then each
// day with its bookings and any journey still under way from an earlier day; add a booking by kind.
// T41: rows that clash carry a worded overlap marker; a trip that has ended says so at the top (EDGE_CASES "Past
// trips": kept and available, never presented as coming up).
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { overlapPartners, overlapTitles } from '../../src/core/clashes.ts';
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
import { KindIcon, kindKey } from '../../src/ui/kinds.tsx';
import { Body, Button, Card, Chip, EmptyState, Label, PressableScale, Screen, Warning } from '../../src/ui/kit.tsx';
import { TripPackingSlot } from '../../src/ui/slots/TripPackingSlot.tsx';
import { TripSpendingSlot } from '../../src/ui/slots/TripSpendingSlot.tsx';
import { TripExport } from '../../src/ui/TripExport.tsx';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, theme, lang } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState<string | null>(null);
  const trip = trips.find((x) => x.id === id);
  const partners = useMemo(() => overlapPartners(trip?.items ?? []), [trip]);

  const add = (kind: ItemKind, date: string) => {
    setAdding(null);
    router.push({ pathname: '/item-edit', params: { tripId: id, kind, date } });
  };

  const kindChooser = (date: string) => (
    <View style={{ gap: space.s }}>
      <Label>{t('trip.chooseKind')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('trip.chooseKind')}>
        {ITEM_KINDS.map((k) => (
          <Chip key={k} label={t(kindKey(k))} selected={false} icon={<KindIcon kind={k} color={theme.accent} size={18} />} onPress={() => add(k, date)} />
        ))}
      </View>
      <Button label={t('common.cancel')} hint={t('spec.timeline.cancelAddHint')} kind="quiet" onPress={() => setAdding(null)} />
    </View>
  );

  const renderDay = useCallback(
    ({ item: day }: { item: Day }) => (
      <Card>
        <View accessible accessibilityRole="header">
          <Label>{formatDay(day.date, lang)}</Label>
        </View>
        {day.continuing.map((it) => (
          <ItemRow key={`c-${it.id}`} item={it} continuingOn={day.date} onPress={() => router.push(`/item/${it.id}`)} />
        ))}
        {day.items.map((it) => (
          <ItemRow key={it.id} item={it} overlapsWith={overlapTitles(partners, it.id) || undefined} onPress={() => router.push(`/item/${it.id}`)} />
        ))}
        {!day.items.length && !day.continuing.length ? <Body muted>{t('trip.dayEmpty')}</Body> : null}
        {adding === day.date ? (
          kindChooser(day.date)
        ) : (
          <Button label={t('trip.addToDay', { day: formatDay(day.date, lang) })} kind="quiet" hint={t('trip.addHint')} onPress={() => setAdding(day.date)} />
        )}
      </Card>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adding, lang, t, theme, router, partners],
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
  return (
    <>
      <Stack.Screen options={{ title: trip.name }} />
      <FlatList
        style={{ flex: 1, backgroundColor: theme.paper }}
        contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}
        data={groupByDay(trip)}
        keyExtractor={(d) => d.date}
        renderItem={renderDay}
        extraData={adding}
        ListHeaderComponent={
          <View style={{ gap: space.s, marginBottom: space.s }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 16, color: theme.muted }}>{formatRange(trip.startDate, trip.endDate, lang)}</Text>
            {past ? (
              <Card>
                <Label>{t('trips.phase.past')}</Label>
                <Body>{t('spec41.trip.pastNotice')}</Body>
              </Card>
            ) : null}
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
            <TripSpendingSlot trip={trip} />
            <TripPackingSlot trip={trip} />
            <TripPlaces trip={trip} />
            <Button label={t('spec.timeline.map')} hint={t('spec.timeline.mapHint')} kind="quiet" onPress={() => router.navigate({ pathname: '/map', params: { tripId: trip.id, placeId: '' } })} />
            <Button label={t('trip.edit')} hint={t('spec.timeline.editHint')} kind="quiet" onPress={() => router.push({ pathname: '/trip-edit', params: { id: trip.id } })} />
            <TripExport trip={trip} />
          </View>
        }
      />
    </>
  );
}
