// T61 Wallet > Converter: an offline currency converter and bill splitter on the active trip's own rates.
// - Rates are the traveller's, stored on the trip by Spending (T54: "1 local = x home"); nothing is fetched. The rate
//   can be edited inline here and is saved back to the trip with its day (src/core/convert.ts setRateOn).
// - Big keypad (never more decimals than the currency has), swap direction, and a quick-prices table scaled for
//   low-value currencies. Tap a quick row to load it.
// - Split a bill: amount, 2-20 people, optional tip; shares in minor units with the remainder spread one unit at a
//   time; "Add as expense" (your share or the whole bill) goes into the trip's spending.
// Optional params: ?tripId= (defaults to the trip on now or next) and ?section=split (scrolls to the splitter).
// Free feature. Tokens only, timed motion only (no springs), 48 pt targets, every control labelled.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, ScrollView, Text, View, type AccessibilityActionEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clampPeople,
  cleanKeypad,
  convertFor,
  defaultLocal,
  directionalRate,
  keypadMinor,
  localChoices,
  MAX_PEOPLE,
  MIN_PEOPLE,
  pairFor,
  parseTip,
  pressKey,
  quickTable,
  rateDates,
  setRateOn,
  showKeypad,
  splitBill,
  splitExpense,
  swapDirection,
  TIP_CHOICES,
  type Direction,
  type KeypadKey,
  type Split,
} from '../src/core/convert.ts';
import { deviceZone, formatDay, todayIn } from '../src/core/format.ts';
import { focusTrip } from '../src/core/glance.ts';
import { newId, type Trip } from '../src/core/model.ts';
import { cleanCurrency, currencyDigits, defaultDay, formatMoney, isCurrency, parseAmount, parseRate, rateFor, rateToText, readSpending, upsertExpense } from '../src/core/spending.ts';
import { orderTrips } from '../src/core/trips.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { duration, timed } from '../src/theme/motion.ts';
import { radius, shadowOf, space, TOUCH, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, SectionCard } from '../src/ui/hero.tsx';
import { Body, Button, Card, Chip, EmptyState, Label, PressableScale, Screen, TextField } from '../src/ui/kit.tsx';

