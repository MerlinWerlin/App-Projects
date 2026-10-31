// T102 Cash on hand: cash left per currency with its home value at the saved rate, a "Getting low" hint from the
// trip's own daily cash pace, the leftover-cash summary from the last day on, starting cash, ATM withdrawals (amount,
// fee, the bank's rate, place) and exchanges, the average withdrawal fee, and a tap-to-count of notes and coins.
// Spending entries are marked "Paid in cash" in Spending and come off automatically. Logic in src/core/cash.ts; all
// on the phone, stored on the trip (Trip.cash) and carried in .satchel files.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Alert, Text, View } from 'react-native';
import {
  bankRateGap,
  bumpCount,
  cashCurrencyChoices,
  cashExpenses,
  cashPace,
  cashSummary,
  countCurrencies,
  countCurrencyFor,
  countTotal,
  denominationsFor,
  denomKey,
  draftFromMove,
  feeStats,
  leftoverChoicesFor,
  leftoverSummary,
  moveFromDraft,
  newMoveDraft,
  readCash,
  recordCount,
  removeMove,
  setCountCurrency,
  setLeftoverChoice,
  setStartCash,
  sortMoves,
  suggestCashCurrency,
  upsertMove,
  validateMove,
  type CashExchange,
  type CashMove,
  type CashWithdrawal,
  type Counts,
  type LeftoverChoice,
  type MoveDraft,
  type MoveError,
  type MoveKind,
} from '../../src/core/cash.ts';
import { deviceZone, formatDay, todayIn } from '../../src/core/format.ts';
import { newId, type Trip } from '../../src/core/model.ts';
import { cleanCurrency, currencyDigits, defaultDay, formatMoney, isCurrency, minorToText, parseAmount, rateFor, readSpending } from '../../src/core/spending.ts';
import { addDays } from '../../src/core/tz.ts';
import type { Key } from '../../src/i18n/en.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, SectionCard } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, Screen, TextField, Warning } from '../../src/ui/kit.tsx';

const CHOICE_KEYS: Record<LeftoverChoice, Key> = { spend: 'cash.leftover.spend', keep: 'cash.leftover.keep', exchange: 'cash.leftover.exchange' };
const HISTORY_SHOWN = 30;

type Form = { prev?: CashWithdrawal | CashExchange; draft: MoveDraft; errors: MoveError[] };

export default function CashScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('cash.title')} body={t('cash.notFound')} />
      </Screen>
    );
  }
  return <CashBody trip={trip} />;
}

