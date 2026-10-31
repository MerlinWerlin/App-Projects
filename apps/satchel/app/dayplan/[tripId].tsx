// T98 Plan my day: one trip day as a short walking route. The day's timed bookings with a map position stay at their
// times, the ideas planned for the day (with a map spot) and any saved places added to it are fitted between them
// (src/core/dayplan.ts), starting from the hotel the traveller wakes up in or from one position check. The map
// shows numbered stops and the route line over a downloaded city map where there is one; each stop has its
// approximate walk, a "leave by" before timed bookings, Move up / Move down for untimed stops, and Apple Maps
// walking directions per leg. ?day=YYYY-MM-DD picks the day (default: today on the trip, else its first day).
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickCityFor, type CityMap } from '../../src/core/citymaps.ts';
import {
  addPlaceToDay,
  canMoveStop,
  dayPlan,
  legUrl,
  moveStop,
  placesToAdd,
  planDays,
  planPoints,
  removePlaceFromDay,
  resetDayOrder,
  type DayPlan,
  type PlanLeg,
  type PlanStop,
} from '../../src/core/dayplan.ts';
import { formatDay, zoneCity } from '../../src/core/format.ts';
import { ideaDayNumber } from '../../src/core/ideas.ts';
import { AIRPORT_PREFS_KEY, DEFAULT_AIRPORT_PREFS, normaliseAirportPrefs, type AirportPrefs } from '../../src/core/leaveby.ts';
import type { Trip } from '../../src/core/model.ts';
import type { PermissionState } from '../../src/core/permissions.ts';
import { distanceParts, regionFor, type LatLon } from '../../src/core/poi.ts';
import { routeToday } from '../../src/core/triproute.ts';
import { listInstalled, offlineTilesFor } from '../../src/native/cityMaps.ts';
import { locateOnce } from '../../src/native/location.ts';
import { SatchelMap, type MapFit, type MapLine, type MapPin } from '../../src/native/maps.tsx';
import { useNetworkStatus } from '../../src/native/network.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, HeroHeader, SectionCard } from '../../src/ui/hero.tsx';
import { categoryKey, IDEA_ICONS } from '../../src/ui/ideas.tsx';
import { KIND_ICON, kindKey } from '../../src/ui/kinds.tsx';
import { Body, Button, Card, Chip, EmptyState, Label, PressableScale } from '../../src/ui/kit.tsx';
import { PermissionNotice } from '../../src/ui/PermissionNotice.tsx';

const MAP_HEIGHT = 260;

type Loc = { s: 'idle' } | { s: 'checking' } | { s: 'here'; at: LatLon } | { s: 'denied'; state: Exclude<PermissionState, 'granted'> } | { s: 'unavailable' };

export default function DayPlanScreen() {
  const { tripId, day } = useLocalSearchParams<{ tripId: string; day?: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <View style={{ flex: 1, padding: space.l }}>
        <EmptyState art="magnifier" title={t('dayplan.title')} body={t('dayplan.notFound')} />
      </View>
    );
  }
  const days = planDays(trip, '').days;
  const chosen = typeof day === 'string' && days.includes(day) ? day : (routeToday(trip) ?? (days.includes(trip.startDate) ? trip.startDate : (days[0] ?? trip.startDate)));
  return <DayPlanView trip={trip} day={chosen} />;
}

