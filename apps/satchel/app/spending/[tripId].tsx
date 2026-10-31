// Trip spending (T54): budget progress and totals, add / edit / delete expenses (delete asks first), totals by
// category and by day, then the exchange rates and the budget itself. Free, offline, stored on the trip.
// A rate saved here is stamped with today's date (src/core/convert.ts setRateOn, T63), so the Wallet converter shows
// how old the rate is.
// Rates are typed by the traveller; spending in a currency with no rate is shown in its own currency and left out of
// the home total with an "add a rate" prompt, never converted with a guessed rate.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setRateOn } from '../../src/core/convert.ts';
import { deviceZone, formatDay, todayIn } from '../../src/core/format.ts';
import { EXPENSE_CATEGORIES, newId, type Expense, type ExpenseCategory, type Trip } from '../../src/core/model.ts';
import {
  budgetStatus,
  cleanCurrency,
  convertMinor,
  currencyChoices,
  currencyDigits,
  defaultDay,
  draftFromExpense,
  expenseFromDraft,
  foreignCurrencies,
  formatMoney,
  isCurrency,
  minorToText,
  newExpenseDraft,
  parseAmount,
  parseRate,
  rateFor,
  rateToText,
  readSpending,
  removeExpense,
  setBudget,
  sortExpenses,
  suggestCurrency,
  total,
  totalsByCategory,
  totalsByDay,
  upsertExpense,
  validateExpense,
  type ExpenseDraft,
  type ExpenseError,
  type Spending,
  type Total,
} from '../../src/core/spending.ts';
import {
  keepUnknown,
  ME,
  newTogetherDraft,
  peopleOf,
  resolveExpense,
  splitFromDraft,
  togetherDraftFromExpense,
  validateTogether,
  withSplit,
  type TogetherDraft,
  type TogetherError,
} from '../../src/core/together.ts';
import { addDays } from '../../src/core/tz.ts';
import type { Key } from '../../src/i18n/en.ts';
import { phoneCurrency } from '../../src/native/device.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, TOUCH, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, IconBadge, ProgressBar, type IconName, type Tone } from '../../src/ui/hero.tsx';
import { Body, Button, Card, Chip, EmptyState, Label, PressableScale, Screen, TextField, Warning } from '../../src/ui/kit.tsx';
import { expenseTogetherLine, PayerSplitFields, TogetherSection, usePeople, type People } from '../../src/ui/together.tsx';

const CATEGORY_KEYS: Record<ExpenseCategory, Key> = {
  food: 'spending.cat.food',
  transport: 'spending.cat.transport',
  stay: 'spending.cat.stay',
  activities: 'spending.cat.activities',
  shopping: 'spending.cat.shopping',
  other: 'spending.cat.other',
};
const CATEGORY_ICONS: Record<ExpenseCategory, IconName> = {
  food: 'restaurant-outline',
  transport: 'bus-outline',
  stay: 'bed-outline',
  activities: 'ticket-outline',
  shopping: 'bag-handle-outline',
  other: 'ellipsis-horizontal-circle-outline',
};
const CATEGORY_TONES: Record<ExpenseCategory, Tone> = { food: 'accent', transport: 'sea', stay: 'teal', activities: 'ok', shopping: 'warn', other: 'ink' };

// T82: `together` holds the paid-by / split fields (used when the trip has companions).
type Form = { prev?: Expense; draft: ExpenseDraft; errors: ExpenseError[]; together: TogetherDraft; togetherErrors: TogetherError[] };

export default function SpendingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('spending.title')} body={t('spending.notFound')} />
      </Screen>
    );
  }
  return <SpendingBody trip={trip} />;
}

