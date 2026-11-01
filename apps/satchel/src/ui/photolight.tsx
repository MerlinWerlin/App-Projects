// T139 Photo light: golden hour, blue hour, sunrise and sunset for each trip day at that day's stay or place (logic
// in src/core/photolight.ts, built on the T70 sun model; fully offline, every time in the place's own zone).
// - PhotoLightCard: the trip-screen card, right under T70's Weather & daylight card and on the same stops. Day chips,
//   an original sun-arc illustration (react-native-svg, theme tokens only) with "now" between sunrise and sunset, the
//   day's windows, light left today and the next good light. The sun marker eases along the arc with a timed
//   transition (motion.ts, no springs); with Reduce Motion it is simply drawn in place.
// - PhotoLightBriefRow: the Your day row "Golden hour 17:42–18:21" while the trip is on.
// - SpotLightLine: a "Photo light" line for a saved place (Map tab) or an idea (idea editor).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { formatDay } from '../core/format.ts';
import type { LocalDate, Trip } from '../core/model.ts';
import {
  arcSpan,
  briefLight,
  daysAway,
  defaultLightDate,
  goldenWindows,
  blueWindows,
  dayWindows,
  lightDates,
  lightDayFor,
  lightLeftToday,
  nextGoodLight,
  spotLight,
  spotWindows,
  sunArc,
  type DayWindow,
  type LightWindow,
  type PhotoDay,
} from '../core/photolight.ts';
import type { LatLon } from '../core/poi.ts';
import { formatSpan } from '../core/sun.ts';
import { fromUtc, localDate, localTime } from '../core/tz.ts';
import { weatherStops } from '../core/weather.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { duration, timed } from '../theme/motion.ts';
import { radius, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, SectionCard } from './hero.tsx';
import { Chip, PressableScale } from './kit.tsx';
import { useMinute } from './JetLagCard.tsx';

// ------------------------------------------------------------------ text helpers

const hm = (local: string) => localTime(local);

/** "06:10–06:52", or "until 03:30" / "from 22:07" for a window that runs over midnight. */
export function rangeText(t: T, w: LightWindow): string {
  if (w.fromMidnight && w.toMidnight) return t('light.range', { from: '00:00', to: '24:00' });
  if (w.fromMidnight) return t('light.fromMidnight', { to: hm(w.end) });
  if (w.toMidnight) return t('light.toMidnight', { from: hm(w.start) });
  return t('light.range', { from: hm(w.start), to: hm(w.end) });
}

const kindText = (t: T, w: LightWindow) => t(w.kind === 'golden' ? 'light.golden' : 'light.blue');
const noteText = (t: T, d: PhotoDay) => (d.note ? t(`light.note.${d.note}`) : '');

/** "Today" or "Tue 22 Dec" for a photo day, read in the place's zone. */
const dayText = (t: T, d: PhotoDay, now: number, lang: string) => (daysAway(d, now) === 0 ? t('light.spot.today') : formatDay(d.date, lang));

/** The one-line summary for a saved place or idea: "Today: golden 06:10–06:52, 17:42–18:21 · blue …". */
export function spotLine(t: T, d: PhotoDay, now: number, lang: string): string {
  const day = dayText(t, d, now, lang);
  // T146: joined across midnight like the day card ("23:52–00:56"); one carried from the evening before says so.
  const one = (w: DayWindow) => (w.carried ? t('f106.light.spotCarried', { range: rangeText(t, w) }) : rangeText(t, w));
  const join = (ws: DayWindow[]) => ws.map(one).reduce((a, b) => (a ? t('light.spot.list', { a, b }) : b), '');
  const sw = spotWindows(d);
  const golden = join(sw.golden);
  const blue = join(sw.blue);
  if (golden && blue) return t('light.spot.line', { day, golden, blue });
  if (golden) return t('light.spot.goldenOnly', { day, golden });
  return t('light.spot.note', { day, note: noteText(t, d) });
}

// ------------------------------------------------------------------ the sun-arc illustration

const ARC_H = 128;
const PAD_X = 22;
const BASE_FROM_BOTTOM = 30;
const SUN_R = 9;
const SAMPLES = 24;

