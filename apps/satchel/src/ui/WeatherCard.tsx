// T70 "Weather & daylight" on the trip screen, and the compact daylight line for the Map tab. Sunrise / sunset come
// from src/core/sun.ts and work offline; the forecast (src/native/weather.ts) loads in the background, shows from
// the cache offline ("Forecast from <time>") and is marked stale after 48 h. Nothing here waits on the network:
// the card draws at once with daylight and fills in the forecast when it arrives. Colours are theme tokens; motion
// is FadeInView only (timed, nothing moves with Reduce Motion).
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { formatDay, todayIn } from '../core/format.ts';
import type { LocalDate, Trip } from '../core/model.ts';
import { lightLeftMin, formatSpan, sunDay, type SunDay } from '../core/sun.ts';
import { addDays, fromUtc, localDate, localTime } from '../core/tz.ts';
import {
  dailySummary,
  dayOn,
  defaultStop,
  DEFAULT_TEMP_UNIT,
  forecastReaches,
  formatMm,
  formatTemp,
  freshness,
  normaliseTempUnit,
  stopDates,
  TEMP_UNIT_KEY,
  weatherPlace,
  weatherStops,
  type TempUnit,
  type WeatherDay,
  type WeatherGroup,
  type WeatherPlace,
} from '../core/weather.ts';
import type { T } from '../i18n/core.ts';
import { cachedForecast, loadForecast, type ForecastResult } from '../native/weather.ts';
import { useNetworkStatus } from '../native/network.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { validStop, WEATHER_STOP_KEY, weatherStopFor, withWeatherStop } from '../core/followups89.ts';
import { radius, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, SectionCard, type IconName } from './hero.tsx';
import { Chip } from './kit.tsx';
import { useMinute } from './JetLagCard.tsx';

export const GROUP_ICON: Record<WeatherGroup, IconName> = {
  clear: 'sunny-outline',
  partly: 'partly-sunny-outline',
  cloudy: 'cloud-outline',
  fog: 'cloudy-outline',
  rain: 'rainy-outline',
  sleet: 'rainy-outline',
  snow: 'snow-outline',
  thunder: 'thunderstorm-outline',
};

/** The saved °C / °F choice (Celsius until changed in Settings). */
export function useTempUnit(): [TempUnit, (u: TempUnit) => void] {
  const [stored, setStored] = usePersisted<TempUnit>(TEMP_UNIT_KEY, DEFAULT_TEMP_UNIT);
  return [normaliseTempUnit(stored), (u) => setStored(u)];
}

type Load = { s: 'loading' } | { s: 'none' } | { s: 'ready'; result: ForecastResult };