function SpendingBody({ trip }: { trip: Trip }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const { saveTrip } = useTrips();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Expense>>(null);
  const s = useMemo(() => readSpending(trip), [trip]);
  const home = s.budget?.currency ?? null;
  const sorted = useMemo(() => sortExpenses(s.expenses), [s]);
  const sum = useMemo(() => total(s.expenses, home, s.rates), [s, home]);
  const [form, setForm] = useState<Form | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const money = useCallback((minor: number, code: string) => formatMoney(minor, code, lang), [lang]);
  const people = usePeople(trip);

  /** Stores the changed trip; says so when the phone couldn't save it. */
  const save = async (next: Trip): Promise<boolean> => {
    const ok = await saveTrip(next);
    if (!ok) Alert.alert(t('error.trips.save.title'), t('error.trips.save.body'));
    return ok;
  };

  const openNew = () => {
    setForm({ draft: newExpenseDraft(defaultDay(trip, todayIn(deviceZone())), suggestCurrency(s, phoneCurrency())), errors: [], together: newTogetherDraft(trip), togetherErrors: [] });
    list.current?.scrollToOffset({ offset: 0, animated: !reduceMotion });
  };
  const openEdit = useCallback(
    (e: Expense) => {
      setForm({ prev: e, draft: draftFromExpense(e), errors: [], together: togetherDraftFromExpense(trip, e), togetherErrors: [] });
      list.current?.scrollToOffset({ offset: 0, animated: !reduceMotion });
    },
    [reduceMotion, trip],
  );
  const toRates = () => list.current?.scrollToEnd({ animated: !reduceMotion });

  const submit = async () => {
    if (!form) return;
    const errors = validateExpense(form.draft);
    const order = peopleOf(trip);
    const shared = order.length > 1;
    const code = cleanCurrency(form.draft.currency);
    // Someone removed while the form was open drops out of it (what they paid falls back to You).
    const tg: TogetherDraft = { ...form.together, paidBy: order.includes(form.together.paidBy) ? form.together.paidBy : ME, people: form.together.people.filter((p) => order.includes(p)) };
    const togetherErrors = shared ? validateTogether(tg, isCurrency(code) ? parseAmount(form.draft.amount, code) : null, code) : [];
    if (errors.length || togetherErrors.length) {
      setForm({ ...form, errors, together: tg, togetherErrors });
      AccessibilityInfo.announceForAccessibility(t('spec.form.checkFields'));
      return;
    }
    const plain = expenseFromDraft(form.draft, newId('exp'), form.prev);
    const e = keepUnknown(form.prev, shared ? withSplit(plain, tg.paidBy, splitFromDraft(tg, plain.currency)) : withSplit(plain, ME, null));
    if (await save(upsertExpense(trip, e))) {
      setForm(null);
      AccessibilityInfo.announceForAccessibility(t('spending.form.saved'));
    }
  };

  const describe = useCallback((e: Expense) => ({ amount: money(e.amount, e.currency), category: t(CATEGORY_KEYS[e.category]), day: formatDay(e.day, lang) }), [money, t, lang]);

  const confirmDelete = useCallback(
    (e: Expense) => {
      const d = describe(e);
      Alert.alert(t('spending.deleteTitle'), t('spending.deleteBody', d), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (await save(removeExpense(trip, e.id))) {
              setForm((f) => (f?.prev?.id === e.id ? null : f));
              AccessibilityInfo.announceForAccessibility(t('spending.deleted'));
            }
          },
        },
      ]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip, describe, t],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Expense; index: number }) => (
      <ExpenseRow
        expense={item}
        firstOfDay={index === 0 || sorted[index - 1].day !== item.day}
        home={home}
        rates={s.rates}
        onEdit={openEdit}
        onDelete={confirmDelete}
        togetherLine={togetherLine(item, people, t)}
      />
    ),
    [sorted, home, s.rates, openEdit, confirmDelete, people, t],
  );

  const header = (
    <View style={{ gap: space.m, marginBottom: space.s }}>
      <Summary s={s} sum={sum} home={home} onRates={toRates} onBudget={() => { setEditingBudget(true); toRates(); }} />
      {form ? (
        <FadeInView>
          <ExpenseForm trip={trip} s={s} form={form} setForm={setForm} onSave={submit} />
        </FadeInView>
      ) : (
        <Button label={t('spending.add')} hint={t('spending.addHint')} icon="add" onPress={openNew} />
      )}
      <TogetherSection trip={trip} save={save} />
      {sorted.length ? (
        <View accessible accessibilityRole="header">
          <Label>{t('spending.list')}</Label>
        </View>
      ) : (
        <EmptyState art="coins" title={t('spending.emptyTitle')} body={t('spending.emptyBody')} />
      )}
    </View>
  );

  const footer = (
    <View style={{ gap: space.m, marginTop: space.m }}>
      {sorted.length ? <Breakdowns s={s} home={home} sumHome={sum.home} /> : null}
      <Rates trip={trip} s={s} home={home} save={save} />
      <BudgetCard trip={trip} s={s} editing={editingBudget} setEditing={setEditingBudget} save={save} />
      <Body muted>{t('spending.offline')}</Body>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('spending.title') }} />
      <FlatList
        ref={list}
        style={{ flex: 1, backgroundColor: theme.paper }}
        contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.s }}
        data={sorted}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      />
    </>
  );
}