function CashBody({ trip }: { trip: Trip }) {
  const { t, theme, lang } = useApp();
  const { saveTrip } = useTrips();
  const router = useRouter();
  const today = todayIn(deviceZone());
  const s = useMemo(() => cashSummary(trip), [trip]);
  const pace = useMemo(() => cashPace(trip, today), [trip, today]);
  const left = useMemo(() => leftoverSummary(trip, today), [trip, today]);
  const fees = useMemo(() => feeStats(trip), [trip]);
  const cash = useMemo(() => readCash(trip), [trip]);
  const paidCount = useMemo(() => cashExpenses(trip).length, [trip]);
  const [form, setForm] = useState<Form | null>(null);
  const [showAll, setShowAll] = useState(false);
  const money = (minor: number, code: string) => formatMoney(minor, code, lang);
  const pct = (x: number) => {
    try {
      return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 }).format(x);
    } catch {
      return `${Math.round(x * 1000) / 10}%`;
    }
  };

  const save = async (next: Trip): Promise<boolean> => {
    const ok = await saveTrip(next);
    if (!ok) Alert.alert(t('error.trips.save.title'), t('error.trips.save.body'));
    return ok;
  };

  const open = (kind: MoveKind) => {
    const currency = kind === 'exchange' ? (s.home ?? suggestCashCurrency(trip)) : suggestCashCurrency(trip);
    setForm({ draft: newMoveDraft(kind, defaultDay(trip, today), currency, s.home), errors: [] });
  };
  const edit = (m: CashWithdrawal | CashExchange) => setForm({ prev: m, draft: draftFromMove(m, s.home), errors: [] });
  const submit = async () => {
    if (!form) return;
    const errors = validateMove(form.draft);
    if (errors.length) {
      setForm({ ...form, errors });
      AccessibilityInfo.announceForAccessibility(t('spec.form.checkFields'));
      return;
    }
    if (await save(upsertMove(trip, moveFromDraft(form.draft, newId('cash'), form.prev)))) {
      setForm(null);
      AccessibilityInfo.announceForAccessibility(t('cash.form.saved'));
    }
  };
  const confirmDelete = (m: CashMove) =>
    Alert.alert(t('cash.history.deleteTitle'), t('cash.history.deleteBody', { what: describe(m) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (await save(removeMove(trip, m.id))) {
            setForm((f) => (f?.prev?.id === m.id ? null : f));
            AccessibilityInfo.announceForAccessibility(t('cash.history.deleted'));
          }
        },
      },
    ]);

  const describe = (m: CashMove): string => {
    if (m.kind === 'withdrawal') return t('cash.history.withdrawal', { amount: money(m.amount, m.currency) });
    if (m.kind === 'exchange') return t('cash.history.exchange', { from: money(m.amount, m.currency), to: money(m.toAmount, m.toCurrency) });
    return t('cash.history.count', { amount: money(Math.abs(m.amount), m.currency), sign: m.amount > 0 ? '+' : '−' });
  };

  const rows = s.rows.filter((r) => r.amount !== 0 || r.start > 0);
  const history = sortMoves(cash.moves);
  const shown = showAll ? history : history.slice(0, HISTORY_SHOWN);
  const low = pace.filter((p) => p.low);
  const otherPace = pace.filter((p) => !p.low);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('cash.route') }} />
      <FadeInView style={{ gap: space.m }}>
        {/* Cash left */}
        <SectionCard title={t('cash.title')} subtitle={trip.name} icon="cash-outline" tone="ok">
          {rows.length === 0 ? (
            <EmptyState art="coins" title={t('cash.emptyTitle')} body={t('cash.emptyBody')} />
          ) : (
            <View style={{ gap: space.s }}>
              {rows.map((r, i) => {
                const amount = money(r.amount, r.currency);
                const value = r.currency === s.home ? null : r.home != null && s.home ? t('cash.approx', { amount: money(r.home, s.home) }) : s.home ? t('cash.noRate') : null;
                return (
                  <View
                    key={r.currency}
                    accessible
                    accessibilityLabel={[t('cash.leftA11y', { code: r.currency, amount }), value, r.short ? t('cash.short') : null].filter(Boolean).join(', ')}
                    style={{ minHeight: TOUCH, justifyContent: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: theme.line, paddingVertical: space.xs }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                      <Text style={[typeScale.bodyStrong, { color: theme.muted, width: 48 }]}>{r.currency}</Text>
                      <Text style={[typeScale.title, { flex: 1, color: r.short ? theme.danger : theme.ink, fontVariant: ['tabular-nums'] }]}>{amount}</Text>
                      {value ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{value}</Text> : null}
                    </View>
                    {r.short ? <Text style={[typeScale.small, { color: theme.danger }]}>{t('cash.short')}</Text> : null}
                  </View>
                );
              })}
              {s.home && s.totalHome != null && rows.some((r) => r.currency !== s.home) ? (
                <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('cash.total', { amount: money(s.totalHome, s.home) })}</Text>
              ) : null}
              {s.missing.length ? <Body muted>{t('cash.missing', { codes: s.missing.join(', ') })}</Body> : null}
              {!s.home ? <Body muted>{t('cash.noHome')}</Body> : null}
              {s.missing.length || !s.home ? (
                <Button kind="secondary" icon="swap-horizontal" label={t('cash.toSpending')} hint={t('cash.toSpendingHint')} onPress={() => router.push(`/spending/${trip.id}`)} />
              ) : null}
            </View>
          )}
        </SectionCard>

        {/* Getting low */}
        {low.map((p) => (
          <Warning key={p.currency} text={t('cash.low', { pace: money(p.dailyAvg, p.currency), left: money(Math.max(0, p.balance), p.currency), days: p.daysCovered, tripDays: p.daysLeft })} />
        ))}
        {otherPace.length ? (
          <Body muted>{otherPace.map((p) => t('cash.pace', { pace: money(p.dailyAvg, p.currency), days: p.daysCovered })).join(' ')}</Body>
        ) : null}

        {/* Leftover cash */}
        {left.show ? <Leftover trip={trip} left={left} home={s.home} save={save} /> : null}

        {/* Add a withdrawal or exchange */}
        {form ? (
          <FadeInView>
            <MoveForm trip={trip} form={form} setForm={setForm} onSave={submit} />
          </FadeInView>
        ) : (
          <View style={{ gap: space.s }}>
            <Button icon="card-outline" label={t('cash.addWithdrawal')} hint={t('cash.addWithdrawalHint')} onPress={() => open('withdrawal')} />
            <Button kind="secondary" icon="swap-horizontal" label={t('cash.addExchange')} hint={t('cash.addExchangeHint')} onPress={() => open('exchange')} />
          </View>
        )}

        <StartCash trip={trip} save={save} />

        {/* Fees */}
        {fees.withdrawals ? (
          <SectionCard title={t('cash.fees.title')} icon="receipt-outline" tone="warn">
            <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
              {fees.avgHome != null && s.home ? t('cash.fees.avg', { amount: money(fees.avgHome, s.home) }) : t('cash.fees.none')}
            </Text>
            {fees.share != null ? <Body muted>{t('cash.fees.share', { pct: pct(fees.share) })}</Body> : null}
            <Body muted>{t('cash.fees.count', { n: fees.withdrawals, withFee: fees.withFee })}</Body>
            {fees.unconverted.length ? <Body muted>{t('cash.fees.unconverted', { amounts: fees.unconverted.map((m) => money(m.amount, m.currency)).join(', ') })}</Body> : null}
          </SectionCard>
        ) : null}

        <Counter trip={trip} save={save} />

        {/* History */}
        <SectionCard title={t('cash.history.title')} icon="time-outline" tone="sea">
          {history.length === 0 ? <Body muted>{t('cash.history.empty')}</Body> : null}
          {shown.map((m) => (
            <MoveRow key={m.id} trip={trip} m={m} title={describe(m)} onEdit={m.kind === 'count' ? undefined : () => edit(m)} onDelete={() => confirmDelete(m)} />
          ))}
          {history.length > HISTORY_SHOWN && !showAll ? (
            <Button kind="quiet" label={t('cash.history.showAll', { n: history.length })} hint={t('cash.history.showAllHint')} onPress={() => setShowAll(true)} />
          ) : null}
          <Body muted>{paidCount ? t('cash.paidCount', { n: paidCount }) : t('cash.paidNone')}</Body>
        </SectionCard>

        <Body muted>{t('cash.offline')}</Body>
      </FadeInView>
    </Screen>
  );
}