export default function ConvertScreen() {
  const params = useLocalSearchParams<{ tripId?: string; section?: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const today = todayIn(deviceZone());
  const [picked, setPicked] = useState<string | null>(typeof params.tripId === 'string' ? params.tripId : null);
  const ordered = useMemo(() => orderTrips(trips, today), [trips, today]);
  const trip = trips.find((x) => x.id === picked) ?? focusTrip(trips, today) ?? ordered[0] ?? null;

  if (!trip) {
    return (
      <Screen>
        <EmptyState
          art="coins"
          title={t('convert.noTrip')}
          body={t('convert.noTripBody')}
          action={<Button label={t('convert.noTripAction')} hint={t('convert.noTripActionHint')} onPress={() => router.navigate('/')} />}
        />
        <UnitsLink />
      </Screen>
    );
  }
  // Up to six trips to choose from (on now and coming up first); the one shown is always among them.
  const choices = ordered.slice(0, 6).some((x) => x.id === trip.id) ? ordered.slice(0, 6) : [trip, ...ordered.slice(0, 5)];
  return <ConvertBody key={trip.id} trip={trip} tripChoices={trips.length > 1 ? choices : []} onPickTrip={setPicked} toSplit={params.section === 'split'} />;
}

function ConvertBody({ trip, tripChoices, onPickTrip, toSplit }: { trip: Trip; tripChoices: Trip[]; onPickTrip: (id: string) => void; toSplit: boolean }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const { saveTrip } = useTrips();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const scrolled = useRef(false);
  const today = todayIn(deviceZone());

  const s = useMemo(() => readSpending(trip), [trip]);
  const home = s.budget?.currency ?? null;
  const [extra, setExtra] = useState<string[]>([]);
  const offered = useMemo(() => [...localChoices(s, home), ...extra.filter((c) => c !== home)].filter((c, i, a) => a.indexOf(c) === i), [s, home, extra]);
  const [local, setLocal] = useState<string | null>(() => defaultLocal(s, home));
  const current = local && local !== home ? local : offered[0] ?? null;

  const header = (
    <FadeInView>
      <HeroHeader tone="wallet" illustration="none" compact title={t('convert.title')} subtitle={t('convert.subtitle')} />
    </FadeInView>
  );
  const tripPicker = tripChoices.length ? (
    <View style={{ gap: space.s }}>
      <View accessibilityRole="header">
        <Label>{t('convert.trip')}</Label>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('convert.trip')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {tripChoices.map((x) => (
          <Chip key={x.id} label={x.name} selected={x.id === trip.id} onPress={() => onPickTrip(x.id)} />
        ))}
      </View>
    </View>
  ) : null;

  if (!home) {
    return (
      <Screen>
        {header}
        {tripPicker}
        <EmptyState
          art="coins"
          title={t('convert.noHome')}
          body={t('convert.noHomeBody', { trip: trip.name })}
          action={<Button label={t('convert.openSpending')} hint={t('convert.openSpendingHint')} icon="wallet-outline" onPress={() => router.push(`/spending/${trip.id}`)} />}
        />
        <UnitsLink />
      </Screen>
    );
  }

  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1, backgroundColor: theme.paper }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
    >
      {header}
      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
          <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
        </View>
        <Text style={[typeScale.small, { color: theme.muted, flex: 1 }]}>{t('convert.ownRates')}</Text>
      </View>
      {tripPicker}
      <LocalPicker home={home} offered={offered} current={current} onPick={setLocal} onAdd={(c) => { setExtra((x) => (x.includes(c) ? x : [...x, c])); setLocal(c); }} />
      {current ? <Converter key={current} trip={trip} local={current} home={home} today={today} saveTrip={saveTrip} /> : null}
      <UnitsLink />
      <View
        onLayout={(e) => {
          if (!toSplit || scrolled.current) return;
          scrolled.current = true;
          scroll.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: !reduceMotion });
        }}
      >
        <BillSplit trip={trip} local={current} home={home} today={today} lang={lang} saveTrip={saveTrip} />
      </View>
    </ScrollView>
  );
}

/** Which currency is "local": chips for the trip's currencies, plus a field for any other 3-letter code. */
function LocalPicker({ home, offered, current, onPick, onAdd }: { home: string; offered: string[]; current: string | null; onPick: (c: string) => void; onAdd: (c: string) => void }) {
  const { t } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const add = () => {
    const c = cleanCurrency(code);
    if (!isCurrency(c) || c === home) {
      setErr(true);
      AccessibilityInfo.announceForAccessibility(t('convert.otherErr', { home }));
      return;
    }
    setErr(false);
    setCode('');
    onAdd(c);
  };
  return (
    <View style={{ gap: space.s }}>
      <View accessibilityRole="header">
        <Label>{t('convert.local')}</Label>
      </View>
      {offered.length ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={t('convert.local')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {offered.map((c) => (
            <Chip key={c} label={c} selected={c === current} onPress={() => onPick(c)} />
          ))}
        </View>
      ) : (
        <Body muted>{t('convert.noLocal')}</Body>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('convert.otherCode')}
            value={code}
            onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Za-z]/g, '').slice(0, 3))}
            placeholder={t('convert.otherPlaceholder')}
            autoCapitalize="none"
            error={err ? t('convert.otherErr', { home }) : undefined}
          />
        </View>
        <View style={{ marginBottom: err ? space.xl : 0 }}>
          <Button kind="secondary" label={t('convert.otherAdd')} hint={t('convert.otherAddHint')} onPress={add} />
        </View>
      </View>
    </View>
  );
}