function DayPlanView({ trip, day }: { trip: Trip; day: string }) {
  const { t, theme, lang } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saveTrip } = useTrips();
  const net = useNetworkStatus();
  const [storedPrefs] = usePersisted<AirportPrefs>(AIRPORT_PREFS_KEY, DEFAULT_AIRPORT_PREFS);
  const airportPrefs = useMemo(() => normaliseAirportPrefs(storedPrefs), [storedPrefs]);
  const [mode, setMode] = useState<'hotel' | 'here'>('hotel');
  const [loc, setLoc] = useState<Loc>({ s: 'idle' });
  const [linkFailed, setLinkFailed] = useState(false);
  const here = mode === 'here' && loc.s === 'here' ? loc.at : null;
  const plan = useMemo(() => dayPlan(trip, day, { here, airportPrefs }), [trip, day, here, airportPrefs]);
  const nav = useMemo(() => planDays(trip, day), [trip, day]);
  const toAdd = useMemo(() => placesToAdd(trip, day), [trip, day]);

  // Downloaded city maps: the one under the plan draws its tiles (works in flight mode).
  const [installed, setInstalled] = useState<CityMap[]>([]);
  useEffect(() => {
    let live = true;
    listInstalled()
      .then((l) => live && setInstalled(l))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const points = useMemo(() => planPoints(plan), [plan]);
  const region = useMemo(() => regionFor(points), [points]);
  const city = useMemo(() => (region ? pickCityFor(region.latitude, region.longitude, installed) : null), [region, installed]);
  const offlineTiles = useMemo(() => (city ? offlineTilesFor(city) : null), [city]);
  const signature = points.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|');
  const [fit, setFit] = useState<MapFit | null>(null);
  useEffect(() => {
    if (points.length) setFit({ points, key: Date.now() });
    // Only when the stops themselves change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const dayNumber = ideaDayNumber(trip, day);
  const date = formatDay(day, lang);
  const dayLabel = dayNumber != null ? t('dayplan.dayLabel', { n: dayNumber, date }) : date;

  const manyZones = new Set(plan.stops.filter((s) => s.kind === 'booking' && s.tz).map((s) => s.tz)).size > 1;
  const clock = (local: string, tz: string) => (manyZones ? t('dayplan.timeZone', { time: local.slice(11, 16), city: zoneCity(tz) }) : local.slice(11, 16));
  const distance = (m: number) => {
    const d = distanceParts(m);
    return `${d.n} ${t(d.unit === 'm' ? 'map.unit.m' : 'map.unit.km')}`;
  };
  const walkTime = (min: number) => (min < 60 ? t('dayplan.min', { n: min }) : t('dayplan.hourMin', { h: Math.floor(min / 60), m: min % 60 }));
  const stopsText = (n: number) => (n === 1 ? t('dayplan.stopsOne') : t('dayplan.stopsMany', { n }));

  const save = async (next: Trip, said: string) => {
    if (next === trip) return;
    if (!(await saveTrip(next))) {
      Alert.alert(t('dayplan.saveFailed.title'), t('dayplan.saveFailed.body'));
      return;
    }
    AccessibilityInfo.announceForAccessibility(said);
  };

  const useHere = async () => {
    setMode('here');
    if (loc.s === 'checking' || loc.s === 'here') return;
    setLoc({ s: 'checking' });
    const r = await locateOnce();
    if (r.ok) setLoc({ s: 'here', at: { lat: r.coords.lat, lon: r.coords.lon } });
    else if (r.reason === 'denied') setLoc({ s: 'denied', state: r.state });
    else setLoc({ s: 'unavailable' });
  };
  const retryHere = () => {
    setLoc({ s: 'idle' });
    setMode('hotel');
  };

  const openStop = (s: PlanStop) => {
    if (s.kind === 'booking' && s.itemId) router.push(`/item/${s.itemId}`);
    else if (s.kind === 'idea' && s.ideaId) router.push({ pathname: '/idea-edit', params: { tripId: trip.id, ideaId: s.ideaId } });
    else if (s.kind === 'place' && s.placeId) router.navigate({ pathname: '/map', params: { tripId: trip.id, placeId: s.placeId } });
  };

  const directions = async (leg: PlanLeg) => {
    setLinkFailed(false);
    try {
      await Linking.openURL(legUrl(leg));
    } catch {
      setLinkFailed(true);
    }
  };

  const startName = plan.start ? (plan.start.kind === 'here' ? t('dayplan.start.hereName') : plan.start.name) : '';

  const pins = useMemo<MapPin[]>(() => {
    const out: MapPin[] = [];
    if (plan.start) {
      out.push({
        id: 'start',
        lat: plan.start.lat,
        lon: plan.start.lon,
        title: t('dayplan.pin.start', { name: startName }),
        color: theme.ink,
        a11y: t('dayplan.pin.start', { name: startName }),
        badge: { text: '', icon: plan.start.kind === 'hotel' ? 'bed' : 'navigate' },
      });
    }
    for (const s of plan.stops) {
      out.push({
        id: s.key,
        lat: s.lat,
        lon: s.lon,
        title: `${s.n}. ${s.name}`,
        subtitle: s.kind === 'booking' && s.time ? s.time : undefined,
        color: s.kind === 'booking' ? theme.accentStrong : theme.sea,
        a11y: t('dayplan.pin.stopA11y', { n: s.n, name: s.name }),
        badge: { text: String(s.n), icon: s.kind === 'booking' && s.itemKind ? KIND_ICON[s.itemKind] : s.kind === 'idea' && s.category ? IDEA_ICONS[s.category] : 'bookmark' },
      });
    }
    return out;
  }, [plan, theme, t, startName]);
  const lines = useMemo<MapLine[]>(() => (points.length > 1 ? [{ id: 'plan', points, color: theme.accentStrong }] : []), [points, theme]);

  const goDay = (d: string | null) => {
    if (d) router.setParams({ day: d });
  };

  const summary = plan.walkM > 0 ? t('dayplan.summary', { stops: stopsText(plan.stops.length), distance: distance(plan.walkM), time: walkTime(plan.minutes) }) : t('dayplan.summaryNoWalk', { stops: stopsText(plan.stops.length) });

  return (
    <>
      <Stack.Screen options={{ title: t('dayplan.title') }} />
      <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
        <FadeInView>
          <HeroHeader compact tone="map" illustration="route" title={t('dayplan.title')} eyebrow={trip.name} subtitle={dayLabel} />
        </FadeInView>

        <View style={{ flexDirection: 'row', gap: space.s }}>
          <DayButton dir={-1} enabled={!!nav.prev} onPress={() => goDay(nav.prev)} />
          <View style={{ flex: 1 }} />
          <DayButton dir={1} enabled={!!nav.next} onPress={() => goDay(nav.next)} />
        </View>

        <View style={{ gap: space.s }}>
          <Label>{t('dayplan.start.heading')}</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('dayplan.start.heading')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            <Chip
              label={plan.hotel ? t('dayplan.start.hotel') : t('dayplan.start.noHotel')}
              a11yLabel={plan.hotel ? t('dayplan.start.hotelA11y', { name: plan.hotel.name }) : t('dayplan.start.noHotelA11y')}
              hint={t('dayplan.start.hint')}
              selected={mode === 'hotel' || !here}
              icon={<Ionicons name="bed-outline" size={18} color={theme.sea} />}
              onPress={() => setMode('hotel')}
            />
            <Chip
              label={t('dayplan.start.here')}
              a11yLabel={t('dayplan.start.hereA11y')}
              hint={t('dayplan.start.hint')}
              selected={mode === 'here' && !!here}
              icon={<Ionicons name="navigate-outline" size={18} color={theme.sea} />}
              onPress={useHere}
            />
          </View>
          {mode === 'here' && loc.s === 'checking' ? (
            <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.muted }]}>
              {t('dayplan.start.checking')}
            </Text>
          ) : null}
          {mode === 'here' && loc.s === 'denied' ? <PermissionNotice kind="location" state={loc.state} onRetry={retryHere} /> : null}
          {mode === 'here' && loc.s === 'unavailable' ? (
            <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.muted }]}>
              {t('dayplan.start.unavailable')}
            </Text>
          ) : null}
          <Text style={[typeScale.small, { color: theme.muted }]}>
            {plan.start ? (plan.start.kind === 'hotel' ? t('dayplan.start.hotelName', { name: plan.start.name }) : t('dayplan.start.once')) : t('dayplan.start.none')}
          </Text>
        </View>

        {plan.stops.length === 0 ? (
          <EmptyState
            art="mapPin"
            title={t('dayplan.empty.title')}
            body={t('dayplan.empty.body')}
            action={<Button label={t('dayplan.empty.ideas')} hint={t('dayplan.empty.ideasHint')} kind="secondary" icon="bulb-outline" onPress={() => router.push(`/ideas/${trip.id}`)} />}
          />
        ) : (
          <>
            {region ? (
              <SatchelMap
                pins={pins}
                initialRegion={region}
                onPinPress={(id) => {
                  const s = plan.stops.find((x) => x.key === id);
                  if (s) openStop(s);
                }}
                height={MAP_HEIGHT}
                label={t('dayplan.map.a11y')}
                fallbackTitle={t('dayplan.map.noMapTitle')}
                fallbackBody={t('dayplan.map.noMapBody')}
                offlineTiles={offlineTiles}
                limitZoom={net === 'offline'}
                lines={lines}
                fit={fit}
              />
            ) : null}
            {city && offlineTiles ? (
              <View accessible accessibilityLabel={t('citymaps.chipA11y', { city: city.name })} style={{ alignSelf: 'flex-start', paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: theme.okSoft }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: theme.ok }}>{t('citymaps.chip', { city: city.name })}</Text>
              </View>
            ) : null}

            <SectionCard title={dayLabel} subtitle={summary} icon="walk-outline" tone="accent">
              <Text style={[typeScale.small, { color: theme.muted }]}>{plan.manual ? t('dayplan.manual') : t('dayplan.suggested')}</Text>
              {plan.manual ? (
                <Button label={t('dayplan.reset')} hint={t('dayplan.resetHint')} kind="quiet" icon="refresh" onPress={() => save(resetDayOrder(trip, day), t('dayplan.resetDone'))} />
              ) : null}
              {plan.stops.map((s) => (
                <StopBlock
                  key={s.key}
                  stop={s}
                  plan={plan}
                  startName={startName}
                  clock={clock}
                  distance={distance}
                  walkTime={walkTime}
                  onOpen={() => openStop(s)}
                  onDirections={directions}
                  onMove={(dir) => save(moveStop(trip, plan, s.key, dir), t(dir < 0 ? 'dayplan.movedUp' : 'dayplan.movedDown', { name: s.name }))}
                  onRemove={s.kind === 'place' && s.placeId ? () => save(removePlaceFromDay(trip, day, s.placeId!), t('dayplan.removed', { name: s.name })) : undefined}
                />
              ))}
              {linkFailed ? (
                <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.danger }]}>
                  {t('dayplan.directionsFailed')}
                </Text>
              ) : null}
              {plan.longLegs ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('dayplan.longLeft')}</Text> : null}
              <Text style={[typeScale.small, { color: theme.muted }]}>{t('dayplan.approx')}</Text>
            </SectionCard>
          </>
        )}

        {plan.unplaced.ideas.length || plan.unplaced.bookings.length ? (
          <Card>
            <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
              {t('dayplan.unplaced.heading')}
            </Text>
            <Body muted>{t('dayplan.unplaced.body')}</Body>
            {plan.unplaced.ideas.map((i) => (
              <LinkRow key={`i:${i.id}`} icon="bulb-outline" label={t('dayplan.unplaced.idea', { name: i.name })} hint={t('dayplan.unplaced.ideaHint')} onPress={() => router.push({ pathname: '/idea-edit', params: { tripId: trip.id, ideaId: i.id } })} />
            ))}
            {plan.unplaced.bookings.map((b) => (
              <LinkRow key={`b:${b.id}`} icon="pricetag-outline" label={t('dayplan.unplaced.booking', { name: b.title })} hint={t('dayplan.unplaced.bookingHint')} onPress={() => router.push(`/item/${b.id}`)} />
            ))}
          </Card>
        ) : null}

        <Card>
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {t('dayplan.add.heading')}
          </Text>
          <Body muted>{toAdd.length ? t('dayplan.add.body') : t('dayplan.add.none')}</Body>
          {toAdd.map((p) => (
            <LinkRow key={p.id} icon="add-circle-outline" label={p.name} a11y={t('dayplan.add.a11y', { name: p.name })} hint={t('dayplan.add.hint')} onPress={() => save(addPlaceToDay(trip, day, p.id), t('dayplan.added', { name: p.name }))} />
          ))}
        </Card>

        <Body muted>{t('dayplan.offline')}</Body>
      </ScrollView>
    </>
  );
}