function MoveRow({ trip, m, title, onEdit, onDelete }: { trip: Trip; m: CashMove; title: string; onEdit?: () => void; onDelete: () => void }) {
  const { t, theme, lang } = useApp();
  const { budget, rates } = readSpending(trip);
  const home = budget?.currency ?? null;
  const day = formatDay(m.day, lang);
  const details: string[] = [day];
  if (m.kind !== 'count' && m.place) details.push(m.place);
  if (m.kind === 'withdrawal') {
    if (m.fee !== undefined && m.feeCurrency) details.push(t('cash.history.fee', { amount: formatMoney(m.fee, m.feeCurrency, lang) }));
    if (m.bankRate !== undefined && home) {
      const gap = bankRateGap(m.bankRate, rateFor(m.currency, home, rates));
      details.push(gap != null && Math.abs(gap) >= 0.001 ? t(gap > 0 ? 'cash.history.bankWorse' : 'cash.history.bankBetter', { rate: String(m.bankRate) }) : t('cash.history.bankRate', { rate: String(m.bankRate), home }));
    }
  }
  if (m.kind === 'count') details.push(t('cash.history.countNote'));
  const line = details.join(' · ');
  const body = (
    <View style={{ flex: 1 }}>
      <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{title}</Text>
      <Text style={[typeScale.small, { color: theme.muted }]}>{line}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.xs }}>
      {onEdit ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={`${title}, ${line}`} accessibilityHint={t('cash.history.editHint')} onPress={onEdit} style={{ flex: 1 }}>
          {body}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={`${title}, ${line}`} style={{ flex: 1, minHeight: TOUCH, justifyContent: 'center' }}>
          {body}
        </View>
      )}
      <PressableScale accessibilityRole="button" accessibilityLabel={t('cash.history.deleteA11y', { what: title })} accessibilityHint={t('cash.history.deleteHint')} onPress={onDelete} style={{ width: TOUCH, alignItems: 'center' }}>
        <Ionicons name="trash-outline" size={20} color={theme.danger} />
      </PressableScale>
    </View>
  );
}