/** Rate (with inline edit and its day), the two big amounts with swap, the keypad and the quick-prices table. */
function Converter({ trip, local, home, today, saveTrip }: { trip: Trip; local: string; home: string; today: string; saveTrip: (t: Trip) => Promise<boolean> }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const s = useMemo(() => readSpending(trip), [trip]);
  const rate = rateFor(local, home, s.rates);
  const day = rateDates(trip)[local];
  const [dir, setDir] = useState<Direction>('toHome');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(rate == null);
  const [draft, setDraft] = useState(rate != null ? rateToText(rate) : '');
  const [rateErr, setRateErr] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const spun = useRef(0);

  const { from, to } = pairFor(local, home, dir);
  const minor = keypadMinor(text, from) ?? 0;
  const result = convertFor(minor, local, home, s.rates, dir);
  const inverse = directionalRate(local, home, s.rates, 'toLocal');
  const rows = useMemo(() => quickTable(local, home, s.rates), [local, home, s.rates]);
  const money = (m: number, c: string) => formatMoney(m, c, lang);

  const saveRate = async () => {
    const r = parseRate(draft);
    const next = r == null ? trip : setRateOn(trip, local, r, today);
    if (r == null || next === trip) {
      setRateErr(true);
      AccessibilityInfo.announceForAccessibility(t('convert.rate.err'));
      return;
    }
    setRateErr(false);
    if (await saveTrip(next)) {
      setEditing(false);
      setDraft(rateToText(r));
      AccessibilityInfo.announceForAccessibility(t('convert.rate.saved'));
    } else {
      Alert.alert(t('convert.rate.saveFailed'), t('convert.rate.saveFailedBody'));
    }
  };

  const swap = () => {
    const next = swapDirection(dir);
    setText((x) => cleanKeypad(x, pairFor(local, home, next).from));
    setDir(next);
    spun.current += 1;
    timed(spin, spun.current, duration.base, reduceMotion).start();
  };
  const press = (k: KeypadKey) => setText((x) => pressKey(x, k, from));
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'], extrapolate: 'extend' });

  const shown = showKeypad(text, lang);
  const resultText = result == null ? t('convert.resultNone') : money(result, to);

  return (
    <>
      <SectionCard title={t('convert.rate.title')} icon="swap-horizontal" tone="sea">
        {!editing && rate != null ? (
          <View style={{ gap: space.xs }}>
            <Text style={[typeScale.title, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('convert.rate.line', { code: local, rate: rateToText(rate), home })}</Text>
            {inverse != null ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{t('convert.rate.inverse', { home, rate: rateToText(Number(inverse.toPrecision(4))), code: local })}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Ionicons name="calendar-outline" size={14} color={theme.muted} />
              <Text style={[typeScale.small, { color: theme.muted }]}>{day ? t('convert.rate.updated', { date: formatDay(day, lang) }) : t('convert.rate.noDate')}</Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('convert.rate.editA11y', { code: local, rate: rateToText(rate), home })}
              accessibilityHint={t('convert.rate.editHint')}
              onPress={() => {
                setDraft(rateToText(rate));
                setEditing(true);
              }}
              style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs }}
            >
              <Ionicons name="create-outline" size={18} color={theme.sea} />
              <Text style={[typeScale.bodyStrong, { color: theme.sea }]}>{t('convert.rate.edit')}</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={{ gap: space.s }}>
            {rate == null ? <Body muted>{t('convert.rate.missing', { code: local })}</Body> : null}
            <TextField
              label={t('convert.rate.label', { code: local, home })}
              value={draft}
              onChange={setDraft}
              placeholder={t('convert.rate.placeholder')}
              inputMode="decimal"
              error={rateErr ? t('convert.rate.err') : undefined}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              <Button label={t('convert.rate.save')} hint={t('convert.rate.saveHint')} icon="checkmark" onPress={saveRate} />
              {rate != null ? (
                <Button
                  kind="quiet"
                  label={t('convert.rate.cancel')}
                  hint={t('convert.rate.cancelHint')}
                  onPress={() => {
                    setRateErr(false);
                    setEditing(false);
                  }}
                />
              ) : null}
            </View>
          </View>
        )}
      </SectionCard>

      <Card style={{ gap: space.m }}>
        <View style={{ gap: space.xs }}>
          <Label>{t('convert.from')}</Label>
          <View accessible accessibilityLabel={t('convert.amountA11y', { amount: shown, code: from })} style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[typeScale.displayXL, { color: theme.ink, flex: 1, fontVariant: ['tabular-nums'] }]}>
              {shown}
            </Text>
            <Text style={[typeScale.title, { color: theme.muted }]}>{from}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('convert.swapA11y', { from, to })}
            accessibilityHint={t('convert.swapHint')}
            onPress={swap}
            style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: theme.seaSoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Ionicons name="swap-vertical" size={26} color={theme.sea} />
            </Animated.View>
          </PressableScale>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
        </View>
        <View style={{ gap: space.xs }}>
          <Label>{t('convert.to')}</Label>
          <View
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={result == null ? t('convert.resultNoneA11y') : t('convert.resultA11y', { amount: resultText })}
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[typeScale.displayL, { color: theme.accentInk, flex: 1, fontVariant: ['tabular-nums'] }]}>
              {resultText}
            </Text>
            <Text style={[typeScale.title, { color: theme.muted }]}>{to}</Text>
          </View>
        </View>
        <Keypad decimals={currencyDigits(from) > 0} onKey={press} />
      </Card>

      {rows.length ? (
        <SectionCard title={t('convert.quick.title')} subtitle={t('convert.quick.body', { code: local, home })} icon="list-outline" tone="teal">
          {rows.map((r, i) => {
            const l = money(r.local, local);
            const h = money(r.home, home);
            return (
              <PressableScale
                key={r.local}
                accessibilityRole="button"
                accessibilityLabel={t('convert.quick.rowA11y', { local: l, home: h })}
                accessibilityHint={t('convert.quick.rowHint')}
                onPress={() => {
                  setDir('toHome');
                  setText(String(r.local / 10 ** currencyDigits(local)));
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}
              >
                <Text style={[typeScale.bodyStrong, { color: theme.ink, flex: 1, fontVariant: ['tabular-nums'] }]}>{l}</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.muted} />
                <Text style={[typeScale.body, { color: theme.ink, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{h}</Text>
              </PressableScale>
            );
          })}
        </SectionCard>
      ) : null}
    </>
  );
}

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['dot', '0', 'back'],
];