/** Cache first (instant), then a background refresh; again whenever the connection comes back. */
function useForecast(place: WeatherPlace | null, wanted: boolean): Load {
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const net = useNetworkStatus();
  const key = place ? `${place.lat},${place.lon}` : '';
  useEffect(() => {
    if (!place || !wanted) {
      setLoad({ s: 'none' });
      return;
    }
    let alive = true;
    const at = { lat: place.lat, lon: place.lon };
    cachedForecast(at)
      .then((c) => {
        if (alive && c) setLoad((old) => (old.s === 'ready' && old.result.live ? old : { s: 'ready', result: c }));
      })
      .catch(() => {});
    loadForecast(at)
      .then((r) => {
        if (!alive) return;
        if (r) setLoad({ s: 'ready', result: r });
        else setLoad((old) => (old.s === 'ready' ? old : { s: 'none' }));
      })
      .catch(() => alive && setLoad((old) => (old.s === 'ready' ? old : { s: 'none' })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, wanted, net === 'offline']);
  return load;
}

const stamp = (utc: number, tz: string, lang: string) => {
  const wall = fromUtc(utc, tz);
  return `${formatDay(localDate(wall), lang)} ${localTime(wall)}`;
};

function sunText(t: T, s: SunDay | null): string {
  if (!s) return '';
  if (s.polar === 'day') return t('weather.polarDay');
  if (s.polar === 'night') return t('weather.polarNight');
  return t('weather.sunTimes', { rise: localTime(s.sunrise ?? ''), set: localTime(s.sunset ?? '') });
}

function sunA11y(t: T, s: SunDay | null): string {
  if (!s) return '';
  if (s.polar) return sunText(t, s);
  return t('weather.sunA11y', { rise: localTime(s.sunrise ?? ''), set: localTime(s.sunset ?? '') });
}

const DayRow = memo(function DayRow({ date, today, sun, day, unit, first }: { date: LocalDate; today: LocalDate; sun: SunDay | null; day: WeatherDay | null; unit: TempUnit; first: boolean }) {
  const { t, theme, lang } = useApp();
  const label = date === today ? t('weather.today') : formatDay(date, lang);
  const sky = day ? t(day.group ? `weather.group.${day.group}` : 'weather.group.unknown') : '';
  const high = day ? formatTemp(day.high, unit) : '';
  const low = day ? formatTemp(day.low, unit) : '';
  const mm = day ? formatMm(day.precipMm) : '';
  const forecast = day ? t('weather.forecastA11y', { sky, high, low, mm }) : t('weather.notYet');
  return (
    <View
      accessible
      accessibilityLabel={t('weather.dayA11y', { day: label, weather: forecast, sun: sunA11y(t, sun) })}
      style={{ gap: 2, paddingTop: first ? 0 : space.s, borderTopWidth: first ? 0 : 1, borderTopColor: theme.line }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 28 }}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: theme.ink, flex: 1 }]}>
          {label}
        </Text>
        {day ? (
          <>
            {day.group ? <Ionicons name={GROUP_ICON[day.group]} size={22} color={theme.sea} /> : null}
            <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'], minWidth: 72, textAlign: 'right' }]}>{t('weather.highLow', { high, low })}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 64, justifyContent: 'flex-end' }}>
              <Ionicons name="water-outline" size={14} color={theme.muted} />
              <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{t('weather.rain', { mm })}</Text>
            </View>
          </>
        ) : (
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('weather.notYet')}</Text>
        )}
      </View>
      {sun ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{sunText(t, sun)}</Text> : null}
    </View>
  );
});

/**
 * Trip-screen card. Opens on the current or next destination; T76: with more than one stop, chips pick any stop of
 * the trip (each stop's forecast is cached on its own, by its coordinates). Nothing when the trip has no
 * coordinates or has ended. T80: the chosen stop is remembered per trip on this phone (a stop no longer in the trip
 * falls back to the default).
 */
const NO_STOPS: Record<string, string> = {};