function CurrencyPicker({ label, value, choices, onChange, error }: { label: string; value: string; choices: string[]; onChange: (v: string) => void; error?: string }) {
  const { t } = useApp();
  return (
    <View style={{ gap: space.s }}>
      <Label>{label}</Label>
      {choices.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={label}>
          {choices.map((c) => (
            <Chip key={c} label={c} selected={cleanCurrency(value) === c} onPress={() => onChange(c)} />
          ))}
        </View>
      ) : null}
      <TextField label={t('cash.form.code', { what: label })} value={value} onChange={(v) => onChange(v.toUpperCase().slice(0, 3))} placeholder={t('cash.form.codePlaceholder')} autoCapitalize="none" error={error} />
    </View>
  );
}

function MoveForm({ trip, form, setForm, onSave }: { trip: Trip; form: Form; setForm: (f: Form | null) => void; onSave: () => void }) {
  const { t, theme, lang } = useApp();
  const d = form.draft;
  const set = (patch: Partial<MoveDraft>) => setForm({ ...form, draft: { ...d, ...patch } });
  const choices = useMemo(() => cashCurrencyChoices(trip), [trip]);
  const home = readSpending(trip).budget?.currency ?? null;
  const err = (e: MoveError) => form.errors.includes(e);
  const code = cleanCurrency(d.currency);
  const to = cleanCurrency(d.toCurrency);
  const amountErr = (c: string) => (isCurrency(c) ? t('cash.err.amount', { code: c, n: currencyDigits(c) }) : t('cash.err.amountNoCode'));
  const first = d.day < trip.startDate ? d.day : trip.startDate;
  const last = d.day > trip.endDate ? d.day : trip.endDate;
  const dayLabel = formatDay(d.day, lang);
  const withdrawal = d.kind === 'withdrawal';
  return (
    <SectionCard title={form.prev ? t(withdrawal ? 'cash.form.editWithdrawal' : 'cash.form.editExchange') : t(withdrawal ? 'cash.form.newWithdrawal' : 'cash.form.newExchange')} icon={withdrawal ? 'card-outline' : 'swap-horizontal'} tone="accent">
      <CurrencyPicker label={withdrawal ? t('cash.form.currency') : t('cash.form.fromCurrency')} value={d.currency} choices={choices} onChange={(v) => set({ currency: v })} error={err('currency') ? t('cash.err.currency') : undefined} />
      <TextField label={withdrawal ? t('cash.form.amount') : t('cash.form.gave')} value={d.amount} onChange={(v) => set({ amount: v })} placeholder={t('cash.form.amountPlaceholder')} inputMode="decimal" error={err('amount') ? amountErr(code) : undefined} />
      {withdrawal ? (
        <>
          <TextField label={t('cash.form.fee')} value={d.fee} onChange={(v) => set({ fee: v })} placeholder={t('cash.form.feePlaceholder')} inputMode="decimal" error={err('fee') ? amountErr(cleanCurrency(d.feeCurrency)) : undefined} />
          <CurrencyPicker
            label={t('cash.form.feeCurrency')}
            value={d.feeCurrency}
            choices={[...new Set([home, code].filter((x): x is string => !!x && isCurrency(x)))]}
            onChange={(v) => set({ feeCurrency: v })}
            error={err('feeCurrency') ? t('cash.err.currency') : undefined}
          />
          <TextField
            label={home && isCurrency(code) ? t('cash.form.bankRate', { code, home }) : t('cash.form.bankRateNoHome')}
            value={d.bankRate}
            onChange={(v) => set({ bankRate: v })}
            placeholder={t('cash.form.bankRatePlaceholder')}
            inputMode="decimal"
            error={err('bankRate') ? t('cash.err.bankRate') : undefined}
          />
        </>
      ) : (
        <>
          <CurrencyPicker label={t('cash.form.toCurrency')} value={d.toCurrency} choices={choices.filter((c) => c !== code)} onChange={(v) => set({ toCurrency: v })} error={err('toCurrency') ? t('cash.err.currency') : err('same') ? t('cash.err.same') : undefined} />
          <TextField label={t('cash.form.got')} value={d.toAmount} onChange={(v) => set({ toAmount: v })} placeholder={t('cash.form.amountPlaceholder')} inputMode="decimal" error={err('toAmount') ? amountErr(to) : undefined} />
        </>
      )}
      <TextField label={t('cash.form.place')} value={d.place} onChange={(v) => set({ place: v })} placeholder={t('cash.form.placePlaceholder')} />
      <Label>{t('cash.form.day')}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('cash.form.prevDay')}
          accessibilityHint={t('cash.form.dayHint')}
          accessibilityState={{ disabled: d.day <= first }}
          disabled={d.day <= first}
          onPress={() => set({ day: addDays(d.day, -1) })}
          style={{ width: TOUCH, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, opacity: d.day <= first ? 0.4 : 1 }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.ink} />
        </PressableScale>
        <View accessible accessibilityLabel={t('cash.form.dayA11y', { day: dayLabel })} accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{dayLabel}</Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('cash.form.nextDay')}
          accessibilityHint={t('cash.form.dayHint')}
          accessibilityState={{ disabled: d.day >= last }}
          disabled={d.day >= last}
          onPress={() => set({ day: addDays(d.day, 1) })}
          style={{ width: TOUCH, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, opacity: d.day >= last ? 0.4 : 1 }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.ink} />
        </PressableScale>
      </View>
      {err('day') ? <Text style={[typeScale.small, { color: theme.danger }]}>{t('cash.err.day')}</Text> : null}
      {withdrawal ? <Body muted>{t('cash.form.feeNote')}</Body> : null}
      <Button label={t('cash.form.save')} hint={t('cash.form.saveHint')} icon="checkmark" onPress={onSave} />
      <Button label={t('common.cancel')} hint={t('cash.form.cancelHint')} kind="quiet" onPress={() => setForm(null)} />
    </SectionCard>
  );
}

