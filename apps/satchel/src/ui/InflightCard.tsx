// T113 In-flight mode: the "In the air" hero for Your day and the trip screen, and the pieces app/inflight/[itemId].tsx
// shares. Everything comes from src/core/inflight.ts (booking data only, offline, no flight-status lookups).
// The arc is original vector art (react-native-svg); the plane glyph glides to its new spot with a timed tween each
// minute (never a spring), and simply sits there under Reduce Motion. Text on the gradient sits on heroChip glass.
// After landing abroad the arrival card takes over (the card hides); a domestic landing keeps a slim card for 6 h.
// T116: the full screen ticks every 10 s while it is focused (FULL_TICK_MS; paused when another screen is on top);
// the cards keep the 1 min tick. The plane still moves with the same timed tween, never a spring.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { deviceZone, formatDay, formatDuration } from '../core/format.ts';
import { formatOffset } from '../core/glance.ts';
import { arcFlown, arcFor, arcPath, arcPoint, inflightForItem, inflightForTrips, inflightView, landingStay, type InflightOptions, type InflightView, type LandingCheck } from '../core/inflight.ts';
import type { Trip } from '../core/model.ts';
import { formatMoney } from '../core/spending.ts';
import { isEmptyStay } from '../core/staydetails.ts';
import type { Key } from '../i18n/en.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { useStayDetails } from '../state/stay.ts';
import { useTrips } from '../state/trips.tsx';
import { duration, timed } from '../theme/motion.ts';
import { radius, shadowOf, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { useAirportPrefs } from './AirportFields.tsx';
import { FadeInView, GradientFill, type IconName } from './hero.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';
import { useSleep } from './JetLagCard.tsx';
import { PressableScale } from './kit.tsx';
import { useMapsOnPhone } from './ReadinessCard.tsx';

/** Card tick (Your day, trip screen) and the full screen's faster tick (T116). */
export const CARD_TICK_MS = 60_000;
export const FULL_TICK_MS = 10_000;

/**
 * The time now, refreshed every `ms` (0 pauses it; when it resumes the time is read at once). Used instead of
 * useMinute so the full in-flight screen can tick faster and stop while it is not focused.
 */
export function useTicker(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!(ms > 0)) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ------------------------------------------------------------------ data

type Select = (opts: InflightOptions) => InflightView | null;

/**
 * The view for `select` with everything the phone holds: Airport day defaults, usual sleep, home country, installed
 * city maps and (second pass) whether stay details are saved for the stay you land into.
 */
function useInflightWith(select: Select, deps: unknown[], tickMs: number = CARD_TICK_MS): InflightView | null {
  const now = useTicker(tickMs);
  const [prefs] = useAirportPrefs();
  const { wake, bed } = useSleep();
  const { homeIso } = useHomeCountry();
  const maps = useMapsOnPhone();
  const { trips } = useTrips();
  const opts = useMemo<InflightOptions>(
    () => ({ now, phoneZone: deviceZone(), prefs, wake, bed, homeIso2: homeIso, installed: maps.installed }),
    [now, prefs, wake, bed, homeIso, maps.installed],
  );
  const first = useMemo(() => select(opts), [opts, ...deps]);
  const trip = first ? trips.find((x) => x.id === first.tripId) : undefined;
  const stayId = trip && first ? (landingStay(trip, first.arr)?.id ?? '') : '';
  const [details, loaded] = useStayDetails(stayId);
  const saved = !!stayId && loaded && !isEmptyStay(details);
  return useMemo(() => (saved ? select({ ...opts, stayDetails: true }) : first), [saved, first, opts, ...deps]);
}

export const useInflightForTrips = (trips: Trip[]) => useInflightWith((o) => inflightForTrips(trips, o), [trips]);
export const useInflightForTrip = (trip: Trip) => useInflightWith((o) => inflightView(trip, o), [trip]);
/** The full screen's view; `tickMs` FULL_TICK_MS while focused, 0 to pause. */
export function useInflightForItem(itemId: string, tickMs: number = CARD_TICK_MS) {
  const { trips } = useTrips();
  return useInflightWith((o) => inflightForItem(trips, itemId, o), [trips, itemId], tickMs);
}

// ------------------------------------------------------------------ words

export function headline(t: T, v: InflightView): string {
  if (v.phase === 'before') return t('inflight.titleBefore', { d: formatDuration(v.minutesLeft) });
  if (v.phase === 'landed') return t('inflight.titleLanded', { city: v.toCity });
  return t('inflight.titleAir');
}

export function eyebrow(t: T, v: InflightView): string {
  const key: Key = v.phase === 'before' ? 'inflight.eyebrowBefore' : v.phase === 'landed' ? 'inflight.eyebrowLanded' : 'inflight.eyebrowAir';
  return t(key, { trip: v.tripName });
}

/** "Lands 07:00 Tokyo time" (with the date when it is not the departure date). */
export function landsLine(t: T, v: InflightView, lang: string): string {
  const time = v.landsLocal.slice(11, 16);
  const city = v.destination.city;
  if (v.phase === 'landed') return t('inflight.landedAgo', { time, city, ago: formatDuration(v.minutesSince) });
  return v.landsDayShift ? t('inflight.landsOn', { day: formatDay(v.landsDay, lang), time, city }) : t('inflight.lands', { time, city });
}

export function watchLines(t: T, v: InflightView): { set: string; diff: string } {
  const from = v.fromCity;
  const off = formatOffset(v.watch.diffMinutes);
  return {
    set: t('inflight.watch', { time: v.watch.time }),
    diff: off ? t('inflight.watchDiff', { city: v.destination.city, d: off, from }) : t('inflight.watchSame', { from }),
  };
}

const STEP: Record<'leave' | 'bagDrop' | 'boarding' | 'departure', Key> = {
  leave: 'inflight.step.leave',
  bagDrop: 'inflight.step.bagDrop',
  boarding: 'inflight.step.boarding',
  departure: 'inflight.step.departure',
};

/** Before departure: the next Airport day step and the leave-by line (null when no travel time is set). */
export function beforeLines(t: T, v: InflightView): { next: string | null; leave: string | null } {
  const b = v.before;
  if (!b) return { next: null, leave: null };
  const next = b.next && b.next.step !== 'departure' ? t(STEP[b.next.step], { d: formatDuration(b.next.minutes) }) : null;
  const leave = b.leaveBy ? t(b.leavePassed ? 'inflight.leavePassed' : 'inflight.leaveBy', { time: b.leaveBy.local.slice(11, 16) }) : null;
  return { next, leave };
}

export function jetlagLine(t: T, v: InflightView): string | null {
  const j = v.jetlag;
  if (!j) return null;
  const parts = [t(j.direction === 'east' ? 'inflight.jetlagEast' : 'inflight.jetlagWest', { d: formatOffset(Math.abs(j.shift)).replace(/^[+−]/, '') })];
  if (j.seek) parts.push(t('inflight.jetlagSeek', { from: j.seek.from, to: j.seek.to }));
  if (j.avoid) parts.push(t('inflight.jetlagAvoid', { from: j.avoid.from, to: j.avoid.to }));
  if (!j.seek && !j.avoid) parts.push(t('inflight.jetlagSettled'));
  return parts.join(' ');
}

type CheckRow = { key: string; icon: IconName; label: string; hint: string; go: () => void };

/** One row per checklist entry, each opening the screen that holds it. */
export function useCheckRows(v: InflightView | null): CheckRow[] {
  const { t, lang } = useApp();
  const router = useRouter();
  return useMemo(() => {
    if (!v) return [];
    const row = (c: LandingCheck): CheckRow => {
      switch (c.kind) {
        case 'arrival':
          return { key: 'arrival', icon: 'earth-outline', label: t('inflight.check.arrival'), hint: t('inflight.check.arrivalHint'), go: () => router.push({ pathname: '/trip/[id]', params: { id: v.tripId } }) };
        case 'stay':
          return { key: 'stay', icon: 'bed-outline', label: t('inflight.check.stay', { name: c.name }), hint: t('inflight.check.stayHint'), go: () => router.push({ pathname: '/stay/[itemId]', params: { itemId: c.itemId } }) };
        case 'address':
          return { key: 'address', icon: 'car-outline', label: t('inflight.check.address', { name: c.name }), hint: t('inflight.check.addressHint'), go: () => router.push({ pathname: '/address/[id]', params: { id: c.itemId } }) };
        case 'cash':
          return {
            key: 'cash',
            icon: 'cash-outline',
            label: t('inflight.check.cash', { amounts: c.rows.map((r) => formatMoney(r.amount, r.currency, lang)).join(', ') }),
            hint: t('inflight.check.cashHint'),
            go: () => router.push(`/cash/${v.tripId}`),
          };
        case 'map':
          return { key: 'map', icon: 'map-outline', label: t('inflight.check.map', { city: c.city }), hint: t('inflight.check.mapHint'), go: () => router.navigate({ pathname: '/map', params: { tripId: v.tripId, placeId: '' } }) };
        case 'toilets':
          return { key: 'toilets', icon: 'male-female-outline', label: t('inflight.check.toilets', { city: c.city }), hint: t('inflight.check.toiletsHint'), go: () => router.navigate('/toilets') };
        case 'roaming':
          return { key: 'roaming', icon: 'cellular-outline', label: t(c.done ? 'inflight.check.roamingDone' : 'inflight.check.roaming'), hint: t('inflight.check.roamingHint'), go: () => router.push(`/todos/${v.tripId}`) };
      }
    };
    return v.checklist.map(row);
  }, [v, t, lang, router]);
}

// ------------------------------------------------------------------ the arc

/** Original plane glyph pointing right, in a 24 x 24 box. */
const PLANE =
  'M3 10.6 L18.6 10.6 Q22 10.6 22 12 Q22 13.4 18.6 13.4 L3 13.4 Z M11 10.6 L8 3 L10.6 3 L15.6 10.6 Z M11 13.4 L8 21 L10.6 21 L15.6 13.4 Z M3.6 10.6 L2 6.5 L4 6.5 L6.6 10.6 Z M3.6 13.4 L2 17.5 L4 17.5 L6.6 13.4 Z';
const PLANE_SIZE = 28;

/**
 * The flight path across the hero: dashed ahead, solid behind, a dot at each end, the plane at the elapsed
 * fraction. Decorative for screen readers apart from one summary label.
 */
export function InflightArc({ v, height = 110 }: { v: InflightView; height?: number }) {
  const { t, theme, reduceMotion } = useApp();
  const [w, setW] = useState(0);
  const arc = useMemo(() => (w ? arcFor(w, height, 18) : null), [w, height]);
  const at = arc ? arcPoint(arc, v.fraction) : null;
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (!at) return;
    const tx = at.x - PLANE_SIZE / 2;
    const ty = at.y - PLANE_SIZE / 2;
    if (reduceMotion || !placed.current) {
      x.setValue(tx);
      y.setValue(ty);
      placed.current = true;
      return;
    }
    const a = timed(x, tx, duration.slow);
    const b = timed(y, ty, duration.slow);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [at?.x, at?.y, reduceMotion, x, y]);

  const pct = Math.round(v.fraction * 100);
  const label = v.phase === 'before' ? t('inflight.arcA11yBefore', { from: v.fromCity, to: v.toCity }) : t('inflight.arcA11y', { from: v.fromCity, to: v.toCity, pct });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}
      style={{ height, width: '100%' }}
    >
      {arc && at ? (
        <>
          <Svg width={w} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d={arcPath(arc)} stroke={theme.heroWash} strokeWidth={2.5} strokeDasharray="6 7" strokeLinecap="round" fill="none" />
            {v.fraction > 0 ? <Path d={arcPath(arcFlown(arc, v.fraction))} stroke={theme.heroInk} strokeWidth={3} strokeLinecap="round" fill="none" /> : null}
            <Circle cx={arc.p0.x} cy={arc.p0.y} r={5} fill={theme.heroInk} />
            <Circle cx={arc.p2.x} cy={arc.p2.y} r={5} fill={v.fraction >= 1 ? theme.heroInk : theme.heroAccent} />
          </Svg>
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', left: 0, top: 0, width: PLANE_SIZE, height: PLANE_SIZE, transform: [{ translateX: x }, { translateY: y }, { rotate: `${Math.round(at.angle)}deg` }] }}
          >
            <Svg width={PLANE_SIZE} height={PLANE_SIZE} viewBox="0 0 24 24">
              <G>
                <Path d={PLANE} fill={theme.heroAccent} />
              </G>
            </Svg>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ hero pieces

export function HeroText({ children, kind = 'body' }: { children: ReactNode; kind?: 'body' | 'strong' | 'muted' | 'code' | 'big' }) {
  const { theme } = useApp();
  const style =
    kind === 'code' ? typeScale.displayM : kind === 'big' ? typeScale.displayL : kind === 'strong' ? typeScale.bodyStrong : kind === 'muted' ? typeScale.small : typeScale.body;
  return <Text style={[style, { color: kind === 'muted' ? theme.heroMuted : theme.heroInk }, kind === 'big' ? { fontVariant: ['tabular-nums'] } : null]}>{children}</Text>;
}

/** A pill button on the gradient (heroChip glass, heroInk text), 48 pt tall. */
export function HeroPill({ label, hint, icon, onPress }: { label: string; hint: string; icon: IconName; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.heroChip, borderWidth: 1, borderColor: theme.heroWash }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={icon} size={18} color={theme.heroInk} />
      </View>
      <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{label}</Text>
    </PressableScale>
  );
}

/** The gradient block with heading, arc and codes; `children` go under the codes on heroChip glass. */
export function InflightHero({ v, arcHeight, children }: { v: InflightView; arcHeight?: number; children?: ReactNode }) {
  const { t, theme } = useApp();
  const title = headline(t, v);
  return (
    <View style={[{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: theme.hero.trips[0] }, shadowOf(theme, 'mid')]}>
      <GradientFill tone="trips" />
      <View style={{ padding: space.l, gap: space.m }}>
        <View accessible accessibilityRole="header" accessibilityLabel={t('inflight.headerA11y', { title, from: v.fromCity, to: v.toCity, flight: v.flight, trip: v.tripName })} style={{ gap: 2 }}>
          <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{eyebrow(t, v)}</Text>
          <Text style={[typeScale.displayM, { color: theme.heroInk }]}>{title}</Text>
          <Text style={[typeScale.small, { color: theme.heroMuted }]}>{t('inflight.routeLine', { from: v.fromCity, to: v.toCity, flight: v.flight })}</Text>
        </View>
        <InflightArc v={v} height={arcHeight} />
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -space.s }}>
          <HeroText kind="code">{v.fromCode}</HeroText>
          <HeroText kind="code">{v.toCode}</HeroText>
        </View>
        {children}
      </View>
    </View>
  );
}

