// T105 Tipping and service guide + tip calculator (src/core/tipping.ts). Reached from the Wallet tab (quick action),
// the arrival card's money panel (?country=) and the expense form (?tripId=&category=&currency=).
// - Country: ?country=, else the country the trip's bookings put you in now, else the arriving one, else your home
//   country (Settings), else a searchable list (the shared country search, kept to countries in the guide).
// - Guide: restaurants, cafes / bars, taxis, hotel staff, guides and the service charge, with the checked date, a
//   re-check marker on less certain rows and "General guidance only - customs vary, check locally".
// - Calculator: bill in the trip-country currency (or home / the one passed), presets from the norm, custom %, the
//   "service already included" switch (tip zero), round-up to a local step, split between N people or the trip's
//   companions, home value only at a saved rate, and "Add to spending" (tip included, category from context).
// Free feature. Tokens only, timed motion only, 48 pt targets, every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, ScrollView, Text, View, type AccessibilityActionEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import emergencyTable from '../src/content/emergency_numbers.json';
import essentialsTable from '../src/content/country_essentials.json';
import { arrivingCountry, countryNameFrom, homeCountryFor } from '../src/core/arrival.ts';
import { parseTip } from '../src/core/convert.ts';
import { currencyForCountry } from '../src/core/countrycurrency.ts';
import { countryForZone, searchCountries, type EmergencyTable } from '../src/core/emergency.ts';
import type { EssentialsTable } from '../src/core/essentials.ts';
import { deviceZone, formatDay, todayIn } from '../src/core/format.ts';
import { focusTrip } from '../src/core/glance.ts';
import { zoneAt } from '../src/core/jetlag.ts';
import { newId, type Trip } from '../src/core/model.ts';
import { currencyDigits, defaultDay, formatMoney, isCurrency, parseAmount, readSpending, upsertExpense } from '../src/core/spending.ts';
import { ME, peopleOf } from '../src/core/together.ts';
import {
  calcTip,
  categoryFor,
  coveredOnly,
  defaultPreset,
  findTipping,
  MAX_SPLIT,
  MIN_SPLIT,
  parseNorm,
  pickTipCountry,
  presetsFor,
  roundStep,
  SERVICES,
  tipExpense,
  tipHome,
  type Norm,
  type TipMode,
  type TipRow,
  type TipService,
} from '../src/core/tipping.ts';
import type { Key } from '../src/i18n/en.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { radius, shadowOf, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, SectionCard } from '../src/ui/hero.tsx';
import { useHomeCountry } from '../src/ui/HomeCountryPicker.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, TextField, ToggleRow } from '../src/ui/kit.tsx';
import { usePeople } from '../src/ui/together.tsx';

const COUNTRIES = emergencyTable as unknown as EmergencyTable;
const TABLES = { essentials: essentialsTable as EssentialsTable, emergency: COUNTRIES };
const MAX_LIST = 30;