/** Big 4 x 3 keypad (each key 60 pt tall) plus Clear. The decimal key is hidden for zero-decimal currencies. */
function Keypad({ decimals, onKey }: { decimals: boolean; onKey: (k: KeypadKey) => void }) {
  const { t, theme } = useApp();
  return (
    <View accessibilityLabel={t('convert.keypad')} style={{ gap: space.s }}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={{ flexDirection: 'row', gap: space.s }}>
          {row.map((k) =>
            k === 'dot' && !decimals ? (
              <View key={k} style={{ flex: 1 }} />
            ) : (
              <View key={k} style={{ flex: 1 }}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={k === 'dot' ? t('convert.key.dot') : k === 'back' ? t('convert.key.back') : t('convert.key.digit', { d: k })}
                  onPress={() => onKey(k)}
                  style={{ minHeight: 60, borderRadius: radius.m, backgroundColor: k === 'back' ? theme.paper : theme.card, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' }}
                >
                  {k === 'back' ? (
                    <Ionicons name="backspace-outline" size={26} color={theme.ink} />
                  ) : (
                    <Text style={[typeScale.displayM, { color: theme.ink }]}>{k === 'dot' ? '.' : k}</Text>
                  )}
                </PressableScale>
              </View>
            ),
          )}
        </View>
      ))}
      <Button kind="quiet" label={t('convert.key.clear')} hint={t('convert.key.clearHint')} onPress={() => onKey('clear')} />
    </View>
  );
}