type Geo = { w: number; x0: number; x1: number; base: number; rx: number; ry: number };
const geoFor = (w: number): Geo => {
  const x0 = PAD_X;
  const x1 = w - PAD_X;
  return { w, x0, x1, base: ARC_H - BASE_FROM_BOTTOM, rx: (x1 - x0) / 2, ry: ARC_H - BASE_FROM_BOTTOM - 18 };
};
/** A point on the half-ellipse: f 0 at sunrise (left), 1 at sunset (right). */
const pt = (g: Geo, f: number) => ({ x: g.x0 + g.rx - g.rx * Math.cos(Math.PI * f), y: g.base - g.ry * Math.sin(Math.PI * f) });
const arcPath = (g: Geo, f0: number, f1: number) => {
  const n = Math.max(2, Math.ceil(SAMPLES * (f1 - f0)) + 1);
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pt(g, f0 + ((f1 - f0) * i) / (n - 1));
    d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
  }
  return d.trim();
};

/**
 * Original illustration: ground under the horizon, the sun's path as a dashed half-ellipse from sunrise to sunset,
 * the golden-hour stretches above the horizon drawn thick in the warm accent, blue-hour ticks just under the horizon
 * at each end, and (for today) the sun where it is now. Decorative to touch; the wrapper speaks it.
 */
const SunArc = memo(function SunArc({ day, now, showNow, label }: { day: PhotoDay; now: number; showNow: boolean; label: string }) {
  const { theme, reduceMotion } = useApp();
  const [width, setWidth] = useState(0);
  const g = width > 0 ? geoFor(width) : null;
  const pos = sunArc(day, now);
  const moving = showNow && (pos.state === 'up' || pos.state === 'polarDay');
  // The marker eases from sunrise to where the sun is now (timed, ease-out), then follows it minute by minute.
  const progress = useRef(new Animated.Value(reduceMotion || !moving ? pos.f : 0)).current;
  useEffect(() => {
    if (reduceMotion || !moving) {
      progress.setValue(pos.f);
      return;
    }
    const a = timed(progress, pos.f, duration.slow * 2, false, duration.base);
    a.start();
    return () => a.stop();
  }, [progress, pos.f, moving, reduceMotion]);

  const marker = useMemo(() => {
    if (!g || !showNow) return null;
    if (moving) {
      const input = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES);
      return {
        x: progress.interpolate({ inputRange: input, outputRange: input.map((f) => pt(g, f).x - SUN_R) }),
        y: progress.interpolate({ inputRange: input, outputRange: input.map((f) => pt(g, f).y - SUN_R) }),
        under: false,
      };
    }
    // Below the horizon: before sunrise on the left, after sunset on the right, polar night in the middle.
    const x = pos.state === 'before' ? g.x0 : pos.state === 'after' ? g.x1 : g.x0 + g.rx;
    return { x: x - SUN_R, y: g.base + 12 - SUN_R, under: true };
  }, [g, showNow, moving, progress, pos.state]);

  const golden = g ? goldenWindows(day).map((w) => arcSpan(day, w)).filter((s): s is [number, number] => s !== null) : [];
  const polarNight = day.sun.polar === 'night';
  const hasBlue = blueWindows(day).length > 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ height: ARC_H, borderRadius: radius.m, overflow: 'hidden', backgroundColor: theme.seaSoft }}
    >
      {g ? (
        <Svg width={g.w} height={ARC_H}>
          <Rect x={0} y={g.base} width={g.w} height={ARC_H - g.base} fill={theme.card} opacity={0.7} />
          <Line x1={0} y1={g.base} x2={g.w} y2={g.base} stroke={theme.muted} strokeWidth={1.5} />
          {polarNight ? null : <Path d={arcPath(g, 0, 1)} stroke={theme.muted} strokeWidth={2} strokeDasharray="4 6" strokeLinecap="round" fill="none" />}
          {golden.map(([a, b]) => (
            <Path key={`${a}-${b}`} d={arcPath(g, a, b)} stroke={theme.accent} strokeWidth={7} strokeLinecap="round" fill="none" />
          ))}
          {hasBlue && !polarNight ? (
            <>
              <Line x1={g.x0 - 10} y1={g.base + 8} x2={g.x0 + 10} y2={g.base + 8} stroke={theme.sea} strokeWidth={5} strokeLinecap="round" />
              <Line x1={g.x1 - 10} y1={g.base + 8} x2={g.x1 + 10} y2={g.base + 8} stroke={theme.sea} strokeWidth={5} strokeLinecap="round" />
            </>
          ) : null}
          {polarNight && hasBlue ? <Line x1={g.x0 + g.rx - 40} y1={g.base + 8} x2={g.x0 + g.rx + 40} y2={g.base + 8} stroke={theme.sea} strokeWidth={5} strokeLinecap="round" /> : null}
          {/* Sunrise and sunset notches on the horizon. */}
          {polarNight || day.sun.polar === 'day' ? null : (
            <>
              <Circle cx={g.x0} cy={g.base} r={3.5} fill={theme.ink} />
              <Circle cx={g.x1} cy={g.base} r={3.5} fill={theme.ink} />
            </>
          )}
        </Svg>
      ) : null}
      {marker ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: SUN_R * 2,
            height: SUN_R * 2,
            borderRadius: SUN_R,
            backgroundColor: marker.under ? theme.muted : theme.accent,
            borderWidth: 3,
            borderColor: theme.accentSoft,
            transform: [{ translateX: marker.x }, { translateY: marker.y }],
          }}
        />
      ) : null}
    </View>
  );
});