function StartCash({ trip, save }: { trip: Trip; save: (t: Trip) => Promise<boolean> }) {
  const { t, theme, lang } = useApp();
  const { start } = readCash(trip);
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<'currency' | 'amount' | null>(null);
  const choices = useMemo(() => cashCurrencyChoices(trip), [trip]);
  const begin = (code: string, minor?: number) => {
    setCurrency(code);
    setAmount(minor !== undefined ? minorToText(minor, code) : '');
    setError(null);
    setOpen(true);
  };
  const submit = async () => {
    const code = cleanCurrency(currency);
    if (!isCurrency(code)) return setError('currency');
    const trimmed = amount.trim();
    const zero = trimmed === '' || /^0+([.,]0*)?$/.test(trimmed);
    const minor = zero ? null : parseAmount(trimmed, code);
    if (!zero && minor == null) return setError('amount');
    if (await save(setStartCash(trip, code, minor))) {
      setOpen(false);
      AccessibilityInfo.announceForAccessibility(t('cash.start.saved'));
    }
  };
  return (
    <SectionCard title={t('cash.start.title')} subtitle={t('cash.start.body')} icon="wallet-outline" tone="teal">
      {start.map((x) => (
        <PressableScale
          key={x.currency}
          accessibilityRole="button"
          accessibilityLabel={t('cash.start.rowA11y', { amount: formatMoney(x.amount, x.currency, lang) })}
          accessibilityHint={t('cash.start.rowHint')}
          onPress={() => begin(x.currency, x.amount)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, borderTopWidth: 1, borderTopColor: theme.line }}
        >
          <Text style={[typeScale.bodyStrong, { color: theme.muted, width: 48 }]}>{x.currency}</Text>
          <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink, fontVariant: ['tabular-nums'] }]}>{formatMoney(x.amount, x.currency, lang)}</Text>
          <Ionicons name="create-outline" size={18} color={theme.muted} />
        </PressableScale>
      ))}
      {open ? (
        <FadeInView style={{ gap: space.m }}>
          <CurrencyPicker label={t('cash.start.currency')} value={currency} choices={choices} onChange={setCurrency} error={error === 'currency' ? t('cash.err.currency') : undefined} />
          <TextField
            label={t('cash.start.amount')}
            value={amount}
            onChange={setAmount}
            placeholder={t('cash.form.amountPlaceholder')}
            inputMode="decimal"
            error={error === 'amount' ? (isCurrency(cleanCurrency(currency)) ? t('cash.err.amount', { code: cleanCurrency(currency), n: currencyDigits(cleanCurrency(currency)) }) : t('cash.err.amountNoCode')) : undefined}
          />
          <Body muted>{t('cash.start.clearNote')}</Body>
          <Button label={t('cash.start.save')} hint={t('cash.start.saveHint')} icon="checkmark" onPress={submit} />
          <Button label={t('common.cancel')} hint={t('cash.form.cancelHint')} kind="quiet" onPress={() => setOpen(false)} />
        </FadeInView>
      ) : (
        <Button kind="secondary" icon="add" label={t('cash.start.add')} hint={t('cash.start.addHint')} onPress={() => begin(suggestCashCurrency(trip))} />
      )}
    </SectionCard>
  );
}

