// T140 rainy-day plan B: the Plan B card on a trip day, the Your day "Rain from 14:00: plan B for <activity>" row, the
// indoor / outdoor chips (idea form, booking screen) and the hook that reads the forecasts already cached on the phone
// (src/native/weather.ts cachedForecast; nothing is fetched here, so it works offline and says how old it is).
// T142: a flag can be dismissed (kept per trip on this phone only, RAIN_DISMISSED_KEY, never in the trip or its
// .satchel file) with "Show n dismissed" under the day's cards; saved places carry their own mark (PlaceSettingSlot on
// the Map tab card, "It's indoors" on their Plan B card); indoor ideas with no map spot found by city name say so.
// Logic in src/core/rainplan.ts. Motion is the timed FadeInView only (static with Reduce Motion); colours from tokens.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, Text, View } from 'react-native';
import { formatDay } from '../core/format.ts';
import type { Item, LocalDate, Trip } from '../core/model.ts';
import { PLAN_SETTINGS, type PlanMark, type PlanSetting } from '../core/plansetting.ts';
import { distanceParts } from '../core/poi.ts';
import {
  applyUndo,
  briefRain,
  dismissRain,
  itemMark,
  movePlan,
  NO_RAIN_DISMISSALS,
  placeMark,
  rainByDay,
  rainDismissedFor,
  RAIN_DISMISSED_KEY,
  rainFlagId,
  restoreRain,
  setIdeaSetting,
  setItemSetting,
  setPlaceSetting,
  swapToIdea,
  withoutDismissed,
  type ForecastAge,
  type RainDismissals,
  type RainFlag,
  type RainSource,
  type RainUndo,
} from '../core/rainplan.ts';
import { savedPlaces } from '../core/places.ts';
import { formatMm, weatherStops, type WeatherGroup } from '../core/weather.ts';
import { fromUtc, localTime } from '../core/tz.ts';
import type { T } from '../i18n/core.ts';
import { cachedForecast } from '../native/weather.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { useTrips } from '../state/trips.tsx';
import { fonts, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { FadeInView } from './hero.tsx';
import { Body, Card, Label, PressableScale } from './kit.tsx';
import { IconChips } from './journal.tsx';
import { useMinute } from './TripPass.tsx';

/** Re-read the cache this often while a screen shows (the weather card may have fetched a newer forecast). */
const REREAD_MS = 5 * 60_000;

/** The trip's stops with whatever forecast is cached for each (null where nothing is). */
export function useRainSources(trip: Trip | null): RainSource[] {
  const [sources, setSources] = useState<RainSource[]>([]);
  const [tick, setTick] = useState(0);
  const stops = useMemo(() => (trip ? weatherStops(trip, Date.now()) : []), [trip]);
  const key = stops.map((s) => `${s.key}:${s.fromDate}:${s.toDate}`).join('|');
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), REREAD_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let live = true;
    if (!stops.length) {
      setSources([]);
      return;
    }
    void Promise.all(
      stops.map(async (s) => {
        const r = await cachedForecast(s).catch(() => null);
        return { ...s, forecast: r?.forecast ?? null, fromCache: true } satisfies RainSource;
      }),
    ).then((rows) => live && setSources(rows));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  return sources;
}

/** The last change made from a Plan B card, kept above the day cards so its Undo survives the plan moving away. */
export type RainLast = { day: LocalDate; text: string; undo: RainUndo };
export type TripRain = {
  byDay: Map<LocalDate, RainFlag[]>;
  last: RainLast | null;
  setLast: (l: RainLast | null) => void;
  /** T142: flag ids dismissed for this trip on this phone. */
  dismissed: string[];
  dismiss: (flagId: string) => void;
  restore: (day: LocalDate) => void;
};