/** Total (in home when set), budget progress, and which currencies are waiting for a rate. */
function Summary({ s, sum, home, onRates, onBudget }: { s: Spending; sum: Total; home: string | null; onRates: () => void; onBudget: () => void }) {
  const { t, theme, lang } = useApp();
  const status = budgetStatus(s);
  const money = (minor: number, code: string) => formatMoney(minor, code, lang);
  const tone: Tone = status?.over ? 'danger' : status?.near ? 'warn' : 'ok';
  const count = sum.count === 1 ? t('spending.countOne') : t('spending.countMany', { n: sum.count });
  return (
    <Card style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="wallet-outline" tone={status ? tone : 'accent'} size="l" />
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.caption, { color: theme.muted }]}>{home ? t('spending.totalIn', { code: home }) : t('spending.total')}</Text>
          {home && sum.home != null ? (
            <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
              {money(sum.home, home)}
            </Text>
          ) : (
            <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
              {sum.perCurrency.length ? sum.perCurrency.map((m) => money(m.amount, m.currency)).join(' + ') : t('spending.emptyTitle')}
            </Text>
          )}
          <Text style={[typeScale.small, { color: theme.muted }]}>{count}</Text>
        </View>
      </View>
      {status && home ? (
        <View style={{ gap: space.xs }}>
          <ProgressBar progress={status.fraction} tone={tone} label={t('spending.progressA11y', { spent: money(status.spent, home), budget: money(status.budget, home) })} />
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('spending.slot.spentOf', { spent: money(status.spent, home), budget: money(status.budget, home) })}</Text>
          <Text style={[typeScale.bodyStrong, { color: status.over ? theme.danger : theme.ink }]}>
            {status.over ? t('spending.slot.over', { amount: money(-status.left, home) }) : t('spending.slot.left', { amount: money(status.left, home) })}
          </Text>
          {status.partial ? <Body muted>{t('spending.partial', { amount: money(status.spent, home) })}</Body> : null}
        </View>
      ) : null}
      {home && sum.missing.length ? (
        <View style={{ gap: space.s }}>
          <Warning
            text={t('spending.missing', {
              codes: sum.perCurrency.filter((m) => sum.missing.includes(m.currency)).map((m) => money(m.amount, m.currency)).join(', '),
            })}
          />
          <Button label={t('spending.addRate')} hint={t('spending.addRateHint')} kind="secondary" icon="swap-horizontal" onPress={onRates} />
        </View>
      ) : null}
      {!home ? (
        <View style={{ gap: space.s }}>
          <Body muted>{t('spending.noHome')}</Body>
          <Button label={t('spending.budget.set')} hint={t('spending.budget.editHint')} kind="secondary" icon="flag-outline" onPress={onBudget} />
        </View>
      ) : null}
    </Card>
  );
}

