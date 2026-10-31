// T69 "Trip on the map": the Map tab's layer for a trip it was opened for. Its bookings with a map position are
// numbered stops (kind icon, one colour per day) joined by a dashed line per day; day chips (All days, Day 1 …,
// Today marked when the trip is on) pick what shows and the camera frames it; the summary card lists the day's
// stops with straight-line distances, opens a stop's booking, and hands a leg to Apple Maps for walking
// directions. The route itself is pure logic in src/core/triproute.ts; this file only turns it into pins, lines
// and controls, so map.tsx keeps its structure.
// T72: journeys with a positioned from / to add departure and arrival stops ("Stations & airports" chip, on by
// default, hides them again); those stops take the place of the booking's plain from / to pins (coversPin).
// T81: planned ideas with a map spot are stops too (after the day's bookings, "Planned", no time); a tap opens the idea.
// T84: a day's ideas can be moved earlier / later there (stored on the trip; the numbers follow).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { formatDay, zoneCity } from '../core/format.ts';
import type { Trip } from '../core/model.ts';
import { distanceParts } from '../core/poi.ts';
import { appleMapsWalkUrl } from '../core/toilets.ts';
import { ALL_DAYS, defaultRouteDay, hasTransportStops, itemDays, routeToday, routeView, tripRoute, type RouteDay, type RouteDayKey, type RouteLeg, type RouteStop } from '../core/triproute.ts';
import type { MapFit, MapLine, MapPin } from '../native/maps.tsx';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, typeScale, type Theme } from '../theme/tokens.ts';
import { SectionCard } from './hero.tsx';
import { IDEA_ICONS, IdeaOrderButtons } from './ideas.tsx';
import { KIND_ICON, kindKey } from './kinds.tsx';
import { Body, Button, EmptyState, PressableScale } from './kit.tsx';

/** One colour per day, cycling. Saved places keep the warn colour and other bookings the accent, so neither is here. */
export const dayColour = (theme: Theme, index: number) => {
  const palette = [theme.accentStrong, theme.sea, theme.teal, theme.ok, theme.ink];
  return palette[((index % palette.length) + palette.length) % palette.length];
};

/** "Train", or for a journey's own stops "Train departure" / "Train arrival" (T72). */
const stopKind = (t: ReturnType<typeof useApp>['t'], s: RouteStop) =>
  s.role === 'idea'
    ? t('ideas.route.kind')
    : s.role === 'from' ? t('triproute.departs', { kind: t(kindKey(s.kind)) }) : s.role === 'to' ? t('triproute.arrives', { kind: t(kindKey(s.kind)) }) : t(kindKey(s.kind));

export type TripRouteLayer = ReturnType<typeof useTripRoute>;