/** T142: [dismissed flag ids for this trip, dismiss one, show a day's again]; kept on this phone only. */
export function useRainDismissals(tripId: string | null): [string[], (id: string) => void, (day: LocalDate) => void] {
  const [store, setStore] = usePersisted<RainDismissals>(RAIN_DISMISSED_KEY, NO_RAIN_DISMISSALS);
  const ids = useMemo(() => (tripId ? rainDismissedFor(store, tripId) : []), [store, tripId]);
  const dismiss = useCallback((id: string) => tripId && setStore((old) => dismissRain(old, tripId, id)), [setStore, tripId]);
  const restore = useCallback((day: LocalDate) => tripId && setStore((old) => restoreRain(old, tripId, day)), [setStore, tripId]);
  return [ids, dismiss, restore];
}

/** Trip screen: flags per day (re-checked every minute), the last change's undo and this phone's dismissals. */
export function useTripRain(trip: Trip | null, days: readonly LocalDate[]): TripRain {
  const sources = useRainSources(trip);
  const now = useMinute();
  const [last, setLast] = useState<RainLast | null>(null);
  const [dismissed, dismiss, restore] = useRainDismissals(trip?.id ?? null);
  const byDay = useMemo(() => (trip ? rainByDay(trip, days, sources, now) : new Map<LocalDate, RainFlag[]>()), [trip, days, sources, now]);
  return useMemo(() => ({ byDay, last, setLast, dismissed, dismiss, restore }), [byDay, last, dismissed, dismiss, restore]);
}

const weatherWord = (t: T, g: WeatherGroup | null) => t(g === 'sleet' || g === 'snow' || g === 'thunder' ? `rain.w.${g}` : 'rain.w.rain');

export function ageText(t: T, a: ForecastAge): string {
  if (a.unit === 'now') return t('rain.age.now');
  return t(a.unit === 'min' ? 'rain.age.min' : a.unit === 'h' ? 'rain.age.h' : 'rain.age.d', { n: a.n });
}

const GROUP_GLYPH: Record<'rain' | 'sleet' | 'snow' | 'thunder', 'rainy-outline' | 'snow-outline' | 'thunderstorm-outline'> = {
  rain: 'rainy-outline',
  sleet: 'rainy-outline',
  snow: 'snow-outline',
  thunder: 'thunderstorm-outline',
};
const glyph = (g: WeatherGroup | null) => GROUP_GLYPH[g === 'sleet' || g === 'snow' || g === 'thunder' ? g : 'rain'];

/** A small outlined action pill (48 pt high). */
function Pill({ label, a11y, hint, onPress, icon }: { label: string; a11y?: string; hint: string; onPress: () => void; icon?: 'swap-horizontal' | 'calendar-outline' | 'home-outline' | 'arrow-undo-outline' | 'eye-off-outline' }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityHint={hint}
      onPress={onPress}
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, paddingHorizontal: space.l, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.sea, backgroundColor: theme.card }}
    >
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={icon} size={16} color={theme.sea} />
        </View>
      ) : null}
      <Text style={[typeScale.small, { color: theme.ink, fontFamily: fonts.bodyBold, flexShrink: 1 }]}>{label}</Text>
    </PressableScale>
  );
}

/** Saves a change and keeps its undo (announced for VoiceOver). */
function useRainSave() {
  const { t } = useApp();
  const { saveTrip } = useTrips();
  return useCallback(
    async (next: Trip, said: string): Promise<boolean> => {
      if (!(await saveTrip(next))) {
        Alert.alert(t('rain.saveFailed.title'), t('rain.saveFailed.body'));
        return false;
      }
      AccessibilityInfo.announceForAccessibility(said);
      return true;
    },
    [saveTrip, t],
  );
}