function Leftover({ trip, left, home, save }: { trip: Trip; left: ReturnType<typeof leftoverSummary>; home: string | null; save: (t: Trip) => Promise<boolean> }) {
  const { t, theme, lang } = useApp();
  return (
    <SectionCard title={t('cash.leftover.title')} subtitle={t('cash.leftover.body')} icon="airplane-outline" tone="teal">
      {left.rows.map((r) => {
        const amount = formatMoney(r.amount, r.currency, lang);
        const value = r.foreign && r.home != null && home ? t('cash.approx', { amount: formatMoney(r.home, home, lang) }) : r.foreign && home ? t('cash.noRate') : null;
        return (
          <View key={r.currency} style={{ gap: space.s, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}>
            <View accessible accessibilityLabel={[amount, value].filter(Boolean).join(', ')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink, fontVariant: ['tabular-nums'] }]}>{amount}</Text>
              {value ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{value}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('cash.leftover.pickA11y', { amount })}>
              {leftoverChoicesFor(r.currency, home).map((c) => (
                <Chip
                  key={c}
                  label={t(CHOICE_KEYS[c])}
                  a11yLabel={t('cash.leftover.choiceA11y', { choice: t(CHOICE_KEYS[c]), amount })}
                  hint={t('cash.leftover.choiceHint')}
                  selected={r.choice === c}
                  onPress={() => save(setLeftoverChoice(trip, r.currency, r.choice === c ? null : c))}
                />
              ))}
            </View>
          </View>
        );
      })}
      {left.totalHome != null && home ? <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('cash.total', { amount: formatMoney(left.totalHome, home, lang) })}</Text> : null}
      <Body muted>{t('cash.leftover.tip')}</Body>
    </SectionCard>
  );
}