/** The trip's route as map pins, lines and a framing request, with the chosen day. `trip` null: nothing. */
export function useTripRoute(trip: Trip | null) {
  const { t, theme, lang } = useApp();
  const [transport, setTransport] = useState(true);
  const route = useMemo(() => (trip ? tripRoute(trip, { transport, ideas: true }) : null), [trip, transport]);
  const offersTransport = useMemo(() => (trip ? hasTransportStops(trip) : false), [trip]);
  const days = useMemo(() => (trip ? itemDays(trip) : new Map<string, string>()), [trip]);
  const today = trip ? routeToday(trip) : null;
  const [day, setDay] = useState<RouteDayKey>(ALL_DAYS);
  const [fit, setFit] = useState<MapFit | null>(null);
  const view = useMemo(() => (route ? routeView(route, day) : null), [route, day]);

  const dayLabel = useCallback((d: RouteDay) => (d.dayNumber >= 1 ? t('triproute.day', { n: d.dayNumber }) : formatDay(d.date, lang)), [t, lang]);

  /** Frames that day's stops (or the saved places on a day without any). False when there is nothing to frame. */
  const frame = useCallback(
    (key: RouteDayKey) => {
      if (!route) return false;
      const points = routeView(route, key).framePoints;
      if (points.length === 0) return false;
      setFit({ points, key: Date.now() });
      return true;
    },
    [route],
  );

  const chooseDay = useCallback(
    (key: RouteDayKey) => {
      setDay(key);
      frame(key);
    },
    [frame],
  );

  /** Opening the map for the trip: today when it's on, else every day. `framed` false leaves the camera alone. */
  const open = useCallback(
    (framed: boolean) => {
      if (!route) return false;
      const key = framed ? defaultRouteDay(route, today) : ALL_DAYS;
      setDay(key);
      return framed ? frame(key) : false;
    },
    [route, today, frame],
  );

  const pins = useMemo<MapPin[]>(() => {
    if (!view) return [];
    return view.days.flatMap((d) =>
      d.stops.map((s) => ({
        id: `r:${s.key}`,
        lat: s.lat,
        lon: s.lon,
        title: `${s.n}. ${s.name}`,
        subtitle: s.role === 'idea' ? t('ideas.route.pinSubtitle', { day: dayLabel(d) }) : t('triproute.pinSubtitle', { day: dayLabel(d), time: s.time, kind: stopKind(t, s) }),
        color: dayColour(theme, d.index),
        a11y: t('triproute.pinA11y', { n: s.n, day: dayLabel(d), kind: stopKind(t, s), name: s.name }),
        badge: { text: String(s.n), icon: s.role === 'idea' && s.category ? IDEA_ICONS[s.category] : KIND_ICON[s.kind] },
      })),
    );
  }, [view, theme, t, dayLabel]);

  const lines = useMemo<MapLine[]>(
    () => (view ? view.days.filter((d) => d.stops.length > 1).map((d) => ({ id: `l:${d.date}`, points: d.stops, color: dayColour(theme, d.index), dashed: true })) : []),
    [view, theme],
  );

  /** False for a booking on another day than the one shown (its from / to pins hide with its stop). */
  const showsItem = useCallback((itemId: string) => day === ALL_DAYS || days.get(itemId) === day, [day, days]);

  /** Booking pin ids (`${itemId}:${role}`) that are route stops, so the map doesn't draw them twice. */
  const stopKeys = useMemo(() => new Set(route ? route.days.flatMap((d) => d.stops.map((s) => s.key)) : []), [route]);
  const coversPin = useCallback((bookingPinId: string) => bookingPinId.endsWith(':place') || stopKeys.has(bookingPinId), [stopKeys]);

  const toggleTransport = useCallback(() => setTransport((v) => !v), []);

  return { tripId: trip?.id ?? '', route, view, day, today, pins, lines, fit, chooseDay, open, frame, showsItem, coversPin, dayLabel, transport, offersTransport, toggleTransport };
}