function DayButton({ dir, enabled, onPress }: { dir: -1 | 1; enabled: boolean; onPress: () => void }) {
  const { t, theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t(dir < 0 ? 'dayplan.prev' : 'dayplan.next')}
      accessibilityHint={t(dir < 0 ? 'dayplan.prevHint' : 'dayplan.nextHint')}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={{ flexDirection: dir < 0 ? 'row' : 'row-reverse', alignItems: 'center', gap: space.xs, paddingHorizontal: space.m, borderRadius: radius.pill, backgroundColor: enabled ? theme.seaSoft : theme.cardRaised, opacity: enabled ? 1 : 0.5 }}
    >
      <Ionicons name={dir < 0 ? 'chevron-back' : 'chevron-forward'} size={18} color={enabled ? theme.sea : theme.muted} />
      <Text style={[typeScale.bodyStrong, { fontSize: 14, color: enabled ? theme.sea : theme.muted }]}>{t(dir < 0 ? 'dayplan.prev' : 'dayplan.next')}</Text>
    </PressableScale>
  );
}

function LinkRow({ icon, label, a11y, hint, onPress }: { icon: 'bulb-outline' | 'pricetag-outline' | 'add-circle-outline'; label: string; a11y?: string; hint: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityHint={hint} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TOUCH }}>
      <Ionicons name={icon} size={20} color={theme.sea} />
      <Text style={[typeScale.body, { flex: 1, color: theme.ink }]} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