const ExpenseRow = memo(function ExpenseRow({
  expense: e,
  firstOfDay,
  home,
  rates,
  onEdit,
  onDelete,
  togetherLine,
}: {
  expense: Expense;
  firstOfDay: boolean;
  home: string | null;
  rates: Record<string, number>;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  /** T82: "Sam paid · split 3 ways" (null for a plain solo expense). */
  togetherLine?: string | null;
}) {
  const { t, theme, lang } = useApp();
  const amount = formatMoney(e.amount, e.currency, lang);
  const category = t(CATEGORY_KEYS[e.category]);
  const day = formatDay(e.day, lang);
  const rate = e.currency !== home ? rateFor(e.currency, home, rates) : null;
  const approx = rate != null && home ? t('spending.approx', { amount: formatMoney(convertMinor(e.amount, e.currency, rate, home), home, lang) }) : null;
  const a11y = e.note ? t('spending.row.noteA11y', { amount, category, day, note: e.note }) : t('spending.row.a11y', { amount, category, day });
  return (
    <View style={{ gap: space.xs }}>
      {firstOfDay ? (
        <View accessible accessibilityRole="header" style={{ marginTop: space.s }}>
          <Label>{day}</Label>
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.cardRaised,
          borderRadius: radius.m,
          borderWidth: 1,
          borderColor: theme.dark ? theme.line : theme.paper,
          paddingLeft: space.m,
        }}
      >
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={[a11y, approx, togetherLine].filter(Boolean).join(', ')}
          accessibilityHint={t('spending.row.hint')}
          onPress={() => onEdit(e)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s }}
        >
          <IconBadge name={CATEGORY_ICONS[e.category]} tone={CATEGORY_TONES[e.category]} size="s" />
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{amount}</Text>
            <Text numberOfLines={1} style={[typeScale.small, { color: theme.muted }]}>
              {e.note ? `${category} · ${e.note}` : category}
            </Text>
            {togetherLine ? (
              <Text numberOfLines={1} style={[typeScale.small, { color: theme.teal }]}>
                {togetherLine}
              </Text>
            ) : null}
          </View>
          {approx ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{approx}</Text> : null}
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('spending.deleteA11y', { amount, category })}
          accessibilityHint={t('spending.deleteHint')}
          onPress={() => onDelete(e)}
          style={{ width: TOUCH, alignItems: 'center' }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </PressableScale>
      </View>
    </View>
  );
});

function ExpenseForm({ trip, s, form, setForm, onSave }: { trip: Trip; s: Spending; form: Form; setForm: (f: Form | null) => void; onSave: () => void }) {
  const { t, theme, lang } = useApp();
  const d = form.draft;
  const set = (patch: Partial<ExpenseDraft>) => setForm({ ...form, draft: { ...d, ...patch } });
  const choices = useMemo(() => currencyChoices(s, phoneCurrency()), [s]);
  const code = cleanCurrency(d.currency);
  const first = d.day < trip.startDate ? d.day : trip.startDate;
  const last = d.day > trip.endDate ? d.day : trip.endDate;
  const err = (e: ExpenseError) => form.errors.includes(e);
  const amountError = err('amount')
    ? isCurrency(code)
      ? t('spending.err.amount', { code, n: currencyDigits(code) })
      : t('spending.err.amountNoCode')
    : undefined;
  const dayLabel = formatDay(d.day, lang);
  return (
    <Card style={{ gap: space.m }}>
      <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
        {form.prev ? t('spending.form.editTitle') : t('spending.form.newTitle')}
      </Text>
      <TextField label={t('spending.form.amount')} value={d.amount} onChange={(v) => set({ amount: v })} placeholder={t('spending.form.amountPlaceholder')} inputMode="decimal" error={amountError} />

      <Label>{t('spending.form.currency')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('spending.form.currency')}>
        {choices.map((c) => (
          <Chip key={c} label={c} selected={code === c} onPress={() => set({ currency: c })} />
        ))}
      </View>
      <TextField
        label={t('spending.form.currencyCode')}
        value={d.currency}
        onChange={(v) => set({ currency: v.toUpperCase().slice(0, 3) })}
        placeholder={t('spending.form.currencyPlaceholder')}
        autoCapitalize="none"
        error={err('currency') ? t('spending.err.currency') : undefined}
      />

      <Label>{t('spending.form.category')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('spending.form.category')}>
        {EXPENSE_CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={t(CATEGORY_KEYS[c])}
            selected={d.category === c}
            onPress={() => set({ category: c })}
            icon={<Ionicons name={CATEGORY_ICONS[c]} size={16} color={d.category === c ? theme.accentInk : theme.muted} />}
          />
        ))}
      </View>

      <Label>{t('spending.form.day')}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('spending.form.prevDay')}
          accessibilityHint={t('spending.form.dayHint')}
          accessibilityState={{ disabled: d.day <= first }}
          disabled={d.day <= first}
          onPress={() => set({ day: addDays(d.day, -1) })}
          style={{ width: TOUCH, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, opacity: d.day <= first ? 0.4 : 1 }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.ink} />
        </PressableScale>
        <View accessible accessibilityLabel={t('spending.form.dayA11y', { day: dayLabel })} accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{dayLabel}</Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('spending.form.nextDay')}
          accessibilityHint={t('spending.form.dayHint')}
          accessibilityState={{ disabled: d.day >= last }}
          disabled={d.day >= last}
          onPress={() => set({ day: addDays(d.day, 1) })}
          style={{ width: TOUCH, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line, opacity: d.day >= last ? 0.4 : 1 }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.ink} />
        </PressableScale>
      </View>
      {err('day') ? <Text style={[typeScale.small, { color: theme.danger }]}>{t('spending.err.day')}</Text> : null}

      {peopleOf(trip).length > 1 ? (
        <PayerSplitFields
          trip={trip}
          draft={form.together}
          onChange={(together) => setForm({ ...form, together, togetherErrors: [] })}
          amount={isCurrency(code) ? parseAmount(d.amount, code) : null}
          currency={isCurrency(code) ? code : ''}
          errors={form.togetherErrors}
        />
      ) : null}

      <TextField label={t('spending.form.note')} value={d.note} onChange={(v) => set({ note: v })} placeholder={t('spending.form.notePlaceholder')} />
      <Button label={t('spending.form.save')} hint={t('spending.form.saveHint')} icon="checkmark" onPress={onSave} />
      <Button label={t('common.cancel')} hint={t('spending.form.cancelHint')} kind="quiet" onPress={() => setForm(null)} />
    </Card>
  );
}