/** The day chips under the map: All days, Day 1 … Today is outlined and says so. */
export function TripRouteDays({ layer }: { layer: TripRouteLayer }) {
  const { t, theme, lang } = useApp();
  const { route, day, today, chooseDay, dayLabel, transport, offersTransport, toggleTransport } = layer;
  if (!route || (route.stopCount === 0 && !(offersTransport && !transport))) return null;
  const chip = (key: RouteDayKey, label: string, sub: string | null, a11y: string, isToday: boolean, colour: string | null) => {
    const on = day === key;
    return (
      <PressableScale
        key={key}
        accessibilityRole="radio"
        accessibilityLabel={a11y}
        accessibilityHint={t('triproute.chipHint')}
        accessibilityState={{ selected: on, checked: on }}
        onPress={() => chooseDay(key)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          paddingHorizontal: space.m,
          borderRadius: radius.pill,
          borderWidth: on || isToday ? 1.5 : 1,
          borderColor: on ? theme.accent : isToday ? theme.teal : theme.line,
          backgroundColor: on ? theme.accentSoft : isToday ? theme.tealSoft : theme.cardRaised,
        }}
      >
        {colour ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colour }} /> : null}
        <View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: on ? theme.accentInk : isToday ? theme.teal : theme.ink }}>{isToday ? `${label} · ${t('triproute.today')}` : label}</Text>
          {sub ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{sub}</Text> : null}
        </View>
      </PressableScale>
    );
  };
  return (
    <View style={{ gap: space.xs }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t('triproute.days')} contentContainerStyle={{ gap: space.s, paddingVertical: space.xs }}>
        {chip(ALL_DAYS, t('triproute.allDays'), null, t('triproute.allDaysA11y'), false, null)}
        {route.days.map((d) => {
          const label = dayLabel(d);
          const date = formatDay(d.date, lang);
          const isToday = d.date === today;
          return chip(d.date, label, d.dayNumber >= 1 ? date : null, t(isToday ? 'triproute.chipTodayA11y' : 'triproute.chipA11y', { label, date }), isToday, d.stops.length ? dayColour(theme, d.index) : null);
        })}
      </ScrollView>
      {offersTransport ? (
        <View style={{ flexDirection: 'row' }}>
          <PressableScale
            accessibilityRole="switch"
            accessibilityLabel={t('triproute.transportStops')}
            accessibilityHint={t('triproute.transportStopsHint')}
            accessibilityState={{ checked: transport }}
            onPress={toggleTransport}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              paddingHorizontal: space.m,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: transport ? theme.sea : theme.line,
              backgroundColor: transport ? theme.seaSoft : theme.cardRaised,
            }}
          >
            <Ionicons name={transport ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={transport ? theme.sea : theme.muted} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: transport ? theme.sea : theme.ink }}>{t('triproute.transportStops')}</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

function StopBadge({ stop, colour }: { stop: RouteStop; colour: string }) {
  const { theme } = useApp();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: space.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colour }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.card }}>{stop.n}</Text>
    </View>
  );
}

/**
 * The summary card for the shown day (stops, straight-line distance, each stop and leg), the per-day overview on
 * All days, or the empty state when no booking on the trip has a map position.
 */