function Counter({ trip, save }: { trip: Trip; save: (t: Trip) => Promise<boolean> }) {
  const { t, theme, lang } = useApp();
  const [currency, setCurrency] = useState(() => countCurrencyFor(trip));
  const [counts, setCounts] = useState<Counts>({});
  const [open, setOpen] = useState(false);
  const list = denominationsFor(currency) ?? [];
  const total = countTotal(currency, counts);
  const money = (minor: number) => formatMoney(minor, currency, lang);
  const pick = (c: string) => {
    setCurrency(c);
    setCounts({});
    save(setCountCurrency(trip, c));
  };
  const useCount = () =>
    Alert.alert(t('cash.count.useTitle'), t('cash.count.useBody', { amount: money(total.total) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cash.count.use'),
        onPress: async () => {
          const next = recordCount(trip, currency, total.total, newId('cash'), todayIn(deviceZone()));
          if (next === trip || (await save(next))) {
            setCounts({});
            AccessibilityInfo.announceForAccessibility(t('cash.count.used'));
          }
        },
      },
    ]);
  return (
    <SectionCard title={t('cash.count.title')} subtitle={t('cash.count.body')} icon="calculator-outline" tone="accent">
      {!open ? (
        <Button kind="secondary" icon="calculator-outline" label={t('cash.count.open')} hint={t('cash.count.openHint')} onPress={() => setOpen(true)} />
      ) : (
        <FadeInView style={{ gap: space.m }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('cash.count.currency')}>
            {countCurrencies(trip).map((c) => (
              <Chip key={c} label={c} selected={c === currency} onPress={() => pick(c)} hint={t('cash.count.currencyHint')} />
            ))}
          </View>
          {(['note', 'coin'] as const).map((kind) => {
            const items = list.filter((d) => d.kind === kind);
            if (!items.length) return null;
            return (
              <View key={kind} style={{ gap: space.xs }}>
                <View accessible accessibilityRole="header">
                  <Label>{kind === 'note' ? t('cash.count.notes') : t('cash.count.coins')}</Label>
                </View>
                {items.map((d) => {
                  const key = denomKey(d);
                  const n = counts[key] ?? 0;
                  const face = money(d.value);
                  return (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                      <Text style={[typeScale.bodyStrong, { flex: 1, color: theme.ink, fontVariant: ['tabular-nums'] }]}>{face}</Text>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={t('cash.count.less', { face })}
                        accessibilityState={{ disabled: n === 0 }}
                        disabled={n === 0}
                        onPress={() => setCounts((c) => bumpCount(c, key, -1))}
                        style={{ width: TOUCH, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, opacity: n === 0 ? 0.4 : 1 }}
                      >
                        <Ionicons name="remove" size={20} color={theme.ink} />
                      </PressableScale>
                      <Text accessibilityLiveRegion="polite" accessibilityLabel={t('cash.count.pieces', { face, n })} style={[typeScale.title, { width: 52, textAlign: 'center', color: theme.ink, fontVariant: ['tabular-nums'] }]}>
                        {n}
                      </Text>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={t('cash.count.more', { face })}
                        onPress={() => setCounts((c) => bumpCount(c, key, 1))}
                        style={{ width: TOUCH, alignItems: 'center', borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
                      >
                        <Ionicons name="add" size={20} color={theme.sea} />
                      </PressableScale>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View accessible accessibilityLiveRegion="polite" accessibilityLabel={t('cash.count.totalA11y', { total: money(total.total), notes: money(total.notes), coins: money(total.coins) })} style={{ gap: 2 }}>
            <Text style={[typeScale.displayM, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{money(total.total)}</Text>
            <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{t('cash.count.split', { notes: money(total.notes), coins: money(total.coins) })}</Text>
          </View>
          <Button icon="checkmark" label={t('cash.count.use')} hint={t('cash.count.useHint')} onPress={useCount} />
          <Button kind="quiet" label={t('cash.count.reset')} hint={t('cash.count.resetHint')} onPress={() => setCounts({})} />
          <Body muted>{t('cash.count.recheck')}</Body>
        </FadeInView>
      )}
    </SectionCard>
  );
}
