// T75 smart packing UI pieces for app/packing/[tripId].tsx: the hero card with a progress ring (packed X of Y,
// nights, laundry), the opt-in suggestions card (Add / Dismiss; never added on its own), the data hook that reads
// the cached forecast (no network here) and the home country, and the share-as-text action. Tokens only, light +
// dark, 48 pt targets, a label on every control; motion is FadeInView only (timed, off with Reduce Motion).
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import essentialsTable from '../content/country_essentials.json';
import { findEssentials, type EssentialsTable } from '../core/essentials.ts';
import type { Trip } from '../core/model.ts';
import type { PackItem, PackList } from '../core/packing.ts';
import { packingTextByBag } from '../core/followups94.ts';
import { homeCountryFor, type SmartInput, type Suggestion } from '../core/smartpack.ts';
import { dailySummary, formatTemp, weatherPlace, type TempUnit, type WeatherDay } from '../core/weather.ts';
import type { T } from '../i18n/core.ts';
import { haptic } from '../native/device.ts';
import { shareText } from '../native/share.ts';
import { cachedForecast } from '../native/weather.ts';
import { useApp } from '../state/app.tsx';
import { bagName } from './bags.tsx';
import { radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { FadeInView, GradientFill, IconBadge, SectionCard, toneColours, type IconName } from './hero.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';
import { useMinute } from './JetLagCard.tsx';
import { Button, PressableScale } from './kit.tsx';

const TABLE = essentialsTable as EssentialsTable;

// ---------------------------------------------------------------- data

export type SmartData = { input: SmartInput; homeGuessed: string | null; hasForecast: boolean };

/**
 * Everything the suggestion rules read: the trip, the cached forecast for its current or next destination (read
 * from the phone's cache only; the trip screen's weather card is what fetches it), the place for daylight, and the
 * home country (Settings, else the trip's home zone, which the card then says).
 */
export function useSmartData(trip: Trip): SmartData {
  const now = useMinute();
  const hour = Math.floor(now / 3_600_000);
  const place = useMemo(() => weatherPlace(trip, now), [trip, hour]); // eslint-disable-line react-hooks/exhaustive-deps
  const [forecast, setForecast] = useState<{ days: WeatherDay[]; asOf: number } | null>(null);
  const key = place ? `${place.lat},${place.lon},${place.tz}` : '';
  useEffect(() => {
    setForecast(null);
    if (!place) return;
    let alive = true;
    cachedForecast({ lat: place.lat, lon: place.lon })
      .then((r) => {
        if (alive && r) setForecast({ days: dailySummary(r.forecast, place.tz), asOf: r.forecast.asOf });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const { homeIso } = useHomeCountry();
  const home = homeCountryFor(TABLE, homeIso, trip);
  const homeGuessed = !homeIso && home ? (findEssentials(TABLE, home)?.country ?? null) : null;
  const input = useMemo<SmartInput>(
    () => ({ trip, now, forecast, place: place ? { lat: place.lat, lon: place.lon, tz: place.tz } : null, essentials: { table: TABLE, home } }),
    // Re-run on the hour, not every minute: nothing in the rules changes faster.
    [trip, hour, forecast, place, home], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return { input, homeGuessed, hasForecast: forecast !== null };
}

// ---------------------------------------------------------------- wording

const ITEM_KEY = {
  umbrella: 'smartpack.item.umbrella',
  rain_jacket: 'smartpack.item.rain_jacket',
  warm_layer: 'smartpack.item.warm_layer',
  gloves_hat: 'smartpack.item.gloves_hat',
  sun_hat: 'smartpack.item.sun_hat',
  sunscreen: 'smartpack.item.sunscreen',
  eye_mask: 'smartpack.item.eye_mask',
} as const;

const ICON: Record<Suggestion['kind'], IconName> = {
  umbrella: 'umbrella-outline',
  rain_jacket: 'rainy-outline',
  warm_layer: 'snow-outline',
  gloves_hat: 'snow-outline',
  sun_hat: 'sunny-outline',
  sunscreen: 'sunny-outline',
  eye_mask: 'moon-outline',
  plug_adapter: 'flash-outline',
};

/** The row label a suggestion becomes when added ("Plug adapter: type G"). */
export function suggestionLabel(t: T, s: Suggestion): string {
  if (s.kind === 'plug_adapter') {
    const plugs = (s.plugs ?? []).join(', ');
    return t((s.plugs ?? []).length > 1 ? 'smartpack.item.plugMany' : 'smartpack.item.plugOne', { plugs });
  }
  return t(ITEM_KEY[s.kind]);
}

/** Why it is suggested, always starting "Suggested:". Temperatures in the traveller's unit. */
export function suggestionReason(t: T, s: Suggestion, unit: TempUnit): string {
  const r = s.reason;
  switch (r.kind) {
    case 'forecast_rain':
      return r.days === 1 ? t('smartpack.why.rainOne') : t('smartpack.why.rain', { count: r.days });
    case 'forecast_cold':
      return t('smartpack.why.cold', { temp: formatTemp(r.lowC, unit) });
    case 'forecast_hot':
      return t('smartpack.why.hot', { temp: formatTemp(r.highC, unit) });
    case 'season_cold':
      return t('smartpack.why.seasonCold');
    case 'season_tropics':
      return t('smartpack.why.tropics');
    case 'daylight_long':
      return t('smartpack.why.daylight');
    case 'plugs': {
      const main = t(r.some ? 'smartpack.why.plugsSome' : 'smartpack.why.plugs', { countries: r.countries.join(', '), plugs: r.plugs.join(', ') });
      return [main, r.voltageDiffers ? t('smartpack.why.voltage') : '', t('smartpack.why.verify')].filter(Boolean).join(' ');
    }
  }
}

export function nightsText(t: T, nights: number): string {
  if (nights <= 0) return t('smartpack.hero.dayTrip');
  return nights === 1 ? t('smartpack.hero.nightsOne') : t('smartpack.hero.nights', { n: nights });
}

// ---------------------------------------------------------------- hero

const RING = 96;
const STROKE = 9;

/** Progress ring: a track and an arc from 12 o'clock. Drawn, not animated. Hidden from screen readers (the card speaks). */
const ProgressRing = memo(function ProgressRing({ done, total }: { done: number; total: number }) {
  const { theme, t } = useApp();
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const p = total ? Math.min(1, done / total) : 0;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={theme.heroWash} strokeWidth={STROKE} fill="none" />
        {p > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={theme.heroAccent}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={[c, c]}
            strokeDashoffset={c * (1 - p)}
            rotation={-90}
            originX={RING / 2}
            originY={RING / 2}
          />
        ) : null}
      </Svg>
      <Text style={[typeScale.title, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>{t('smartpack.hero.ringCount', { done, total })}</Text>
      <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{t('smartpack.hero.ringLabel')}</Text>
    </View>
  );
});

/** The richer header card: trip name, nights (and laundry), the ring and what is left. */
export function PackHero({ tripName, done, total, nights, laundry }: { tripName: string; done: number; total: number; nights: number; laundry: boolean }) {
  const { t, theme } = useApp();
  const left = total - done;
  const status = total === 0 ? t('smartpack.hero.empty') : left === 0 ? t('smartpack.hero.allPacked') : left === 1 ? t('smartpack.hero.leftOne') : t('smartpack.hero.left', { count: left });
  const meta = [nightsText(t, nights), laundry ? t('smartpack.hero.laundry') : ''].filter(Boolean).join(' · ');
  return (
    <FadeInView>
      <View style={{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: theme.hero.trips[0] }}>
        <GradientFill tone="trips" />
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={[tripName, t('smartpack.hero.ringA11y', { done, total }), status, meta].join('. ')}
          accessibilityValue={{ min: 0, max: Math.max(total, 1), now: done }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l }}
        >
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{t('smartpack.hero.eyebrow')}</Text>
            <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.heroInk }]}>
              {tripName}
            </Text>
            <Text style={[typeScale.small, { color: theme.heroMuted }]}>{meta}</Text>
            <Text style={[typeScale.bodyStrong, { color: theme.heroInk }]}>{status}</Text>
          </View>
          <ProgressRing done={done} total={total} />
        </View>
      </View>
    </FadeInView>
  );
}

// ---------------------------------------------------------------- suggestions

const SuggestionRow = memo(function SuggestionRow({ s, label, reason, onAdd, onDismiss, first }: { s: Suggestion; label: string; reason: string; onAdd: () => void; onDismiss: () => void; first: boolean }) {
  const { t, theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: first ? 0 : space.m, borderTopWidth: first ? 0 : 1, borderTopColor: theme.line }}>
      <IconBadge name={ICON[s.kind]} tone={s.kind === 'plug_adapter' ? 'accent' : 'sea'} size="s" />
      <View accessible accessibilityLabel={t('smartpack.suggest.rowA11y', { label, reason })} style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{label}</Text>
        <Text style={[typeScale.small, { color: theme.muted }]}>{reason}</Text>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('smartpack.suggest.addA11y', { label })}
        accessibilityHint={t('smartpack.suggest.addHint')}
        onPress={onAdd}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.m, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
      >
        <Ionicons name="add" size={18} color={theme.sea} />
        <Text style={[typeScale.bodyStrong, { color: theme.sea }]}>{t('smartpack.suggest.add')}</Text>
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('smartpack.suggest.dismissA11y', { label })}
        accessibilityHint={t('smartpack.suggest.dismissHint')}
        onPress={onDismiss}
        style={{ width: TOUCH, alignItems: 'center' }}
      >
        <Ionicons name="close" size={20} color={theme.muted} />
      </PressableScale>
    </View>
  );
});