function arcLabel(t: T, d: PhotoDay, now: number, dayLabel: string, isToday: boolean): string {
  const s = d.sun;
  let where: string;
  if (s.polar === 'day') where = t('light.polarDay');
  else if (s.polar === 'night') where = t('light.polarNight');
  else {
    const times = t('light.arc.day', { rise: hm(s.sunrise ?? ''), set: hm(s.sunset ?? '') });
    if (!isToday) where = times;
    else {
      const p = sunArc(d, now);
      const at = p.state === 'before' ? t('light.arc.before') : p.state === 'after' ? t('light.arc.after') : t('light.arc.up', { pct: Math.round(p.f * 100) });
      where = `${times} ${at}`;
    }
  }
  return t('light.arcA11y', { day: dayLabel, where });
}

// ------------------------------------------------------------------ trip card

/** T142: a window joined across midnight shows its real times ("23:41–00:37"); one carried from the evening before says so. */
const WindowRow = memo(function WindowRow({ w, first }: { w: DayWindow; first: boolean }) {
  const { t, theme } = useApp();
  const kind = kindText(t, w);
  const part = w.carried ? t('f105.light.carried') : t(`light.part.${w.part}`);
  const range = rangeText(t, w);
  return (
    <View
      accessible
      accessibilityLabel={t('light.windowA11y', { kind, part, range })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 32, paddingTop: first ? 0 : space.xs, borderTopWidth: first ? 0 : 1, borderTopColor: theme.line }}
    >
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: w.kind === 'golden' ? theme.accent : theme.sea }} />
      <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{kind}</Text>
      <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{part}</Text>
      <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{range}</Text>
    </View>
  );
});

/** "Golden hour now, until 18:21 (25 m left)" / "Next: Blue hour at 18:21 (in 2 h 05 m)" / tomorrow's. */
function nextText(t: T, d: PhotoDay, now: number, lang: string): string | null {
  const n = nextGoodLight(d.lat, d.lon, d.tz, now);
  if (!n) return null;
  const kind = kindText(t, n.window);
  if (n.state === 'now') return t('light.now', { kind, time: hm(n.window.end), left: formatSpan(n.minutes) });
  const startDate = localDate(fromUtc(n.window.startUtc, d.tz));
  if (startDate === localDate(fromUtc(now, d.tz))) return t('light.next', { kind, time: hm(n.window.start), wait: formatSpan(n.minutes) });
  return t('light.nextDay', { kind, day: formatDay(startDate, lang), time: hm(n.window.start) });
}

function leftText(t: T, d: PhotoDay, now: number): string {
  const l = lightLeftToday(d, now);
  if (l.goodMin <= 0) return t('light.leftNone');
  if (l.daylightMin !== null && Number.isFinite(l.daylightMin)) return t('light.left', { daylight: formatSpan(l.daylightMin), good: formatSpan(l.goodMin) });
  return t('light.leftGood', { good: formatSpan(l.goodMin) });
}

/**
 * Trip-screen card under Weather & daylight. Hidden when the trip has no coordinates. The day chips cover the trip
 * (each day at its own stay or place, in that place's zone); it opens on today while the trip is on.
 */