/** Totals by category (with each one's share of the home total) and by day. */
function Breakdowns({ s, home, sumHome }: { s: Spending; home: string | null; sumHome: number | null }) {
  const { t, theme, lang } = useApp();
  const money = (minor: number, code: string) => formatMoney(minor, code, lang);
  const cats = totalsByCategory(s.expenses, home, s.rates);
  const days = totalsByDay(s.expenses, home, s.rates);
  const line = (x: Total) => {
    const main = home && x.home != null ? money(x.home, home) : x.perCurrency.map((m) => money(m.amount, m.currency)).join(' + ');
    const extra = home && x.missing.length ? t('spending.missingShort', { codes: x.perCurrency.filter((m) => x.missing.includes(m.currency)).map((m) => money(m.amount, m.currency)).join(', ') }) : null;
    return { main, extra };
  };
  return (
    <>
      <Card style={{ gap: space.m }}>
        <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
          {t('spending.byCategory')}
        </Text>
        {cats.map((c) => {
          const { main, extra } = line(c);
          const label = t(CATEGORY_KEYS[c.category]);
          const share = home && sumHome && c.home != null ? c.home / sumHome : null;
          return (
            <View key={c.category} accessible accessibilityLabel={[label, main, extra].filter(Boolean).join(', ')} style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <IconBadge name={CATEGORY_ICONS[c.category]} tone={CATEGORY_TONES[c.category]} size="s" />
                <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{label}</Text>
                <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{main}</Text>
              </View>
              {share != null ? <ProgressBar progress={share} tone={CATEGORY_TONES[c.category]} label={label} /> : null}
              {extra ? <Text style={[typeScale.small, { color: theme.muted }]}>{extra}</Text> : null}
            </View>
          );
        })}
      </Card>
      <Card style={{ gap: space.s }}>
        <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
          {t('spending.byDay')}
        </Text>
        {days.map((d, i) => {
          const { main, extra } = line(d);
          const day = formatDay(d.day, lang);
          return (
            <View
              key={d.day}
              accessible
              accessibilityLabel={[day, main, extra].filter(Boolean).join(', ')}
              style={{ minHeight: TOUCH, justifyContent: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: theme.line, paddingVertical: space.xs }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <Text style={[typeScale.body, { flex: 1, color: theme.ink }]}>{day}</Text>
                <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{main}</Text>
              </View>
              {extra ? <Text style={[typeScale.small, { color: theme.muted }]}>{extra}</Text> : null}
            </View>
          );
        })}
      </Card>
    </>
  );
}

/** One field per currency the trip uses (plus any saved rate), typed as "1 foreign = x home". */
function Rates({ trip, s, home, save }: { trip: Trip; s: Spending; home: string | null; save: (t: Trip) => Promise<boolean> }) {
  const { t, theme } = useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const codes = [...new Set([...foreignCurrencies(s.expenses, home), ...Object.keys(s.rates)])].filter((c) => c !== home).sort();
  const value = (c: string) => drafts[c] ?? (s.rates[c] ? rateToText(s.rates[c]) : '');
  const commit = async (c: string) => {
    const rate = parseRate(value(c));
    if (rate == null) {
      setErrors((e) => (e.includes(c) ? e : [...e, c]));
      AccessibilityInfo.announceForAccessibility(t('spending.rates.err'));
      return;
    }
    if (await save(setRateOn(trip, c, rate, todayIn(deviceZone())))) {
      setErrors((e) => e.filter((x) => x !== c));
      setDrafts(({ [c]: _gone, ...rest }) => rest);
      AccessibilityInfo.announceForAccessibility(t('spending.rates.saved'));
    }
  };
  const clear = async (c: string) => {
    if (await save(setRateOn(trip, c, null, todayIn(deviceZone())))) setDrafts(({ [c]: _gone, ...rest }) => rest);
  };
  return (
    <Card style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="swap-horizontal" tone="sea" />
        <Text accessibilityRole="header" style={[typeScale.title, { flex: 1, color: theme.ink }]}>
          {t('spending.rates.title')}
        </Text>
      </View>
      {!home ? <Body muted>{t('spending.rates.needHome')}</Body> : codes.length === 0 ? <Body muted>{t('spending.rates.none', { home })}</Body> : <Body muted>{t('spending.rates.body', { home })}</Body>}
      {home
        ? codes.map((c) => {
            const has = s.rates[c] != null;
            return (
              <View key={c} style={{ gap: space.s, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.m }}>
                {!has ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                      <Ionicons name="alert-circle" size={16} color={theme.warn} />
                    </View>
                    <Text style={[typeScale.small, { color: theme.ink }]}>{t('spending.rates.missing')}</Text>
                  </View>
                ) : null}
                <TextField
                  label={t('spending.rates.label', { code: c, home })}
                  value={value(c)}
                  onChange={(v) => setDrafts((d) => ({ ...d, [c]: v }))}
                  placeholder={t('spending.rates.placeholder')}
                  inputMode="decimal"
                  error={errors.includes(c) ? t('spending.rates.err') : undefined}
                />
                <View style={{ flexDirection: 'row', gap: space.s }}>
                  <View style={{ flex: 1 }}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={t('spending.rates.saveA11y', { code: c })}
                      accessibilityHint={t('spending.rates.saveHint')}
                      onPress={() => commit(c)}
                      style={{ alignItems: 'center', borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
                    >
                      <Text style={[typeScale.bodyStrong, { color: theme.sea }]}>{t('spending.rates.save')}</Text>
                    </PressableScale>
                  </View>
                  {has ? (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={t('spending.rates.clearA11y', { code: c })}
                      accessibilityHint={t('spending.rates.clearHint')}
                      onPress={() => clear(c)}
                      style={{ width: TOUCH, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: theme.line }}
                    >
                      <Ionicons name="close" size={20} color={theme.muted} />
                    </PressableScale>
                  ) : null}
                </View>
              </View>
            );
          })
        : null}
    </Card>
  );
}

/** Home currency and optional limit. Changing home asks first (rates are cleared); removing asks first too. */
function BudgetCard({ trip, s, editing, setEditing, save }: { trip: Trip; s: Spending; editing: boolean; setEditing: (v: boolean) => void; save: (t: Trip) => Promise<boolean> }) {
  const { t, theme, lang } = useApp();
  const [currency, setCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<('currency' | 'amount')[]>([]);
  const [opened, setOpened] = useState(false);
  // Fill the fields each time the editor opens (also when the summary's "Set a budget" opens it).
  if (editing && !opened) {
    setOpened(true);
    setCurrency(s.budget?.currency ?? phoneCurrency() ?? '');
    setAmount(s.budget?.amount !== undefined ? minorToText(s.budget.amount, s.budget.currency) : '');
    setErrors([]);
  } else if (!editing && opened) {
    setOpened(false);
  }
  const submit = () => {
    const code = cleanCurrency(currency);
    const errs: ('currency' | 'amount')[] = [];
    if (!isCurrency(code)) errs.push('currency');
    const minor = amount.trim() === '' ? undefined : parseAmount(amount, isCurrency(code) ? code : 'USD');
    if (minor === null) errs.push('amount');
    setErrors(errs);
    if (errs.length) {
      AccessibilityInfo.announceForAccessibility(t('spec.form.checkFields'));
      return;
    }
    const apply = async () => {
      if (await save(setBudget(trip, minor === undefined ? { currency: code } : { currency: code, amount: minor as number }))) setEditing(false);
    };
    const old = s.budget?.currency;
    if (old && old !== code && Object.keys(s.rates).length) {
      Alert.alert(t('spending.budget.changeTitle'), t('spending.budget.changeBody', { old, code }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('spending.budget.change'), onPress: apply },
      ]);
    } else apply();
  };
  const remove = () =>
    Alert.alert(t('spending.budget.removeTitle'), t('spending.budget.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('spending.budget.remove'),
        style: 'destructive',
        onPress: async () => {
          const { rates: _r, ...rest } = setBudget(trip, null);
          if (await save(rest)) setEditing(false);
        },
      },
    ]);
  const b = s.budget;
  return (
    <Card style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <IconBadge name="flag-outline" tone="accent" />
        <Text accessibilityRole="header" style={[typeScale.title, { flex: 1, color: theme.ink }]}>
          {t('spending.budget.title')}
        </Text>
      </View>
      {editing ? (
        <FadeInView style={{ gap: space.m }}>
          <Body muted>{t('spending.budget.body')}</Body>
          <TextField
            label={t('spending.budget.currency')}
            value={currency}
            onChange={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
            placeholder={t('spending.budget.currencyPlaceholder')}
            autoCapitalize="none"
            error={errors.includes('currency') ? t('spending.budget.err.currency') : undefined}
          />
          <TextField
            label={t('spending.budget.amount')}
            value={amount}
            onChange={setAmount}
            placeholder={t('spending.budget.amountPlaceholder')}
            inputMode="decimal"
            error={errors.includes('amount') ? t('spending.budget.err.amount') : undefined}
          />
          <Button label={t('spending.budget.save')} hint={t('spending.budget.saveHint')} icon="checkmark" onPress={submit} />
          {b ? <Button label={t('spending.budget.remove')} hint={t('spending.budget.removeHint')} kind="quiet" onPress={remove} /> : null}
          <Button label={t('common.cancel')} hint={t('spending.form.cancelHint')} kind="quiet" onPress={() => setEditing(false)} />
        </FadeInView>
      ) : (
        <>
          <Text style={[typeScale.bodyStrong, { color: b ? theme.ink : theme.muted }]}>
            {!b ? t('spending.budget.none') : b.amount === undefined ? t('spending.budget.noLimit', { code: b.currency }) : t('spending.budget.current', { amount: formatMoney(b.amount, b.currency, lang), code: b.currency })}
          </Text>
          <Button label={b ? t('spending.budget.edit') : t('spending.budget.set')} hint={t('spending.budget.editHint')} kind="secondary" icon="create-outline" onPress={() => setEditing(true)} />
        </>
      )}
    </Card>
  );
}

/** T82: the expense row's "who paid / split" line for a shared expense, or null. */
function togetherLine(e: Expense, people: People, t: ReturnType<typeof useApp>['t']): string | null {
  const r = resolveExpense(e, people.order);
  return expenseTogetherLine(r.payer, r.shares.length, r.together, people, t);
}