/** One flagged plan: when the wet weather comes, how old the forecast is, indoor ideas nearby and the driest day. */
function PlanBCard({ trip, flag, onChange, onDismiss }: { trip: Trip; flag: RainFlag; onChange: (l: RainLast) => void; onDismiss: () => void }) {
  const { t, theme, lang } = useApp();
  const save = useRainSave();
  const p = flag.plan;
  const weather = weatherWord(t, flag.group);
  const when = flag.fromStart ? t('rain.card.during', { weather }) : t('rain.card.from', { weather, time: flag.wetLocal });
  const clock = (ms: number) => localTime(fromUtc(ms, p.tz));
  const hours = p.allDay ? t('rain.card.allDay', { start: clock(p.from), end: clock(p.to) }) : t('rain.card.hours', { start: clock(p.from), end: clock(p.to) });
  const age = ageText(t, flag.age);
  const dayText = formatDay(p.day, lang);
  const distance = (m: number) => {
    const d = distanceParts(m);
    return `${d.n} ${t(d.unit === 'm' ? 'map.unit.m' : 'map.unit.km')}`;
  };

  const swap = async (ideaId: string, name: string) => {
    const c = swapToIdea(trip, ideaId, p.day);
    if (!c) return;
    const text = t('rain.swap.done', { name, day: dayText });
    if (await save(c.trip, text)) onChange({ day: p.day, text, undo: c.undo });
  };
  const move = async () => {
    if (!flag.move) return;
    const c = movePlan(trip, p, flag.move.date);
    if (!c) return;
    const text = t('rain.move.done', { name: p.name, day: formatDay(flag.move.date, lang) });
    if (await save(c.trip, text)) onChange({ day: p.day, text, undo: c.undo });
  };
  const markIndoor = async () => {
    const next = p.kind === 'item' ? setItemSetting(trip, p.id, 'indoor') : p.kind === 'idea' ? setIdeaSetting(trip, p.id, 'indoor') : setPlaceSetting(trip, p.id, 'indoor');
    if (next !== trip) await save(next, t('rain.marked', { name: p.name }));
  };

  return (
    <FadeInView>
      <View style={{ marginTop: space.s, borderRadius: radius.m, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.sea, backgroundColor: theme.seaSoft, padding: space.m, gap: space.s }}>
        <View accessible accessibilityLabel={t('rain.card.a11y', { name: p.name, when, hours, age })} style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={glyph(flag.group)} size={20} color={theme.sea} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.caption, { color: theme.muted }]}>{t('rain.card.eyebrow')}</Text>
              <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('rain.card.title', { name: p.name })}</Text>
            </View>
          </View>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{when}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{hours}</Text>
          {flag.mm > 0 ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('rain.card.amount', { mm: formatMm(flag.mm), h: flag.wetHours })}</Text> : null}
          <Text style={[typeScale.small, { color: theme.muted }]}>{[age, t('rain.credit')].join(' · ')}</Text>
        </View>
        {flag.freshness === 'stale' ? <Text style={[typeScale.small, { color: theme.warn }]}>{t('rain.stale')}</Text> : null}
        {p.mark.guessed ? (
          <View style={{ gap: space.xs }}>
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('rain.guessed')}</Text>
            <Pill label={t('rain.markIndoor')} hint={t('rain.markIndoorHint', { name: p.name })} icon="home-outline" onPress={markIndoor} />
          </View>
        ) : null}

        <Label>{t('rain.swaps.title')}</Label>
        {flag.swaps.length ? (
          flag.swaps.map((s) => (
            <View key={s.ideaId} style={{ gap: 2 }}>
              <Pill label={t('rain.swap.do', { name: s.name })} hint={t('rain.swap.hint', { name: s.name, day: dayText })} icon="swap-horizontal" onPress={() => swap(s.ideaId, s.name)} />
              {s.m !== null ? (
                <Text style={[typeScale.small, { color: theme.muted }]}>{t(s.guessed ? 'rain.swap.guessed' : 'rain.swap.away', { distance: distance(s.m) })}</Text>
              ) : s.city ? (
                <Text style={[typeScale.small, { color: theme.muted }]}>{t(s.guessed ? 'f105.rain.swap.byCityGuessed' : 'f105.rain.swap.byCity', { city: s.city })}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Body muted>{t('rain.swaps.none')}</Body>
        )}

        <Label>{t('rain.move.title')}</Label>
        {flag.move ? (
          <View style={{ gap: 2 }}>
            <Pill
              label={t('rain.move.label', { day: formatDay(flag.move.date, lang) })}
              hint={t('rain.move.hint', { name: p.name, day: formatDay(flag.move.date, lang) })}
              icon="calendar-outline"
              onPress={move}
            />
            <Text style={[typeScale.small, { color: theme.muted }]}>{flag.move.dry ? t('rain.move.dry') : t('rain.move.drier', { mm: formatMm(flag.move.mm) })}</Text>
            {flag.move.clock !== 'normal' ? <Text style={[typeScale.small, { color: theme.warn }]}>{t('rain.move.clock')}</Text> : null}
          </View>
        ) : (
          <Body muted>{t('rain.move.none')}</Body>
        )}
        <Pill label={t('f105.rain.dismiss')} a11y={t('f105.rain.dismissA11y', { name: p.name })} hint={t('f105.rain.dismissHint')} icon="eye-off-outline" onPress={onDismiss} />
      </View>
    </FadeInView>
  );
}

/** Trip day: a Plan B card per flagged outdoor plan, and the Undo for the last change made on this day. */
export function RainDayCard({ trip, day, rain }: { trip: Trip; day: LocalDate; rain: TripRain }) {
  const { t, theme } = useApp();
  const save = useRainSave();
  const { flags, dismissed } = useMemo(() => withoutDismissed(rain.byDay.get(day) ?? [], rain.dismissed), [rain.byDay, rain.dismissed, day]);
  const last = rain.last?.day === day ? rain.last : null;
  if (!flags.length && !last && !dismissed) return null;
  const dismissOne = (f: RainFlag) => {
    rain.dismiss(rainFlagId(f));
    AccessibilityInfo.announceForAccessibility(t('f105.rain.dismissed', { name: f.plan.name }));
  };
  const restore = () => {
    rain.restore(day);
    AccessibilityInfo.announceForAccessibility(t('f105.rain.restored'));
  };
  const restoreLabel = dismissed === 1 ? t('f105.rain.restoreOne') : t('f105.rain.restoreMany', { n: dismissed });
  const undo = async () => {
    if (!last) return;
    if (await save(applyUndo(trip, last.undo), t('rain.undone'))) rain.setLast(null);
  };
  return (
    <View>
      {flags.map((f) => (
        <PlanBCard key={f.plan.key} trip={trip} flag={f} onChange={rain.setLast} onDismiss={() => dismissOne(f)} />
      ))}
      {dismissed ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={restoreLabel}
          accessibilityHint={t('f105.rain.restoreHint')}
          onPress={restore}
          style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.s, alignSelf: 'flex-start' }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="eye-outline" size={16} color={theme.muted} />
          </View>
          <Text style={[typeScale.small, { color: theme.muted }]}>{restoreLabel}</Text>
        </PressableScale>
      ) : null}
      {last ? (
        <FadeInView>
          <View accessibilityLiveRegion="polite" style={{ marginTop: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s, borderRadius: radius.m, backgroundColor: theme.okSoft, padding: space.s }}>
            <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{last.text}</Text>
            <Pill label={t('rain.undo')} a11y={t('rain.undoA11y', { text: last.text })} hint={t('rain.undoHint')} icon="arrow-undo-outline" onPress={undo} />
          </View>
        </FadeInView>
      ) : null}
    </View>
  );
}