/** Opt-in suggestions. Nothing renders when there is nothing to suggest and nothing was dismissed. */
export function SuggestionsCard({
  open,
  unit,
  dismissedCount,
  homeGuessed,
  fromForecast,
  onAdd,
  onDismiss,
  onRestore,
}: {
  open: Suggestion[];
  unit: TempUnit;
  dismissedCount: number;
  homeGuessed: string | null;
  fromForecast: boolean;
  onAdd: (s: Suggestion, label: string) => void;
  onDismiss: (s: Suggestion) => void;
  onRestore: () => void;
}) {
  const { t, theme } = useApp();
  if (!open.length && !dismissedCount) return null;
  const hasPlug = open.some((s) => s.kind === 'plug_adapter');
  return (
    <FadeInView>
      <SectionCard title={t('smartpack.suggest.title')} subtitle={t('smartpack.suggest.subtitle')} icon="bulb-outline" tone="teal">
        {open.map((s, i) => {
          const label = suggestionLabel(t, s);
          return <SuggestionRow key={s.id} s={s} label={label} reason={suggestionReason(t, s, unit)} first={i === 0} onAdd={() => onAdd(s, label)} onDismiss={() => onDismiss(s)} />;
        })}
        {hasPlug && homeGuessed ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('smartpack.suggest.homeGuess', { country: homeGuessed })}</Text> : null}
        {fromForecast && open.some((s) => s.reason.kind.startsWith('forecast')) ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('smartpack.suggest.forecastCredit')}</Text> : null}
        {dismissedCount ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={t('smartpack.suggest.restore', { count: dismissedCount })} accessibilityHint={t('smartpack.suggest.restoreHint')} onPress={onRestore}>
            <Text style={[typeScale.bodyStrong, { color: toneColours(theme, 'teal').fg }]}>{t('smartpack.suggest.restore', { count: dismissedCount })}</Text>
          </PressableScale>
        ) : null}
      </SectionCard>
    </FadeInView>
  );
}