/** Glass panel on the gradient. */
export function Glass({ children, label }: { children: ReactNode; label?: string }) {
  const { theme } = useApp();
  return (
    <View accessible={!!label} accessibilityLabel={label} style={{ backgroundColor: theme.heroChip, borderRadius: radius.m, padding: space.m, gap: space.xs }}>
      {children}
    </View>
  );
}

/** The time panel: time left (or the countdown), landing line, watch line. */
export function TimePanel({ v }: { v: InflightView }) {
  const { t, lang, theme } = useApp();
  const lands = landsLine(t, v, lang);
  if (v.phase === 'before') {
    const b = beforeLines(t, v);
    const dep = t('inflight.departs', { time: v.departsLocal.slice(11, 16), city: v.fromCity });
    return (
      <Glass label={[dep, b.next, b.leave, lands].filter(Boolean).join('. ')}>
        <HeroText kind="strong">{dep}</HeroText>
        {b.next ? <HeroText>{b.next}</HeroText> : null}
        {b.leave ? <HeroText kind="strong">{b.leave}</HeroText> : null}
        <HeroText kind="muted">{lands}</HeroText>
      </Glass>
    );
  }
  if (v.phase === 'landed') {
    return (
      <Glass label={lands}>
        <HeroText kind="strong">{lands}</HeroText>
      </Glass>
    );
  }
  const left = t('inflight.timeLeft', { d: formatDuration(v.minutesLeft) });
  const total = t('inflight.ofTotal', { d: formatDuration(v.durationMin) });
  const w = watchLines(t, v);
  return (
    <Glass label={`${left}, ${total}. ${lands}. ${w.set}. ${w.diff}`}>
      <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{t('inflight.timeLeftLabel')}</Text>
      <HeroText kind="big">{left}</HeroText>
      <HeroText kind="muted">{total}</HeroText>
      <HeroText kind="strong">{lands}</HeroText>
      <HeroText>{w.set}</HeroText>
      <HeroText kind="muted">{w.diff}</HeroText>
    </Glass>
  );
}

// ------------------------------------------------------------------ the cards

function CardBody({ v }: { v: InflightView }) {
  const { t } = useApp();
  const router = useRouter();
  return (
    <FadeInView>
      <InflightHero v={v}>
        <TimePanel v={v} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          <HeroPill label={t('inflight.open')} hint={t('inflight.openHint')} icon="airplane-outline" onPress={() => router.push({ pathname: '/inflight/[itemId]', params: { itemId: v.itemId } })} />
          {v.ticket ? (
            <HeroPill label={t('inflight.ticket')} hint={t('inflight.ticketHint')} icon="ticket-outline" onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: v.ticket?.itemId ?? v.itemId } })} />
          ) : null}
        </View>
      </InflightHero>
    </FadeInView>
  );
}

/** Your day: the flight in the air (else leaving within 24 h, else just landed at home) across all trips. */
export function InflightHomeCard({ trips }: { trips: Trip[] }) {
  const v = useInflightForTrips(trips);
  if (!v || v.handover) return null;
  return <CardBody v={v} />;
}

/** Trip screen: the same card for this trip's flights. */
export function InflightTripCard({ trip }: { trip: Trip }) {
  const v = useInflightForTrip(trip);
  if (!v || v.handover) return null;
  return <CardBody v={v} />;
}