const SERVICE_KEYS: Record<TipService, Key> = {
  restaurant: 'tipping.service.restaurant',
  cafe: 'tipping.service.cafe',
  taxi: 'tipping.service.taxi',
  hotel: 'tipping.service.hotel',
  guide: 'tipping.service.guide',
};
const CHARGE_KEYS: Record<TipRow['service'], Key> = { usual: 'tipping.charge.usual', sometimes: 'tipping.charge.sometimes', rare: 'tipping.charge.rare' };
type Source = 'param' | 'stop' | 'home' | 'picked';
const SOURCE_KEYS: Record<Source, Key> = { param: 'tipping.countryFrom.param', stop: 'tipping.countryFrom.stop', home: 'tipping.countryFrom.home', picked: 'tipping.countryFrom.picked' };

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default function TippingScreen() {
  const params = useLocalSearchParams<{ tripId?: string; country?: string; category?: string; currency?: string; service?: string }>();
  const { t, theme } = useApp();
  const { trips } = useTrips();
  const { homeIso } = useHomeCountry();
  const insets = useSafeAreaInsets();
  const today = todayIn(deviceZone());
  const tripId = one(params.tripId);
  const trip = trips.find((x) => x.id === tripId) ?? focusTrip(trips, today) ?? null;

  // Where the guide opens: passed in, the trip's current stop, home; else the list.
  const auto = useMemo((): { iso: string; source: Source } | null => {
    const passed = pickTipCountry([one(params.country)]);
    if (passed) return { iso: passed, source: 'param' };
    if (trip) {
      const now = Date.now();
      const home = homeCountryFor(trip, homeIso);
      let stop: string | null = null;
      try {
        stop = pickTipCountry([trip.startDate <= today && today <= trip.endDate ? countryForZone(zoneAt(trip, now)) : null, arrivingCountry(trip, now, home)?.iso2]);
      } catch {
        stop = null;
      }
      if (stop) return { iso: stop, source: 'stop' };
    }
    const home = pickTipCountry([homeIso]);
    return home ? { iso: home, source: 'home' } : null;
  }, [params.country, trip, homeIso, today]);

  const [picked, setPicked] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const iso = picked ?? auto?.iso ?? null;
  const source: Source | null = picked ? 'picked' : auto?.source ?? null;
  const row = findTipping(iso);
  const country = iso ? countryNameFrom(TABLES, iso) : null;
  const initialService = SERVICES.find((s) => s === one(params.service)) ?? 'restaurant';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.paper }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
    >
      <FadeInView>
        <HeroHeader tone="wallet" illustration="none" compact title={t('tipping.title')} subtitle={t('tipping.subtitle')} />
      </FadeInView>
      <Disclaimer />
      <CountryPicker
        country={country}
        source={source}
        open={listOpen || !row}
        onToggle={() => setListOpen((v) => !v)}
        canClose={!!row}
        selected={iso}
        onPick={(code) => {
          setPicked(code);
          setListOpen(false);
        }}
      />
      {row && country ? (
        <>
          <Guide row={row} country={country} />
          <Calculator
            key={`${row.iso2}-${trip?.id ?? ''}`}
            row={row}
            trip={trip}
            initialService={initialService}
            passedCurrency={one(params.currency)}
            contextCategory={one(params.category)}
            today={today}
          />
        </>
      ) : (
        <EmptyState art="coins" title={t('tipping.noCountry')} body={t('tipping.noCountryBody')} />
      )}
    </ScrollView>
  );
}

function Disclaimer() {
  const { t, theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
        <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
      </View>
      <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{t('tipping.disclaimer')}</Text>
    </View>
  );
}

/** The chosen country with where it came from, and the searchable list (open when nothing is chosen). */
function CountryPicker({
  country,
  source,
  open,
  canClose,
  onToggle,
  selected,
  onPick,
}: {
  country: string | null;
  source: Source | null;
  open: boolean;
  canClose: boolean;
  onToggle: () => void;
  selected: string | null;
  onPick: (iso: string) => void;
}) {
  const { t, theme } = useApp();
  const [query, setQuery] = useState('');
  const results = useMemo(() => coveredOnly(searchCountries(COUNTRIES, query)), [query]);
  return (
    <View style={{ gap: space.s }}>
      <View accessibilityRole="header">
        <Label>{t('tipping.country')}</Label>
      </View>
      {country && source ? (
        <View accessible accessibilityLabel={`${country}, ${t(SOURCE_KEYS[source])}`}>
          <Text style={[typeScale.title, { color: theme.ink }]}>{country}</Text>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t(SOURCE_KEYS[source])}</Text>
        </View>
      ) : null}
      {canClose ? <Button kind="secondary" icon="search-outline" label={open ? t('tipping.listDone') : t('tipping.change')} hint={open ? undefined : t('tipping.changeHint')} onPress={onToggle} /> : null}
      {open ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('tipping.search')} value={query} onChange={setQuery} placeholder={t('tipping.searchPlaceholder')} autoCapitalize="none" />
          {results.length === 0 ? <Body muted>{t('tipping.noMatch', { q: query.trim() })}</Body> : null}
          <View accessibilityRole="radiogroup" accessibilityLabel={t('tipping.country')} style={{ gap: space.s }}>
            {results.slice(0, MAX_LIST).map((r) => {
              const on = r.iso2 === selected;
              return (
                <PressableScale
                  key={r.iso2}
                  accessibilityRole="radio"
                  accessibilityLabel={r.country}
                  accessibilityHint={t('tipping.pickHint', { country: r.country })}
                  accessibilityState={{ selected: on, checked: on }}
                  onPress={() => {
                    setQuery('');
                    onPick(r.iso2);
                  }}
                  style={{
                    minHeight: TOUCH,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: space.l,
                    borderRadius: radius.m,
                    borderWidth: 1,
                    borderColor: on ? theme.accent : theme.line,
                    backgroundColor: on ? theme.accentSoft : theme.card,
                  }}
                >
                  <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink }]}>{r.country}</Text>
                  <Text style={[typeScale.small, { color: theme.muted }]}>{r.iso2}</Text>
                </PressableScale>
              );
            })}
          </View>
          {results.length > MAX_LIST ? <Body muted>{t('tipping.more', { n: MAX_LIST, total: results.length })}</Body> : null}
        </View>
      ) : null}
    </View>
  );
}