/** Your day: "Rain from 14:00: plan B for Park picnic" (+ how many more) while today has a flagged outdoor plan. */
export function RainBriefRow({ trip, today, now }: { trip: Trip; today: LocalDate; now: number }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const sources = useRainSources(trip);
  const [dismissed] = useRainDismissals(trip.id);
  const b = useMemo(() => briefRain(trip, today, sources, now, dismissed), [trip, today, sources, now, dismissed]);
  if (!b) return null;
  const weather = weatherWord(t, b.flag.group);
  const line = b.flag.fromStart ? t('rain.brief.during', { weather, name: b.flag.plan.name }) : t('rain.brief.from', { weather, time: b.flag.wetLocal, name: b.flag.plan.name });
  const more = b.more === 0 ? '' : b.more === 1 ? t('rain.brief.moreOne') : t('rain.brief.more', { n: b.more });
  const age = ageText(t, b.flag.age);
  return (
    <>
      <View style={{ marginHorizontal: space.l, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: theme.heroMuted, opacity: 0.6 }} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[line, more, age].filter(Boolean).join('. ')}
        accessibilityHint={t('rain.brief.hint', { trip: trip.name })}
        onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id, day: today } })}
        style={{ paddingHorizontal: space.l, paddingVertical: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={glyph(b.flag.group)} size={18} color={theme.heroAccent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: theme.heroInk }]}>
            {line}
          </Text>
          <Text numberOfLines={1} style={[typeScale.small, { color: theme.heroMuted }]}>
            {[more, age].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </PressableScale>
    </>
  );
}