export function WeatherCard({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const now = useMinute();
  const [unit] = useTempUnit();
  // Re-pick the stops only when the trip or the hour changes (a check-in moves the default).
  const hour = Math.floor(now / 3_600_000);
  const stops = useMemo(() => weatherStops(trip, now), [trip, hour]); // eslint-disable-line react-hooks/exhaustive-deps
  const fallback = useMemo(() => defaultStop(stops, trip, now), [stops, trip, hour]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rawStops, setRawStops] = usePersisted<unknown>(WEATHER_STOP_KEY, NO_STOPS);
  const picked = validStop(weatherStopFor(rawStops, trip.id), stops);
  const setPicked = (key: string) => setRawStops((old: unknown) => withWeatherStop(old, trip.id, key));
  const place = stops.find((s) => s.key === picked) ?? fallback;
  const today = place ? todayIn(place.tz, now) : '';
  const dates = useMemo(() => (place ? stopDates(trip, place, today) : []), [trip, place, today]);
  const wanted = !!place && dates.length > 0 && forecastReaches(dates, today);
  const load = useForecast(place, wanted);
  const days = useMemo(() => (load.s === 'ready' && place ? dailySummary(load.result.forecast, place.tz) : []), [load, place]);
  const suns = useMemo(() => (place ? dates.map((d) => sunDay(place.lat, place.lon, d, place.tz)) : []), [place, dates]);
  if (!place || (dates.length === 0 && picked === null)) return null;

  let status: { text: string; warn: boolean } | null = null;
  if (load.s === 'ready') {
    const r = load.result;
    const when = stamp(r.forecast.asOf, place.tz, lang);
    const f = freshness(r.forecast.asOf, now, !r.live);
    status = f === 'stale' ? { text: t('weather.stale', { time: when }), warn: true } : { text: t(f === 'fresh' ? 'weather.updated' : 'weather.cachedFrom', { time: when }), warn: false };
  } else if (load.s === 'loading' && wanted) {
    status = { text: t('weather.checking'), warn: false };
  } else if (wanted) {
    status = { text: t('weather.none'), warn: false };
  }
  const showForecast = load.s === 'ready';

  return (
    <FadeInView>
      <SectionCard title={t('weather.title')} subtitle={t('weather.subtitle', { place: place.name })} icon="partly-sunny-outline" tone="sea">
        {stops.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t('f88.weather.stops')} contentContainerStyle={{ gap: space.s }}>
            {stops.map((s) => (
              <Chip key={s.key} label={s.name} selected={s.key === place.key} onPress={() => setPicked(s.key)} />
            ))}
          </ScrollView>
        ) : null}
        {dates.length === 0 ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('f88.weather.stopPast')}</Text> : null}
        {dates.map((d, i) => (
          <DayRow key={d} date={d} today={today} sun={suns[i] ?? null} day={showForecast ? dayOn(days, d) : null} unit={unit} first={i === 0} />
        ))}
        {status ? (
          <View
            accessible
            accessibilityLiveRegion="polite"
            style={status.warn ? { backgroundColor: theme.warnSoft, borderRadius: radius.m, padding: space.m } : undefined}
          >
            <Text style={[typeScale.small, { color: status.warn ? theme.ink : theme.muted }]}>{status.text}</Text>
          </View>
        ) : null}
        {showForecast ? (
          <Text style={[typeScale.small, { color: theme.muted }]}>
            {[t(unit === 'f' ? 'weather.unitF' : 'weather.unitC'), t('weather.credit')].join(' · ')}
          </Text>
        ) : null}
      </SectionCard>
    </FadeInView>
  );
}

/** "Sunset 17:42 · 3 h 10 m of light left" (or the sunrise, or the polar wording) for a place, now. */
export function daylightLine(t: T, place: WeatherPlace, now: number): string | null {
  const today = todayIn(place.tz, now);
  const s = sunDay(place.lat, place.lon, today, place.tz);
  if (!s) return null;
  if (s.polar === 'day') return t('weather.line.polarDay');
  if (s.polar === 'night') return t('weather.line.polarNight');
  const left = lightLeftMin(s, now);
  if (left !== null && Number.isFinite(left)) return t('weather.line.left', { time: localTime(s.sunset ?? ''), left: formatSpan(left) });
  if (s.sunriseUtc !== null && now < s.sunriseUtc) return t('weather.line.beforeRise', { rise: localTime(s.sunrise ?? ''), set: localTime(s.sunset ?? '') });
  const next = sunDay(place.lat, place.lon, addDays(today, 1), place.tz);
  const rise = next?.sunrise ? localTime(next.sunrise) : '';
  return rise ? t('weather.line.afterSet', { time: localTime(s.sunset ?? ''), rise }) : null;
}

/** The Map tab's compact daylight line for a trip's current or next destination (nothing without coordinates). */
export function DaylightLine({ trip }: { trip: Trip | null }) {
  const { t, theme } = useApp();
  const now = useMinute();
  const hour = Math.floor(now / 3_600_000);
  const place = useMemo(() => (trip ? weatherPlace(trip, now) : null), [trip, hour]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!place) return null;
  const line = daylightLine(t, place, now);
  if (!line) return null;
  return (
    <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <Ionicons name="sunny-outline" size={14} color={theme.muted} />
      <Text numberOfLines={2} style={[typeScale.small, { color: theme.muted, flex: 1, fontVariant: ['tabular-nums'] }]}>
        {t('weather.line.place', { place: place.name, line })}
      </Text>
    </View>
  );
}