/** A norm in words. */
function useNormText() {
  const { t } = useApp();
  return (norm: Norm | null): string => {
    if (!norm) return t('tipping.norm.none');
    switch (norm.kind) {
      case 'none':
        return t('tipping.norm.none');
      case 'offence':
        return t('tipping.norm.offence');
      case 'roundup':
        return t('tipping.norm.roundup');
      case 'small':
        return t('tipping.norm.small');
      case 'optional':
        return t('tipping.norm.optional', { n: norm.percent });
      case 'percent':
        return norm.low === norm.high ? t('tipping.norm.percent', { n: norm.low }) : t('tipping.norm.range', { low: norm.low, high: norm.high });
    }
  };
}

function Guide({ row, country }: { row: TipRow; country: string }) {
  const { t, theme, lang } = useApp();
  const normText = useNormText();
  return (
    <SectionCard title={t('tipping.guide.title', { country })} icon="happy-outline" tone="ok">
      {SERVICES.map((s, i) => {
        const norm = parseNorm(row[s]);
        const text = normText(norm);
        const warn = norm?.kind === 'offence';
        return (
          <View
            key={s}
            accessible
            accessibilityLabel={t('tipping.rowA11y', { service: t(SERVICE_KEYS[s]), norm: text })}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m, paddingTop: i ? space.s : 0, borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}
          >
            <Text style={[typeScale.body, { color: theme.ink, flex: 1 }]}>{t(SERVICE_KEYS[s])}</Text>
            <Text style={[typeScale.bodyStrong, { color: warn ? theme.warn : theme.ink, flex: 1, textAlign: 'right' }]}>{text}</Text>
          </View>
        );
      })}
      <View accessible accessibilityLabel={`${t('tipping.charge.label')}: ${t(CHARGE_KEYS[row.service])}`} style={{ gap: 2, paddingTop: space.s, borderTopWidth: 1, borderTopColor: theme.line }}>
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('tipping.charge.label')}</Text>
        <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t(CHARGE_KEYS[row.service])}</Text>
      </View>
      <View style={{ gap: space.xs }}>
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('tipping.checked', { date: formatDay(row.checked, lang) })}</Text>
        {row.recheck ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.warn} />
            <Text style={[typeScale.small, { color: theme.warn, flex: 1 }]}>{t('tipping.recheck')}</Text>
          </View>
        ) : null}
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('tipping.disclaimer')}</Text>
      </View>
    </SectionCard>
  );
}

const PRESET_KEYS: Record<Exclude<TipMode, 'custom'>, Key> = {
  none: 'tipping.preset.none',
  roundup: 'tipping.preset.roundup',
  low: 'tipping.preset.low',
  typical: 'tipping.preset.typical',
  generous: 'tipping.preset.generous',
};