function StopBlock({
  stop: s,
  plan,
  startName,
  clock,
  distance,
  walkTime,
  onOpen,
  onDirections,
  onMove,
  onRemove,
}: {
  stop: PlanStop;
  plan: DayPlan;
  startName: string;
  clock: (local: string, tz: string) => string;
  distance: (m: number) => string;
  walkTime: (min: number) => string;
  onOpen: () => void;
  onDirections: (leg: PlanLeg) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const { t, theme } = useApp();
  const leg = s.leg;
  const booking = s.kind === 'booking';
  const colour = booking ? theme.accentStrong : theme.sea;
  const time = booking && s.time && s.tz ? clock(`2000-01-01T${s.time}`, s.tz) : '';
  const kind = s.itemKind ? t(kindKey(s.itemKind)) : '';
  const line = booking
    ? s.role === 'from'
      ? t('dayplan.stop.departs', { time, kind })
      : s.role === 'to'
        ? t('dayplan.stop.arrives', { time, kind })
        : t('dayplan.stop.time', { time, kind })
    : s.kind === 'idea' && s.category
      ? t(s.done ? 'dayplan.stop.ideaDone' : 'dayplan.stop.idea', { cat: t(categoryKey(s.category)) })
      : t('dayplan.stop.place');
  const a11y = booking
    ? t('dayplan.stop.bookingA11y', { n: s.n, time, title: s.title ?? s.name, name: s.name })
    : s.kind === 'idea'
      ? t('dayplan.stop.ideaA11y', { n: s.n, name: s.name })
      : t('dayplan.stop.placeA11y', { n: s.n, name: s.name });
  const hint = booking ? t('dayplan.stop.openBooking') : s.kind === 'idea' ? t('dayplan.stop.openIdea') : t('dayplan.stop.openPlace');
  const can = booking ? { up: false, down: false } : canMoveStop(plan, s.key);
  const fromName = leg ? (s.n === 1 && plan.start ? startName : leg.from.name) : '';

  return (
    <View style={{ gap: space.xs }}>
      {leg ? (
        <View style={{ marginLeft: 15, paddingLeft: space.l + 1, borderLeftWidth: 2, borderLeftColor: theme.line, borderStyle: 'dashed', gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <Text
              accessibilityLabel={leg.ride || leg.same || leg.long ? undefined : t('dayplan.legA11y', { from: fromName, to: s.name, distance: distance(leg.walkM), time: walkTime(leg.minutes) })}
              style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, color: theme.muted, fontVariant: ['tabular-nums'] }}
            >
              {leg.ride ? t('dayplan.legRide', { kind }) : leg.same ? t('dayplan.legSame') : leg.long ? t('dayplan.legLong', { distance: distance(leg.straightM) }) : t('dayplan.leg', { distance: distance(leg.walkM), time: walkTime(leg.minutes) })}
            </Text>
            {leg.ride || leg.same ? null : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('dayplan.directionsA11y', { from: fromName, to: s.name })}
                accessibilityHint={t('dayplan.directionsHint')}
                onPress={() => onDirections({ ...leg, from: { ...leg.from, name: fromName } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
              >
                <Ionicons name="walk-outline" size={16} color={theme.sea} />
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.sea }}>{t('dayplan.directions')}</Text>
              </PressableScale>
            )}
          </View>
        </View>
      ) : null}
      {s.leave ? (
        <View accessible style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start', padding: space.s, borderRadius: radius.m, backgroundColor: s.leave.tight ? theme.warnSoft : theme.tealSoft }}>
          <Ionicons name="time-outline" size={18} color={s.leave.tight ? theme.warn : theme.teal} />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyStrong, { color: s.leave.tight ? theme.warn : theme.teal }]}>
              {s.leave.kind === 'airport'
                ? t('dayplan.leave.airport', { time: clock(s.leave.local, s.leave.tz) })
                : s.leave.from || fromName
                  ? t('dayplan.leave.walk', { from: fromName || s.leave.from, time: clock(s.leave.local, s.leave.tz) })
                  : t('dayplan.leave.walkStart', { time: clock(s.leave.local, s.leave.tz) })}
            </Text>
            <Text style={[typeScale.small, { color: theme.muted }]}>{s.leave.kind === 'airport' ? t('dayplan.leave.airportNote') : t('dayplan.leave.walkNote')}</Text>
            {s.leave.tight ? <Text style={[typeScale.small, { color: theme.warn }]}>{t('dayplan.leave.tight')}</Text> : null}
          </View>
        </View>
      ) : null}
      <PressableScale accessibilityRole="button" accessibilityLabel={a11y} accessibilityHint={hint} onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: space.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colour }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.card }}>{s.n}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{booking ? (s.title ?? s.name) : s.name}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{booking && s.title && s.title !== s.name ? `${line} · ${s.name}` : line}</Text>
        </View>
      </PressableScale>
      {can.up || can.down || onRemove ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, paddingLeft: 32 + space.m }}>
          {can.up || can.down ? (
            <>
              <MoveButton dir={-1} enabled={can.up} name={s.name} onPress={() => onMove(-1)} />
              <MoveButton dir={1} enabled={can.down} name={s.name} onPress={() => onMove(1)} />
            </>
          ) : null}
          {onRemove ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('dayplan.removePlaceA11y', { name: s.name })}
              accessibilityHint={t('dayplan.removePlaceHint')}
              onPress={onRemove}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.l, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line }}
            >
              <Ionicons name="remove-circle-outline" size={16} color={theme.ink} />
              <Text style={[typeScale.bodyStrong, { fontSize: 14, color: theme.ink }]}>{t('dayplan.removePlace')}</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MoveButton({ dir, enabled, name, onPress }: { dir: -1 | 1; enabled: boolean; name: string; onPress: () => void }) {
  const { t, theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t(dir < 0 ? 'dayplan.upA11y' : 'dayplan.downA11y', { name })}
      accessibilityHint={t(dir < 0 ? 'dayplan.upHint' : 'dayplan.downHint')}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: enabled ? theme.seaSoft : theme.cardRaised, opacity: enabled ? 1 : 0.5 }}
    >
      <Ionicons name={dir < 0 ? 'arrow-up' : 'arrow-down'} size={16} color={enabled ? theme.sea : theme.muted} />
      <Text style={[typeScale.bodyStrong, { fontSize: 14, color: enabled ? theme.sea : theme.muted }]}>{t(dir < 0 ? 'dayplan.up' : 'dayplan.down')}</Text>
    </PressableScale>
  );
}