export function TripRoutePanel({ layer, onOpenItem, onBackToTrip }: { layer: TripRouteLayer; onOpenItem: (itemId: string) => void; onBackToTrip: () => void }) {
  const { t, theme, lang } = useApp();
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  const { route, view, day, chooseDay, dayLabel } = layer;
  if (!route || !view) return null;

  if (route.stopCount === 0) {
    return (
      <EmptyState
        icon="map-outline"
        title={t('triproute.emptyTitle')}
        body={t('triproute.emptyBody')}
        action={<Button label={t('triproute.emptyAction')} hint={t('triproute.emptyActionHint')} kind="secondary" icon="arrow-back" onPress={onBackToTrip} />}
      />
    );
  }

  const distance = (m: number) => {
    const d = distanceParts(m);
    return `${d.n} ${t(d.unit === 'm' ? 'map.unit.m' : 'map.unit.km')}`;
  };
  const stopsText = (n: number) => (n === 1 ? t('triproute.stopsOne') : t('triproute.stopsMany', { n }));
  const summary = (stops: number, meters: number, legs: number) => (legs > 0 ? t('triproute.summary', { stops: stopsText(stops), distance: distance(meters) }) : t('triproute.summaryOne', { stops: stopsText(stops) }));
  const saved = route.saved.length;
  const savedLine = saved ? <Body muted>{saved === 1 ? t('triproute.savedOne') : t('triproute.savedMany', { n: saved })}</Body> : null;

  const directions = async (leg: RouteLeg) => {
    setFailed(false);
    try {
      await Linking.openURL(appleMapsWalkUrl(leg.to.lat, leg.to.lon, leg.to.name, leg.from));
    } catch {
      setFailed(true);
    }
  };

  if (day === ALL_DAYS) {
    const withStops = route.days.filter((d) => d.stops.length > 0);
    return (
      <SectionCard title={t('triproute.heading')} subtitle={summary(view.stops.length, view.meters, view.legs.length)} icon="trail-sign-outline" tone="accent">
        {withStops.map((d, i) => {
          const date = formatDay(d.date, lang);
          const line = summary(d.stops.length, d.meters, d.legs.length);
          return (
            <PressableScale
              key={d.date}
              accessibilityRole="button"
              accessibilityLabel={t('triproute.dayRowA11y', { day: dayLabel(d), date, summary: line })}
              accessibilityHint={t('triproute.dayRowHint')}
              onPress={() => chooseDay(d.date)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs, borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dayColour(theme, d.index) }} />
              <View style={{ flex: 1 }}>
                <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{d.dayNumber >= 1 ? t('triproute.dayRow', { day: dayLabel(d), date }) : date}</Text>
                <Text style={[typeScale.small, { color: theme.muted }]}>{line}</Text>
              </View>
            </PressableScale>
          );
        })}
        {savedLine}
        {view.legs.length ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('triproute.straightNote')}</Text> : null}
      </SectionCard>
    );
  }

  const shown = view.days[0];
  if (!shown) return null;
  const colour = dayColour(theme, shown.index);
  const manyZones = new Set(shown.stops.filter((s) => s.role !== 'idea').map((s) => s.tz)).size > 1;
  const title = shown.dayNumber >= 1 ? t('triproute.dayRow', { day: dayLabel(shown), date: formatDay(shown.date, lang) }) : formatDay(shown.date, lang);
  return (
    <SectionCard title={title} subtitle={shown.stops.length ? summary(shown.stops.length, shown.meters, shown.legs.length) : undefined} icon="trail-sign-outline" tone="accent">
      {shown.stops.length === 0 ? <Body muted>{t('triproute.dayNone')}</Body> : null}
      {shown.stops.map((s, i) => {
        const leg = shown.legs[i];
        const where = s.role === 'from' ? t('triproute.departsAt', { name: s.name }) : s.role === 'to' ? t('triproute.arrivesAt', { name: s.name }) : s.name;
        const idea = s.role === 'idea';
        const when = idea ? t('ideas.route.stopLine') : manyZones ? t('triproute.stopTimeZone', { time: s.time, city: zoneCity(s.tz), name: where }) : t('triproute.stopTime', { time: s.time, name: where });
        return (
          <View key={s.key} style={{ gap: space.xs }}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={idea ? t('ideas.route.stopA11y', { n: s.n, name: s.name }) : t('triproute.stopA11y', { n: s.n, time: manyZones ? `${s.time} ${zoneCity(s.tz)}` : s.time, title: s.title, name: where })}
              accessibilityHint={idea ? t('ideas.route.stopHint') : t('triproute.stopHint')}
              onPress={() => (idea ? router.push({ pathname: '/idea-edit', params: { tripId: layer.tripId, ideaId: s.ideaId ?? '' } }) : onOpenItem(s.itemId))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}
            >
              <StopBadge stop={s} colour={colour} />
              <View style={{ flex: 1 }}>
                <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{s.title}</Text>
                <Text style={[typeScale.small, { color: theme.muted }]}>{when}</Text>
              </View>
            </PressableScale>
            {idea && s.ideaId ? <IdeaOrderButtons tripId={layer.tripId} ideaId={s.ideaId} name={s.name} /> : null}
            {leg ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, marginLeft: 15, paddingLeft: space.l + 1, borderLeftWidth: 2, borderLeftColor: colour, borderStyle: 'dashed' }}>
                <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, color: theme.muted, fontVariant: ['tabular-nums'] }}>{t('triproute.leg', { distance: distance(leg.meters) })}</Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('triproute.directionsA11y', { from: leg.from.name, to: leg.to.name })}
                  accessibilityHint={t('triproute.directionsHint')}
                  onPress={() => directions(leg)}
                  style={{ paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
                >
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.sea }}>{t('triproute.directions')}</Text>
                </PressableScale>
              </View>
            ) : null}
          </View>
        );
      })}
      {failed ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
          {t('triproute.directionsFailed')}
        </Text>
      ) : null}
      {savedLine}
      {shown.legs.length ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('triproute.straightNote')}</Text> : null}
    </SectionCard>
  );
}