const SETTING_ICON: Record<PlanSetting, 'home-outline' | 'sunny-outline'> = { indoor: 'home-outline', outdoor: 'sunny-outline' };

/** Indoors / Outdoors chips (tap the selected one again to clear) with what Satchel reads from the name meanwhile. */
export function PlanSettingChips({ value, guess, onChange }: { value: PlanSetting | undefined; guess: PlanMark; onChange: (v: PlanSetting | undefined) => void }) {
  const { t } = useApp();
  const name = (v: PlanSetting) => t(v === 'indoor' ? 'rain.setting.indoor' : 'rain.setting.outdoor');
  const note = value ? t('rain.setting.note') : guess.setting === 'indoor' ? t('rain.setting.guessIndoor') : guess.setting === 'outdoor' ? t('rain.setting.guessOutdoor') : t('rain.setting.guessNone');
  return (
    <View style={{ gap: space.s }}>
      <Label>{t('rain.setting.label')}</Label>
      <IconChips
        group={t('rain.setting.label')}
        values={PLAN_SETTINGS}
        selected={value}
        icon={(v) => SETTING_ICON[v]}
        label={name}
        a11yLabel={name}
        a11yHint={(v, on) => (on ? t('rain.setting.hintOn') : t('rain.setting.hint', { value: name(v) }))}
        onChange={onChange}
      />
      <Body muted>{note}</Body>
    </View>
  );
}

/** Booking screen: the indoor / outdoor mark of an activity (saved at once). */
export function ItemSettingSlot({ item }: { item: Item }) {
  const { saveItem } = useTrips();
  const { t } = useApp();
  if (item.kind !== 'activity') return null;
  const guess = itemMark({ title: item.title, place: item.place });
  const set = async (v: PlanSetting | undefined) => {
    const { setting: _s, ...rest } = item;
    if (!(await saveItem(v ? { ...rest, setting: v } : rest))) Alert.alert(t('rain.saveFailed.title'), t('rain.saveFailed.body'));
  };
  return (
    <Card>
      <PlanSettingChips value={item.setting} guess={guess} onChange={set} />
    </Card>
  );
}

/** T142: Map tab, a saved place's indoor / outdoor mark (saved on its trip at once). */
export function PlaceSettingSlot({ trip, placeId }: { trip: Trip; placeId: string }) {
  const { saveTrip } = useTrips();
  const { t } = useApp();
  const place = savedPlaces(trip).find((p) => p.id === placeId);
  if (!place) return null;
  const guess = placeMark({ name: place.name });
  const set = async (v: PlanSetting | undefined) => {
    if (!(await saveTrip(setPlaceSetting(trip, placeId, v ?? null)))) Alert.alert(t('rain.saveFailed.title'), t('rain.saveFailed.body'));
  };
  return <PlanSettingChips value={place.setting} guess={guess} onChange={set} />;
}