function Calculator({
  row,
  trip,
  initialService,
  passedCurrency,
  contextCategory,
  today,
}: {
  row: TipRow;
  trip: Trip | null;
  initialService: TipService;
  passedCurrency?: string;
  contextCategory?: string;
  today: string;
}) {
  const { t, theme, lang } = useApp();
  const { saveTrip } = useTrips();
  const s = useMemo(() => (trip ? readSpending(trip) : null), [trip]);
  const home = s?.budget?.currency ?? null;
  const local = currencyForCountry(row.iso2)?.code ?? null;
  const offered = [passedCurrency, local, home].filter((c, i, a): c is string => !!c && isCurrency(c) && a.indexOf(c) === i);

  const [service, setService] = useState<TipService>(initialService);
  const norm: Norm = parseNorm(row[service]) ?? { kind: 'none' };
  const [mode, setMode] = useState<TipMode>(() => defaultPreset(norm));
  const [customText, setCustomText] = useState('');
  const [currency, setCurrency] = useState<string | null>(offered[0] ?? null);
  const [amount, setAmount] = useState('');
  // The service charge is about restaurant and bar bills: the switch starts on there when it's usually on the bill.
  const chargeOn = (x: TipService) => row.service === 'usual' && (x === 'restaurant' || x === 'cafe');
  const [included, setIncluded] = useState(() => chargeOn(initialService));
  const [roundUp, setRoundUp] = useState(false);
  const [people, setPeople] = useState(1);
  const companions = trip ? peopleOf(trip) : [ME];
  const shared = companions.length > 1;
  const [splitMode, setSplitMode] = useState<'people' | 'companions'>('people');
  const [chosen, setChosen] = useState<string[]>(companions);
  const names = usePeople(trip ?? ({ companions: [] } as unknown as Trip));
  const [added, setAdded] = useState<string | null>(null);

  const presets = presetsFor(norm);
  const pickService = (next: TipService) => {
    setService(next);
    const n = parseNorm(row[next]) ?? { kind: 'none' };
    setMode(defaultPreset(n));
    setIncluded(chargeOn(next));
    setAdded(null);
  };

  const code = currency && isCurrency(currency) ? currency : null;
  const bill = code ? parseAmount(amount, code) : null;
  const custom = mode === 'custom' ? parseTip(customText) : null;
  const count = splitMode === 'companions' && shared ? Math.max(1, chosen.length) : people;
  const res = code ? calcTip({ bill, currency: code, norm, mode, customPercent: custom, included, roundUp, people: count }) : null;
  const result = res && res.ok ? res.result : null;
  const money = (m: number, c: string) => formatMoney(m, c, lang);
  const homeVal = result && code && home && code !== home && s ? tipHome(result, code, home, s.rates) : null;
  const day = trip ? defaultDay(trip, today) : today;
  const category = categoryFor(service, contextCategory);

  const step = (d: 1 | -1) => setPeople((n) => Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, n + d)));
  const onPeopleAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') step(1);
    else if (e.nativeEvent.actionName === 'decrement') step(-1);
  };
  const togglePerson = (id: string) => setChosen((list) => (list.includes(id) ? (list.length > 1 ? list.filter((x) => x !== id) : list) : companions.filter((p) => p === id || list.includes(p))));

  const add = async (which: 'total' | 'mine') => {
    if (!trip || !result || !code) return;
    const split = splitMode === 'companions' && shared ? chosen : which === 'mine' ? 'mine' : undefined;
    const e = tipExpense(result, { currency: code, day, id: newId('exp'), category, note: t('tipping.note', { service: t(SERVICE_KEYS[service]) }), split });
    if (await saveTrip(upsertExpense(trip, e))) {
      const msg = t('tipping.added', { amount: money(e.amount, code), trip: trip.name });
      setAdded(msg);
      AccessibilityInfo.announceForAccessibility(msg);
    } else {
      Alert.alert(t('tipping.addFailed'), t('tipping.addFailedBody'));
    }
  };

  const showErr = amount.trim() !== '' && res != null && !res.ok;
  const billErr = showErr && code && res && !res.ok && res.errors.includes('amount') ? t('tipping.calc.billErr', { code, n: currencyDigits(code) }) : undefined;
  const customErr = mode === 'custom' && customText.trim() !== '' && custom == null ? t('tipping.calc.customErr') : undefined;
  const stepText = code ? money(roundStep(code), code) : '';
  const big = result ? result.shares[0] : 0;
  const small = result ? result.shares[result.shares.length - 1] : 0;

  return (
    <SectionCard title={t('tipping.calc.title')} subtitle={code ? t('tipping.calc.subtitle', { code }) : undefined} icon="calculator-outline" tone="accent">
      <Label>{t('tipping.calc.for')}</Label>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('tipping.calc.for')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {SERVICES.map((x) => (
          <Chip key={x} label={t(SERVICE_KEYS[x])} selected={service === x} onPress={() => pickService(x)} />
        ))}
      </View>

      {offered.length > 1 ? (
        <>
          <Label>{t('tipping.calc.currency')}</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('tipping.calc.currency')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {offered.map((c) => (
              <Chip key={c} label={c} selected={currency === c} onPress={() => { setCurrency(c); setAdded(null); }} />
            ))}
          </View>
        </>
      ) : null}
      {code ? (
        <TextField label={t('tipping.calc.bill', { code })} value={amount} onChange={(v) => { setAmount(v); setAdded(null); }} placeholder={t('tipping.calc.billPlaceholder')} inputMode="decimal" error={billErr} />
      ) : null}

      <Label>{t('tipping.calc.preset')}</Label>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('tipping.calc.preset')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {presets.map((p) => (
          <Chip key={p.preset} label={t(PRESET_KEYS[p.preset], { n: p.percent ?? 0 })} selected={mode === p.preset} onPress={() => setMode(p.preset)} />
        ))}
        <Chip label={t('tipping.preset.custom')} selected={mode === 'custom'} onPress={() => setMode('custom')} />
      </View>
      {mode === 'custom' ? (
        <TextField label={t('tipping.calc.customLabel')} value={customText} onChange={setCustomText} placeholder={t('tipping.calc.customPlaceholder')} inputMode="decimal" error={customErr} />
      ) : null}
      {norm.kind === 'offence' ? <Text style={[typeScale.small, { color: theme.warn }]}>{t('tipping.calc.caution')}</Text> : null}

      <ToggleRow label={t('tipping.calc.included')} hint={t('tipping.calc.includedHint')} value={included} onChange={setIncluded} />
      {mode !== 'roundup' && mode !== 'none' && code ? <ToggleRow label={t('tipping.calc.roundUp')} hint={t('tipping.calc.roundUpHint', { step: stepText })} value={roundUp} onChange={setRoundUp} /> : null}

      <Label>{t('tipping.split.label')}</Label>
      {shared ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={t('tipping.split.label')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          <Chip label={t('tipping.split.people')} selected={splitMode === 'people'} onPress={() => setSplitMode('people')} />
          <Chip label={t('tipping.split.companions')} selected={splitMode === 'companions'} onPress={() => setSplitMode('companions')} />
        </View>
      ) : null}
      {splitMode === 'companions' && shared ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {companions.map((id) => (
            <Chip key={id} label={names.name(id)} selected={chosen.includes(id)} hint={t('tipping.split.personHint')} onPress={() => togglePerson(id)} />
          ))}
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('tipping.split.peopleA11y', { n: people })}
          accessibilityHint={t('tipping.split.peopleHint')}
          accessibilityValue={{ min: MIN_SPLIT, max: MAX_SPLIT, now: people, text: people === 1 ? t('tipping.split.peopleOne') : t('tipping.split.peopleValue', { n: people }) }}
          accessibilityActions={[
            { name: 'increment', label: t('tipping.split.more') },
            { name: 'decrement', label: t('tipping.split.fewer') },
          ]}
          onAccessibilityAction={onPeopleAction}
          style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m }}
        >
          <StepButton icon="remove" label={t('tipping.split.fewer')} hint={t('tipping.split.stepHint')} enabled={people > MIN_SPLIT} onPress={() => step(-1)} />
          <Text style={[typeScale.title, { flex: 1, textAlign: 'center', color: theme.ink, fontVariant: ['tabular-nums'] }]}>
            {people === 1 ? t('tipping.split.peopleOne') : t('tipping.split.peopleValue', { n: people })}
          </Text>
          <StepButton icon="add" label={t('tipping.split.more')} hint={t('tipping.split.stepHint')} enabled={people < MAX_SPLIT} onPress={() => step(1)} />
        </View>
      )}

      {result && code ? (
        <View style={{ gap: space.s, backgroundColor: theme.accentSoft, borderRadius: radius.m, padding: space.l }}>
          <View accessible accessibilityLiveRegion="polite">
            <Text style={[typeScale.displayM, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{money(result.total, code)}</Text>
            {result.shares.length > 1 ? (
              <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
                {result.extra === 0
                  ? t('tipping.res.each', { amount: money(big, code) })
                  : t('tipping.res.uneven', { a: result.extra, amountA: money(big, code), b: result.shares.length - result.extra, amountB: money(small, code) })}
              </Text>
            ) : null}
          </View>
          <ResultRow label={t('tipping.res.bill')} value={money(result.bill, code)} />
          <ResultRow label={result.percent != null ? t('tipping.res.tipPercent', { n: result.percent }) : t('tipping.res.tip')} value={money(result.tip, code)} />
          <ResultRow label={t('tipping.res.total')} value={money(result.total, code)} strong />
          {result.included ? <Text style={[typeScale.small, { color: theme.ink }]}>{t('tipping.res.included')}</Text> : null}
          {result.rounded ? <Text style={[typeScale.small, { color: theme.ink }]}>{t('tipping.res.rounded', { step: stepText })}</Text> : null}
          {home && code !== home ? (
            <Text style={[typeScale.small, { color: theme.ink }]}>
              {homeVal ? t('tipping.res.home', { tip: money(homeVal.tip, home), total: money(homeVal.total, home) }) : t('tipping.res.noRate', { code, home })}
            </Text>
          ) : null}
          {trip ? (
            <>
              <Button
                label={t('tipping.add')}
                hint={splitMode === 'companions' && shared ? t('tipping.addSplitHint', { amount: money(result.total, code), day: formatDay(day, lang) }) : t('tipping.addHint', { amount: money(result.total, code), day: formatDay(day, lang), trip: trip.name })}
                icon="add"
                onPress={() => add('total')}
              />
              {splitMode === 'people' && result.shares.length > 1 ? (
                <Button kind="quiet" label={t('tipping.addMine')} hint={t('tipping.addMineHint', { amount: money(big, code), day: formatDay(day, lang), trip: trip.name })} onPress={() => add('mine')} />
              ) : null}
            </>
          ) : (
            <Body muted>{t('tipping.noTripAdd')}</Body>
          )}
          {added ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Ionicons name="checkmark-circle" size={18} color={theme.ok} />
              <Text style={[typeScale.small, { color: theme.ink, flex: 1 }]}>{added}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Body muted>{t('tipping.res.empty')}</Body>
      )}
    </SectionCard>
  );
}

function ResultRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { theme } = useApp();
  const style = strong ? typeScale.bodyStrong : typeScale.body;
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
      <Text style={[style, { color: theme.ink }]}>{label}</Text>
      <Text style={[style, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
}

/** A visible - / + button. Screen readers skip it: the adjustable row carries the same actions. */
function StepButton({ icon, label, hint, enabled, onPress }: { icon: 'add' | 'remove'; label: string; hint: string; enabled: boolean; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !enabled }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      disabled={!enabled}
      onPress={onPress}
      style={[{ width: TOUCH, height: TOUCH, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.4 }, shadowOf(theme, 'low')]}
    >
      <Ionicons name={icon} size={24} color={theme.ink} />
    </PressableScale>
  );
}