export function PhotoLightCard({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const now = useMinute();
  const hour = Math.floor(now / 3_600_000);
  const stops = useMemo(() => weatherStops(trip, now), [trip, hour]); // eslint-disable-line react-hooks/exhaustive-deps
  const dates = useMemo(() => lightDates(trip), [trip]);
  const [picked, setPicked] = useState<LocalDate | null>(null);
  const date = picked && dates.includes(picked) ? picked : defaultLightDate(trip, now);
  const ld = useMemo(() => (stops.length ? lightDayFor(trip, date, now, stops) : null), [trip, date, stops, hour]); // eslint-disable-line react-hooks/exhaustive-deps
  // T142: the day's windows joined across midnight (a golden / blue hour from 23:41 to 00:37 shows whole).
  const joined = useMemo(() => (ld ? dayWindows(ld.day) : []), [ld]);
  if (!ld) return null;
  const d = ld.day;
  const isToday = daysAway(d, now) === 0;
  const todayHere = localDate(fromUtc(now, d.tz));
  const dayLabel = isToday ? t('light.today') : formatDay(d.date, lang);
  const s = d.sun;
  const next = isToday ? nextText(t, d, now, lang) : null;
  const left = isToday ? leftText(t, d, now) : null;
  const note = noteText(t, d);

  return (
    <FadeInView>
      <SectionCard title={t('light.title')} subtitle={t('light.subtitle', { place: ld.place.name })} icon="sunny-outline" tone="accent">
        {dates.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t('light.days')} contentContainerStyle={{ gap: space.s }}>
            {dates.map((x) => (
              <Chip key={x} label={x === todayHere ? t('light.today') : formatDay(x, lang)} selected={x === date} onPress={() => setPicked(x)} />
            ))}
          </ScrollView>
        ) : null}
        <SunArc day={d} now={now} showNow={isToday} label={arcLabel(t, d, now, dayLabel, isToday)} />
        {s.polar ? (
          <Text style={[typeScale.small, { color: theme.muted }]}>{t(s.polar === 'day' ? 'light.polarDay' : 'light.polarNight')}</Text>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{t('light.sunrise', { time: hm(s.sunrise ?? '') })}</Text>
            <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{t('light.sunset', { time: hm(s.sunset ?? '') })}</Text>
          </View>
        )}
        {joined.map((w, i) => (
          <WindowRow key={`${w.kind}-${w.startUtc}`} w={w} first={i === 0} />
        ))}
        {note ? <Text style={[typeScale.small, { color: theme.ink }]}>{note}</Text> : null}
        {next || left ? (
          <View accessible accessibilityLiveRegion="polite" style={{ gap: 2, backgroundColor: theme.accentSoft, borderRadius: radius.m, padding: space.m }}>
            {next ? <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{next}</Text> : null}
            {left ? <Text style={[typeScale.small, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{left}</Text> : null}
          </View>
        ) : null}
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('light.footnote', { place: ld.place.name })}</Text>
      </SectionCard>
    </FadeInView>
  );
}

// ------------------------------------------------------------------ Your day row

/** "Golden hour 17:42–18:21 · At Kyoto inn" on the Your day card; a tap opens the trip at today. */
export function PhotoLightBriefRow({ trip, today, now }: { trip: Trip; today: LocalDate; now: number }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const b = useMemo(() => briefLight(trip, today, now), [trip, today, now]);
  if (!b) return null;
  const line = b.state === 'now' ? t('light.brief.now', { to: rangeEnd(b.window) }) : t('light.brief.next', { from: hm(b.window.start), to: rangeEnd(b.window) });
  const place = t('light.brief.place', { place: b.place.name });
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${line}. ${place}`}
        accessibilityHint={t('light.brief.hint', { trip: trip.name })}
        onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id, day: today } })}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sunny-outline" size={18} color={theme.heroAccent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[typeScale.bodyStrong, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>
            {line}
          </Text>
          <Text numberOfLines={2} style={[typeScale.small, { color: theme.heroMuted }]}>
            {place}
          </Text>
        </View>
      </PressableScale>
    </>
  );
}

/** End of a golden window as a clock ("24:00" style never shows: a white-night spell reads to its midnight end). */
const rangeEnd = (w: LightWindow) => hm(w.end);

// ------------------------------------------------------------------ saved place / idea line

/**
 * "Photo light · Today: golden 06:10–06:52, 17:42–18:21 · blue 05:52–06:03, 18:21–18:38" for a spot on a trip, on
 * `date` (an idea's planned day) or today / the trip's first day. Nothing for an unreadable spot.
 */
export function SpotLightLine({ trip, at, date }: { trip: Trip; at: LatLon | null; date?: LocalDate | null }) {
  const { t, theme, lang } = useApp();
  const now = useMinute();
  const hour = Math.floor(now / 3_600_000);
  const lat = at?.lat;
  const lon = at?.lon;
  const d = useMemo(() => (typeof lat === 'number' && typeof lon === 'number' ? spotLight(trip, { lat, lon }, date ?? null, now) : null), [trip, lat, lon, date, hour]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const line = spotLine(t, d, now, lang);
  return (
    <View accessible accessibilityLabel={`${t('light.spot.title')}. ${line}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs }}>
      <Ionicons name="sunny-outline" size={16} color={theme.accentInk} style={{ marginTop: 2 }} />
      <Text style={[typeScale.small, { color: theme.ink, flex: 1, fontVariant: ['tabular-nums'] }]}>
        <Text style={{ color: theme.accentInk }}>{`${t('light.spot.title')} · `}</Text>
        {line}
      </Text>
    </View>
  );
}