// ---------------------------------------------------------------- share

/** "Share list": the list as plain text into the system share sheet (same path as Share plan), by bag when bags are in use. */
export function SharePackingList({ tripName, list, qtyOf, laundry, categoryName }: { tripName: string; list: PackList; qtyOf: (i: PackItem) => number | undefined; laundry: boolean; categoryName: (c: string) => string }) {
  const { t } = useApp();
  const [failed, setFailed] = useState(false);
  const send = async () => {
    // T100: grouped by bag once rows sit in bags, else by category.
    const text = packingTextByBag(
      list,
      {
        bag: (b) => bagName(t, b),
        noBag: t('f94.share.noBag'),
        title: t('packing.forTrip', { trip: tripName }),
        progress: (done, total) => t('smartpack.text.progress', { done, total }),
        category: categoryName,
        qty: (qty) => t('smartpack.text.qty', { qty }),
        note: laundry ? t('smartpack.hero.laundry') : undefined,
        empty: t('smartpack.text.empty'),
      },
      qtyOf,
    );
    const r = await shareText(text, t('smartpack.shareSubject', { trip: tripName }));
    if (r === 'failed') {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility(t('smartpack.shareFailed'));
      return;
    }
    setFailed(false);
    if (r === 'shared') haptic.success();
  };
  return (
    <View style={{ gap: space.s }}>
      <Button label={t('smartpack.share')} hint={t('smartpack.shareHint')} kind="secondary" icon="share-outline" onPress={send} />
      {failed ? <ErrorNotice title={t('smartpack.shareFailedTitle')} body={t('smartpack.shareFailed')} action={t('common.tryAgain')} actionHint={t('smartpack.shareHint')} onAction={send} /> : null}
    </View>
  );
}