/** Bill split: amount in local or home, 2-20 people, tip; shares and "Add as expense". */
function BillSplit({ trip, local, home, today, lang, saveTrip }: { trip: Trip; local: string | null; home: string; today: string; lang: string; saveTrip: (t: Trip) => Promise<boolean> }) {
  const { t, theme } = useApp();
  const s = readSpending(trip);
  const [cur, setCur] = useState<string>(local ?? home);
  const code = cur === home || cur === local ? cur : home;
  const [amount, setAmount] = useState('');
  const [people, setPeople] = useState(2);
  const [tipChoice, setTipChoice] = useState<number | 'custom'>(0);
  const [tipText, setTipText] = useState('');
  const [added, setAdded] = useState<string | null>(null);

  const bill = parseAmount(amount, code);
  const tipPct = tipChoice === 'custom' ? parseTip(tipText) : tipChoice;
  const res = splitBill(bill, people, tipPct);
  const split: Split | null = res.ok ? res.split : null;
  const money = (m: number, c: string) => formatMoney(m, c, lang);
  const other = local && code === local ? home : code === home && local ? local : null;
  const approx = split && other && local ? convertFor(split.shares[0], local, home, s.rates, code === local ? 'toHome' : 'toLocal') : null;
  const day = defaultDay(trip, today);
  const step = (d: 1 | -1) => setPeople((n) => clampPeople(n + d));
  const onPeopleAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') step(1);
    else if (e.nativeEvent.actionName === 'decrement') step(-1);
  };

  const add = async (which: 'share' | 'total') => {
    if (!split) return;
    const e = splitExpense(split, which, { currency: code, day, id: newId('exp'), note: t('convert.split.note', { n: people }) });
    if (await saveTrip(upsertExpense(trip, e))) {
      const msg = t('convert.split.added', { trip: trip.name, amount: money(e.amount, code) });
      setAdded(msg);
      AccessibilityInfo.announceForAccessibility(msg);
    } else {
      Alert.alert(t('convert.split.addFailed'), t('convert.split.addFailedBody'));
    }
  };

  const showErr = amount.trim() !== '' && !res.ok;
  const amountErr = showErr && !res.ok && res.errors.includes('amount') ? t('convert.split.amountErr', { code, n: currencyDigits(code) }) : undefined;
  const tipErr = tipChoice === 'custom' && tipPct == null ? t('convert.split.tipErr') : undefined;
  const big = split ? split.shares[0] : 0;
  const small = split ? split.shares[split.shares.length - 1] : 0;

  return (
    <SectionCard title={t('convert.split.title')} subtitle={t('convert.split.subtitle')} icon="people-outline" tone="accent">
      {local ? (
        <View style={{ gap: space.s }}>
          <Label>{t('convert.split.currency')}</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('convert.split.currency')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {[local, home].map((c) => (
              <Chip key={c} label={c} selected={code === c} onPress={() => { setCur(c); setAdded(null); }} />
            ))}
          </View>
        </View>
      ) : null}
      <TextField label={t('convert.split.amount')} value={amount} onChange={(v) => { setAmount(v); setAdded(null); }} placeholder={t('convert.split.amountPlaceholder')} inputMode="decimal" error={amountErr} />

      <Label>{t('convert.split.people')}</Label>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('convert.split.peopleA11y', { n: people })}
        accessibilityHint={t('convert.split.peopleHint')}
        accessibilityValue={{ min: MIN_PEOPLE, max: MAX_PEOPLE, now: people, text: t('convert.split.peopleValue', { n: people }) }}
        accessibilityActions={[
          { name: 'increment', label: t('convert.split.more') },
          { name: 'decrement', label: t('convert.split.fewer') },
        ]}
        onAccessibilityAction={onPeopleAction}
        style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.m }}
      >
        <StepButton icon="remove" label={t('convert.split.fewer')} hint={t('convert.split.stepHint')} enabled={people > MIN_PEOPLE} onPress={() => step(-1)} />
        <Text style={[typeScale.title, { flex: 1, textAlign: 'center', color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('convert.split.peopleValue', { n: people })}</Text>
        <StepButton icon="add" label={t('convert.split.more')} hint={t('convert.split.stepHint')} enabled={people < MAX_PEOPLE} onPress={() => step(1)} />
      </View>

      <Label>{t('convert.split.tip')}</Label>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('convert.split.tip')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {TIP_CHOICES.map((n) => (
          <Chip key={n} label={n === 0 ? t('convert.split.tipNone') : t('convert.split.tipOption', { n })} selected={tipChoice === n} onPress={() => setTipChoice(n)} />
        ))}
        <Chip label={t('convert.split.tipCustom')} selected={tipChoice === 'custom'} onPress={() => setTipChoice('custom')} />
      </View>
      {tipChoice === 'custom' ? (
        <TextField label={t('convert.split.tipCustom')} value={tipText} onChange={setTipText} placeholder={t('convert.split.tipPlaceholder')} inputMode="decimal" error={tipErr} />
      ) : null}

      {split ? (
        <View style={{ gap: space.s, backgroundColor: theme.accentSoft, borderRadius: radius.m, padding: space.l }}>
          <View accessible accessibilityLiveRegion="polite">
            <Text style={[typeScale.displayM, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
              {split.extra === 0
                ? t('convert.split.each', { amount: money(big, code) })
                : t('convert.split.uneven', { a: split.extra, amountA: money(big, code), b: split.shares.length - split.extra, amountB: money(small, code) })}
            </Text>
            {approx != null && other ? <Text style={[typeScale.small, { color: theme.ink }]}>{t('convert.split.approx', { amount: money(approx, other) })}</Text> : null}
          </View>
          <Row label={t('convert.split.bill')} value={money(split.bill, code)} />
          {split.tip > 0 ? <Row label={t('convert.split.tipAmount')} value={money(split.tip, code)} /> : null}
          <Row label={t('convert.split.total')} value={money(split.total, code)} strong />
          <Button label={t('convert.split.addShare')} hint={t('convert.split.addShareHint', { amount: money(big, code), day: formatDay(day, lang) })} icon="add" onPress={() => add('share')} />
          <Button kind="quiet" label={t('convert.split.addTotal')} hint={t('convert.split.addTotalHint', { amount: money(split.total, code), day: formatDay(day, lang) })} onPress={() => add('total')} />
          {added ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Ionicons name="checkmark-circle" size={18} color={theme.ok} />
              <Text style={[typeScale.small, { color: theme.ink, flex: 1 }]}>{added}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Body muted>{t('convert.split.empty')}</Body>
      )}
    </SectionCard>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { theme } = useApp();
  const style = strong ? typeScale.bodyStrong : typeScale.body;
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
      <Text style={[style, { color: theme.ink }]}>{label}</Text>
      <Text style={[style, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
}

/** A visible - / + button. Screen readers skip it: the adjustable people row carries the same actions. */
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

/** T90: the offline units and sizes converter (app/units.tsx), which needs no trip or rates; T148 the numbers trainer. */
function UnitsLink() {
  const { t } = useApp();
  const router = useRouter();
  return (
    <>
      <Button kind="secondary" icon="speedometer-outline" label={t('units.fromConvert')} hint={t('units.fromConvertHint')} onPress={() => router.push('/units')} />
      {/* T148: prices written and said the local way, plus the numbers quiz. */}
      <Button kind="secondary" icon="pricetag-outline" label={t('numbers.fromConvert')} hint={t('numbers.fromConvertHint')} onPress={() => router.push({ pathname: '/numbers', params: { section: 'till' } })} />
    </>
  );
}
