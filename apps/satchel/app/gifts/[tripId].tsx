// T107 Gifts and souvenirs: people to buy for (name, optional budget in home currency), each with gift ideas (what,
// where seen, price in the local currency, status idea / bought / packed, an optional map spot from a one-off
// location check or a saved place, an optional bag from the packing list with a weight). Progress per person and a
// budget bar (home values only with a saved rate). "Bought" offers to add a Shopping entry to Spending; "Packed"
// counts the gift in its bag's weight on the packing screen. A general-guidance customs reminder and a shared text
// list (no prices unless switched on). Logic in src/core/gifts.ts; stored on the trip (Trip.gifts) and in .satchel files.
// T112: a gift opened from its Map-tab pin is scrolled into view and highlighted (accent border, "From the map").
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatWeight } from '../../src/core/bags.ts';
import { deviceZone, todayIn } from '../../src/core/format.ts';
import { scrollTargetY } from '../../src/core/followups97.ts';
import {
  addGiftSpending,
  canAddSpending,
  draftFromGift,
  draftFromPerson,
  GIFT_STATUSES,
  giftBagChoices,
  giftFromDraft,
  giftsText,
  giftSpot,
  giftSummary,
  hasPrice,
  homeOf,
  linkedExpense,
  newGiftDraft,
  newPersonDraft,
  personFromDraft,
  personProgress,
  priceIn,
  readGifts,
  removeGift,
  removePerson,
  setGiftStatus,
  spendingDraftFor,
  upsertGift,
  upsertPerson,
  validateGift,
  validatePerson,
  type Gift,
  type GiftDraft,
  type GiftError,
  type GiftPerson,
  type GiftStatus,
  type PersonDraft,
  type PersonError,
} from '../../src/core/gifts.ts';
import { newId, type Trip } from '../../src/core/model.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, type PackStore } from '../../src/core/packing.ts';
import { encodePos, roundPos } from '../../src/core/position.ts';
import { cleanCurrency, currencyChoices, currencyDigits, defaultDay, expenseFromDraft, formatMoney, isCurrency, readSpending, suggestCurrency, type Money } from '../../src/core/spending.ts';
import type { Key } from '../../src/i18n/en.ts';
import { haptic } from '../../src/native/device.ts';
import { locateOnce } from '../../src/native/location.ts';
import { shareText } from '../../src/native/share.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { radius, space, typeScale } from '../../src/theme/tokens.ts';
import { bagName, useWeightUnit } from '../../src/ui/bags.tsx';
import { ErrorNotice } from '../../src/ui/ErrorNotice.tsx';
import { FadeInView, SectionCard } from '../../src/ui/hero.tsx';
import { Body, Button, Chip, EmptyState, Label, PressableScale, Screen, TextField, ToggleRow, Warning } from '../../src/ui/kit.tsx';
import { PositionField } from '../../src/ui/PositionField.tsx';

const STATUS_KEYS: Record<GiftStatus, Key> = { idea: 'gifts.status.idea', bought: 'gifts.status.bought', packed: 'gifts.status.packed' };
const STATUS_ICONS = { idea: 'bulb-outline', bought: 'bag-check-outline', packed: 'cube-outline' } as const;

type PersonForm = { prev?: GiftPerson; draft: PersonDraft; errors: PersonError[] };
type GiftForm = { personId: string; prev?: Gift; draft: GiftDraft; errors: GiftError[] };

export default function GiftsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useApp();
  const { trips } = useTrips();
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <Screen>
        <EmptyState art="magnifier" title={t('gifts.title')} body={t('gifts.notFound')} />
      </Screen>
    );
  }
  return <GiftsBody trip={trip} />;
}

function GiftsBody({ trip }: { trip: Trip }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  // T112: the gift opened from the Map tab, scrolled to and highlighted while its editor is open.
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const [focusGift, setFocusGift] = useState<string | null>(null);
  const scrollToGift = (giftWindowY: number) =>
    scroll.current?.measureInWindow((_x, y) => scroll.current?.scrollTo({ y: scrollTargetY(scrollY.current, giftWindowY, y, space.l), animated: !reduceMotion }));
  const { saveTrip } = useTrips();
  const router = useRouter();
  const people = useMemo(() => readGifts(trip), [trip]);
  const summary = useMemo(() => giftSummary(trip), [trip]);
  const home = homeOf(trip);
  const [personForm, setPersonForm] = useState<PersonForm | null>(null);
  const [giftForm, setGiftForm] = useState<GiftForm | null>(null);
  const money = (m: Money) => formatMoney(m.amount, m.currency, lang);
  const unit = useWeightUnit();

  // T108: a gift pin tapped on the Map tab opens that gift's editor (once per tap; ?open changes each time).
  const params = useLocalSearchParams<{ personId?: string; giftId?: string; open?: string }>();
  const opened = useRef<string | null>(null);
  useEffect(() => {
    const { personId, giftId, open } = params;
    if (typeof personId !== 'string' || typeof giftId !== 'string' || !giftId || opened.current === `${open ?? ''}:${giftId}`) return;
    opened.current = `${open ?? ''}:${giftId}`;
    const g = people.find((p) => p.id === personId)?.gifts.find((x) => x.id === giftId);
    if (!g) return;
    setGiftForm({ personId, prev: g, draft: draftFromGift(g, unit, lang), errors: [] });
    setFocusGift(g.id);
    AccessibilityInfo.announceForAccessibility(t('f96.gift.opened', { what: g.what }));
  }, [params, people, unit, lang, t]);

  const save = async (next: Trip): Promise<boolean> => {
    const ok = await saveTrip(next);
    if (!ok) Alert.alert(t('error.trips.save.title'), t('error.trips.save.body'));
    return ok;
  };

  const submitPerson = async () => {
    if (!personForm) return;
    const errors = validatePerson(personForm.draft, home);
    if (errors.length) {
      setPersonForm({ ...personForm, errors });
      AccessibilityInfo.announceForAccessibility(t('gifts.err.check'));
      return;
    }
    if (await save(upsertPerson(trip, personFromDraft(personForm.draft, home, newId, personForm.prev)))) {
      setPersonForm(null);
      haptic.success();
      AccessibilityInfo.announceForAccessibility(t('gifts.person.saved'));
    }
  };

  const confirmRemovePerson = (p: GiftPerson) =>
    Alert.alert(t('gifts.person.deleteTitle', { name: p.name }), t('gifts.person.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('gifts.person.delete'),
        style: 'destructive',
        onPress: async () => {
          if (await save(removePerson(trip, p.id))) {
            setPersonForm(null);
            setGiftForm((f) => (f?.personId === p.id ? null : f));
            AccessibilityInfo.announceForAccessibility(t('gifts.person.deleted'));
          }
        },
      },
    ]);

  const offerSpending = (next: Trip, p: GiftPerson, g: Gift) => {
    const amount = hasPrice(g) ? money({ currency: g.currency, amount: g.price }) : '';
    Alert.alert(t('gifts.spend.title'), t('gifts.spend.body', { amount, what: g.what }), [
      { text: t('gifts.spend.notNow'), style: 'cancel' },
      { text: t('gifts.spend.add'), onPress: () => addSpending(next, p, g) },
    ]);
  };

  const addSpending = async (base: Trip, p: GiftPerson, g: Gift) => {
    const day = defaultDay(base, todayIn(deviceZone()));
    const draft = spendingDraftFor(g, day, t('gifts.spend.note', { name: p.name, what: g.what }));
    if (!draft) return;
    const e = expenseFromDraft(draft, newId('exp'));
    if (await save(addGiftSpending(base, p.id, g.id, e))) {
      haptic.success();
      AccessibilityInfo.announceForAccessibility(t('gifts.spend.added'));
    }
  };

  const changeStatus = async (p: GiftPerson, g: Gift, status: GiftStatus) => {
    const next = setGiftStatus(trip, p.id, g.id, status);
    if (next === trip) return;
    if (!(await save(next))) return;
    AccessibilityInfo.announceForAccessibility(t('gifts.status.changed', { what: g.what, status: t(STATUS_KEYS[status]) }));
    if (status === 'bought' && canAddSpending(next, g)) offerSpending(next, p, g);
  };

  return (
    <ScrollView
      ref={scroll}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={32}
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l }}
    >
      <Stack.Screen options={{ title: t('gifts.title') }} />

      <SectionCard title={t('gifts.summary.title')} subtitle={t('gifts.summary.sub')} icon="gift-outline" tone="accent">
        {summary.total ? (
          <View accessible style={{ gap: space.xs }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('gifts.summary.counts', { got: summary.got, total: summary.total, packed: summary.packed })}</Text>
            {home && summary.sums.gotHome != null ? <Body>{t('gifts.summary.got', { amount: money({ currency: home, amount: summary.sums.gotHome }) })}</Body> : null}
            {home && summary.sums.plannedHome != null ? <Body muted>{t('gifts.summary.planned', { amount: money({ currency: home, amount: summary.sums.plannedHome }) })}</Body> : null}
          </View>
        ) : null}
        {summary.sums.missing.length ? <Body muted>{t('gifts.summary.missing', { codes: summary.sums.missing.join(', ') })}</Body> : null}
        {!home ? <Body muted>{t('gifts.summary.noHome')}</Body> : null}
        {!home || summary.sums.missing.length ? (
          <Button kind="quiet" icon="swap-horizontal-outline" label={t('gifts.toSpending')} hint={t('gifts.toSpendingHint')} onPress={() => router.push(`/spending/${trip.id}`)} />
        ) : null}
      </SectionCard>

      {people.length === 0 && !personForm ? <EmptyState art="suitcase" title={t('gifts.emptyTitle')} body={t('gifts.emptyBody')} /> : null}

      {people.map((p) => (
        <PersonCard
          key={p.id}
          trip={trip}
          person={p}
          home={home}
          giftForm={giftForm?.personId === p.id ? giftForm : null}
          setGiftForm={setGiftForm}
          focusGift={giftForm?.prev?.id === focusGift ? focusGift : null}
          onFocusLocated={scrollToGift}
          onEditPerson={() => setPersonForm({ prev: p, draft: draftFromPerson(p), errors: [] })}
          onStatus={(g, s) => changeStatus(p, g, s)}
          onAddSpending={(g) => offerSpending(trip, p, g)}
          save={save}
        />
      ))}

      {personForm ? (
        <FadeInView>
          <SectionCard title={t(personForm.prev ? 'gifts.person.edit' : 'gifts.person.new')} icon="person-outline" tone="sea">
            <TextField
              label={t('gifts.person.name')}
              value={personForm.draft.name}
              onChange={(name) => setPersonForm({ ...personForm, draft: { ...personForm.draft, name } })}
              placeholder={t('gifts.person.namePlaceholder')}
              autoCapitalize="words"
              error={personForm.errors.includes('name') ? t('gifts.err.name') : undefined}
            />
            <TextField
              label={home ? t('gifts.person.budget', { home }) : t('gifts.person.budgetNoHome')}
              value={personForm.draft.budget}
              onChange={(budget) => setPersonForm({ ...personForm, draft: { ...personForm.draft, budget } })}
              placeholder={t('gifts.person.budgetPlaceholder')}
              inputMode="decimal"
              error={personForm.errors.includes('home') ? t('gifts.err.home') : personForm.errors.includes('budget') && home ? t('gifts.err.budget', { home }) : undefined}
            />
            <Button label={t('gifts.person.save')} hint={t('gifts.person.saveHint')} icon="checkmark" onPress={submitPerson} />
            {personForm.prev ? (
              <Button label={t('gifts.person.delete')} hint={t('gifts.person.deleteHint')} kind="quiet" icon="trash-outline" onPress={() => personForm.prev && confirmRemovePerson(personForm.prev)} />
            ) : null}
            <Button label={t('common.cancel')} hint={t('gifts.person.cancelHint')} kind="quiet" onPress={() => setPersonForm(null)} />
          </SectionCard>
        </FadeInView>
      ) : (
        <Button kind="secondary" icon="person-add-outline" label={t('gifts.person.add')} hint={t('gifts.person.addHint')} onPress={() => setPersonForm({ draft: newPersonDraft(), errors: [] })} />
      )}

      <CustomsCard />
      <ShareCard trip={trip} />
    </ScrollView>
  );
}

/** A thin progress bar in theme colours (a static width, nothing animates). */
function Bar({ value, label, over }: { value: number; label: string; over?: boolean }) {
  const { theme } = useApp();
  const p = Math.min(1, Math.max(0, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={{ height: 8, borderRadius: radius.pill, backgroundColor: theme.line, overflow: 'hidden' }}
    >
      <View style={{ height: 8, width: `${Math.round(p * 100)}%`, borderRadius: radius.pill, backgroundColor: over ? theme.danger : theme.ok }} />
    </View>
  );
}

function PersonCard({
  trip,
  person,
  home,
  giftForm,
  setGiftForm,
  onEditPerson,
  onStatus,
  onAddSpending,
  save,
  focusGift,
  onFocusLocated,
}: {
  trip: Trip;
  person: GiftPerson;
  home: string | null;
  giftForm: GiftForm | null;
  setGiftForm: (f: GiftForm | null) => void;
  /** T112: the gift opened from the Map tab (highlighted and scrolled to), else null. */
  focusGift: string | null;
  onFocusLocated: (windowY: number) => void;
  onEditPerson: () => void;
  onStatus: (g: Gift, s: GiftStatus) => void;
  onAddSpending: (g: Gift) => void;
  save: (t: Trip) => Promise<boolean>;
}) {
  const { t, theme, lang } = useApp();
  const rates = useMemo(() => readSpending(trip).rates, [trip]);
  const pr = personProgress(person, home, rates);
  const money = (amount: number, currency: string) => formatMoney(amount, currency, lang);
  const b = pr.budget;
  const startGift = () => {
    const currency = suggestCurrency(readSpending(trip), null) || home || '';
    setGiftForm({ personId: person.id, draft: newGiftDraft(currency), errors: [] });
  };
  return (
    <SectionCard
      title={person.name}
      subtitle={t('gifts.person.progress', { got: pr.got, total: pr.total })}
      icon="gift-outline"
      tone="teal"
      action={{ label: t('gifts.person.edit'), hint: t('gifts.person.editHint'), onPress: onEditPerson }}
    >
      {pr.total ? <Bar value={pr.fraction} label={t('gifts.person.progressA11y', { name: person.name, got: pr.got, total: pr.total })} /> : <Body muted>{t('gifts.person.noGifts')}</Body>}
      {b ? (
        <View style={{ gap: space.xs }}>
          <Bar value={b.fraction} over={b.over} label={t('gifts.budget.a11y', { spent: money(b.spent, b.currency), budget: money(b.budget, b.currency) })} />
          <View accessible style={{ gap: 2 }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{t('gifts.budget.line', { spent: money(b.spent, b.currency), budget: money(b.budget, b.currency) })}</Text>
            <Text style={[typeScale.small, { color: b.over ? theme.danger : theme.muted, fontVariant: ['tabular-nums'] }]}>
              {b.left >= 0 ? t('gifts.budget.left', { amount: money(b.left, b.currency) }) : t('gifts.budget.over', { amount: money(-b.left, b.currency) })}
            </Text>
            {b.planned !== b.spent ? (
              <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>
                {b.leftPlanned >= 0 ? t('gifts.budget.leftPlanned', { amount: money(b.leftPlanned, b.currency) }) : t('gifts.budget.overPlanned', { amount: money(-b.leftPlanned, b.currency) })}
              </Text>
            ) : null}
          </View>
          {b.partial ? <Body muted>{t('gifts.budget.partial')}</Body> : null}
        </View>
      ) : null}

      {person.gifts.map((g) =>
        giftForm?.prev?.id === g.id ? (
          <GiftEditor key={g.id} trip={trip} person={person} form={giftForm} setForm={setGiftForm} save={save} fromMap={focusGift === g.id} onLocated={onFocusLocated} />
        ) : (
          <GiftRow key={g.id} trip={trip} gift={g} home={home} rates={rates} onEdit={(draft) => setGiftForm({ personId: person.id, prev: g, draft, errors: [] })} onStatus={(s) => onStatus(g, s)} onAddSpending={() => onAddSpending(g)} />
        ),
      )}

      {giftForm && !giftForm.prev ? (
        <GiftEditor trip={trip} person={person} form={giftForm} setForm={setGiftForm} save={save} />
      ) : (
        <Button kind="secondary" icon="add" label={t('gifts.gift.add')} hint={t('gifts.gift.addA11y', { name: person.name })} onPress={startGift} />
      )}
    </SectionCard>
  );
}

function GiftRow({
  trip,
  gift: g,
  home,
  rates,
  onEdit,
  onStatus,
  onAddSpending,
}: {
  trip: Trip;
  gift: Gift;
  home: string | null;
  rates: Record<string, number>;
  onEdit: (d: GiftDraft) => void;
  onStatus: (s: GiftStatus) => void;
  onAddSpending: () => void;
}) {
  const { t, theme, lang } = useApp();
  const unit = useWeightUnit();
  const [store] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const bags = giftBagChoices(listFor(store, trip.id));
  const bag = g.bag ? bags.find((x) => x.id === g.bag) : undefined;
  const u = t(unit === 'lb' ? 'bags.unit.lb' : 'bags.unit.kg');
  const price = hasPrice(g) ? formatMoney(g.price, g.currency, lang) : null;
  const homeValue = hasPrice(g) && home && g.currency !== home ? priceIn({ currency: g.currency, amount: g.price }, home, home, rates) : null;
  const approx = hasPrice(g) && home && g.currency !== home ? (homeValue != null ? t('gifts.gift.approx', { amount: formatMoney(homeValue, home, lang) }) : t('gifts.gift.noRate')) : null;
  const details = [
    g.where ? t('gifts.gift.seenAt', { where: g.where }) : null,
    giftSpot(g) ? (g.spotName ? t('gifts.gift.onMap', { name: g.spotName }) : t('gifts.gift.onMapPlain')) : null,
    bag ? (g.weightG ? t('gifts.gift.inBagWeight', { bag: bagName(t, bag), weight: formatWeight(g.weightG, unit, lang), unit: u }) : t('gifts.gift.inBag', { bag: bagName(t, bag) })) : null,
    linkedExpense(trip, g) ? t('gifts.gift.inSpending') : null,
  ].filter((x): x is string => !!x);
  const statusLabel = t(STATUS_KEYS[g.status]);
  return (
    <View style={{ gap: space.s, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.s }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[t('gifts.gift.editA11y', { what: g.what }), statusLabel, price, approx, ...details].filter(Boolean).join(', ')}
        accessibilityHint={t('gifts.gift.editHint')}
        onPress={() => onEdit(draftFromGift(g, unit, lang))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={STATUS_ICONS[g.status]} size={22} color={g.status === 'idea' ? theme.muted : theme.ok} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{g.what}</Text>
          {details.map((d) => (
            <Text key={d} style={[typeScale.small, { color: theme.muted }]}>
              {d}
            </Text>
          ))}
        </View>
        {price ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[typeScale.bodyStrong, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{price}</Text>
            {approx ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{approx}</Text> : null}
          </View>
        ) : null}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="create-outline" size={18} color={theme.muted} />
        </View>
      </PressableScale>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('gifts.status.group', { what: g.what })}>
        {GIFT_STATUSES.map((s) => (
          <Chip key={s} label={t(STATUS_KEYS[s])} a11yLabel={t('gifts.status.a11y', { status: t(STATUS_KEYS[s]), what: g.what })} hint={t('gifts.status.hint')} selected={g.status === s} onPress={() => onStatus(s)} />
        ))}
      </View>
      {g.status === 'packed' && !bag ? <Body muted>{t('gifts.gift.packNoBag')}</Body> : null}
      {g.status !== 'idea' && canAddSpending(trip, g) ? <Button kind="quiet" icon="wallet-outline" label={t('gifts.spend.add')} hint={t('gifts.spend.addHint')} onPress={onAddSpending} /> : null}
    </View>
  );
}

function GiftEditor({
  trip,
  person,
  form,
  setForm,
  save,
  fromMap = false,
  onLocated,
}: {
  trip: Trip;
  person: GiftPerson;
  form: GiftForm;
  setForm: (f: GiftForm | null) => void;
  save: (t: Trip) => Promise<boolean>;
  /** T112: opened from the gift's Map-tab pin: highlighted, and its window position reported once laid out. */
  fromMap?: boolean;
  onLocated?: (windowY: number) => void;
}) {
  const { t, lang, theme } = useApp();
  const box = useRef<View>(null);
  const located = useRef(onLocated);
  located.current = onLocated;
  useEffect(() => {
    if (!fromMap) return;
    // After the fade-in has laid the editor out; measured in the window so nesting inside cards doesn't matter.
    const id = setTimeout(() => box.current?.measureInWindow((_x, y) => located.current?.(y)), 250);
    return () => clearTimeout(id);
  }, [fromMap]);
  const unit = useWeightUnit();
  const [store] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const bags = giftBagChoices(listFor(store, trip.id));
  const [locating, setLocating] = useState(false);
  const [hereNote, setHereNote] = useState<string | null>(null);
  const d = form.draft;
  const set = (patch: Partial<GiftDraft>) => setForm({ ...form, draft: { ...d, ...patch } });
  const err = (e: GiftError) => form.errors.includes(e);
  const choices = useMemo(() => currencyChoices(readSpending(trip), null), [trip]);
  const code = cleanCurrency(d.currency);
  const u = t(unit === 'lb' ? 'bags.unit.lb' : 'bags.unit.kg');

  const here = async () => {
    if (locating) return;
    setLocating(true);
    setHereNote(null);
    AccessibilityInfo.announceForAccessibility(t('gifts.gift.locating'));
    const r = await locateOnce();
    setLocating(false);
    if (!r.ok) {
      const note = r.reason === 'denied' ? t('gifts.gift.hereDenied') : t('gifts.gift.hereFailed');
      setHereNote(note);
      AccessibilityInfo.announceForAccessibility(note);
      return;
    }
    set({ pos: encodePos(roundPos(r.coords)), spotName: '' });
    AccessibilityInfo.announceForAccessibility(t('gifts.gift.hereSet'));
  };

  const submit = async () => {
    const errors = validateGift(d, unit, lang);
    if (errors.length) {
      setForm({ ...form, errors });
      AccessibilityInfo.announceForAccessibility(t('gifts.err.check'));
      return;
    }
    if (await save(upsertGift(trip, person.id, giftFromDraft(d, unit, lang, newId, form.prev)))) {
      setForm(null);
      haptic.success();
      AccessibilityInfo.announceForAccessibility(t('gifts.gift.saved'));
    }
  };

  const remove = () => {
    const prev = form.prev;
    if (!prev) return;
    Alert.alert(t('gifts.gift.deleteTitle', { what: prev.what }), t('gifts.gift.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('gifts.gift.delete'),
        style: 'destructive',
        onPress: async () => {
          if (await save(removeGift(trip, person.id, prev.id))) {
            setForm(null);
            AccessibilityInfo.announceForAccessibility(t('gifts.gift.deleted'));
          }
        },
      },
    ]);
  };

  return (
    <View
      ref={box}
      collapsable={false}
      style={fromMap ? { borderWidth: 2, borderColor: theme.accent, borderRadius: radius.m, padding: space.m, backgroundColor: theme.accentSoft } : undefined}
    >
      <FadeInView style={{ gap: space.m }}>
        {fromMap ? (
          <View accessible accessibilityLabel={t('f97.gift.fromMap')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Ionicons name="map-outline" size={16} color={theme.accentInk} />
            <Text style={[typeScale.small, { color: theme.accentInk }]}>{t('f97.gift.fromMap')}</Text>
          </View>
        ) : null}
        <Label>{form.prev ? t('gifts.gift.edit') : t('gifts.gift.new', { name: person.name })}</Label>
        <TextField label={t('gifts.gift.what')} value={d.what} onChange={(what) => set({ what })} placeholder={t('gifts.gift.whatPlaceholder')} error={err('what') ? t('gifts.err.what') : undefined} />
        <TextField label={t('gifts.gift.where')} value={d.where} onChange={(where) => set({ where })} placeholder={t('gifts.gift.wherePlaceholder')} />
        <TextField
          label={t('gifts.gift.price')}
          value={d.price}
          onChange={(price) => set({ price })}
          placeholder={t('gifts.gift.pricePlaceholder')}
          inputMode="decimal"
          error={err('price') ? (isCurrency(code) ? t('gifts.err.price', { code, n: currencyDigits(code) }) : t('gifts.err.priceNoCode')) : undefined}
        />
        <View style={{ gap: space.s }}>
          <Label>{t('gifts.gift.currency')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('gifts.gift.currency')}>
            {choices.map((c) => (
              <Chip key={c} label={c} selected={code === c} onPress={() => set({ currency: c })} />
            ))}
          </View>
          <TextField
            label={t('gifts.gift.code')}
            value={d.currency}
            onChange={(v) => set({ currency: v.toUpperCase().slice(0, 3) })}
            placeholder={t('gifts.gift.codePlaceholder')}
            autoCapitalize="none"
            error={err('currency') ? t('gifts.err.currency') : undefined}
          />
        </View>
        <PositionField label={t('gifts.gift.spot')} value={d.pos} trip={trip} onChange={(pos, name) => set({ pos, spotName: pos ? (name ?? '') : '' })} />
        <Button kind="quiet" icon="locate-outline" label={locating ? t('gifts.gift.locating') : t('gifts.gift.here')} hint={t('gifts.gift.hereHint')} onPress={here} />
        {hereNote ? <Body muted>{hereNote}</Body> : null}
        {err('pos') ? <Warning text={t('gifts.err.pos')} /> : null}
        <View style={{ gap: space.s }}>
          <Label>{t('gifts.gift.bag')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={t('gifts.gift.bag')}>
            <Chip label={t('gifts.gift.bagNone')} selected={!d.bag} onPress={() => set({ bag: '' })} hint={t('gifts.gift.bagHint')} />
            {bags.map((b) => (
              <Chip key={b.id} label={bagName(t, b)} a11yLabel={t('gifts.gift.bagA11y', { name: bagName(t, b) })} hint={t('gifts.gift.bagHint')} selected={d.bag === b.id} onPress={() => set({ bag: b.id })} />
            ))}
          </View>
        </View>
        <TextField
          label={t('gifts.gift.weight', { unit: u })}
          value={d.weight}
          onChange={(weight) => set({ weight })}
          placeholder={t('gifts.gift.weightPlaceholder')}
          inputMode="decimal"
          error={err('weight') ? t('gifts.err.weight', { unit: u }) : undefined}
        />
        <Button label={t('gifts.gift.save')} hint={t('gifts.gift.saveHint')} icon="checkmark" onPress={submit} />
        {form.prev ? <Button label={t('gifts.gift.delete')} hint={t('gifts.gift.deleteHint')} kind="quiet" icon="trash-outline" onPress={remove} /> : null}
        <Button label={t('common.cancel')} hint={t('gifts.gift.cancelHint')} kind="quiet" onPress={() => setForm(null)} />
      </FadeInView>
    </View>
  );
}

function CustomsCard() {
  const { t } = useApp();
  return (
    <SectionCard title={t('gifts.customs.title')} subtitle={t('gifts.customs.sub')} icon="shield-checkmark-outline" tone="warn">
      <Body>{t('gifts.customs.allowance')}</Body>
      <Body>{t('gifts.customs.food')}</Body>
      <Body>{t('gifts.customs.alcohol')}</Body>
      <Body>{t('gifts.customs.receipts')}</Body>
      <Body muted>{t('gifts.customs.check')}</Body>
    </SectionCard>
  );
}

function ShareCard({ trip }: { trip: Trip }) {
  const { t, lang } = useApp();
  const [prices, setPrices] = useState(false);
  const [failed, setFailed] = useState(false);
  const send = async () => {
    const text = giftsText(
      trip,
      {
        title: t('gifts.share.heading', { trip: trip.name }),
        person: (name, got, total) => t('gifts.share.person', { name, got, total }),
        status: (s) => t(STATUS_KEYS[s]),
        seenAt: (where) => t('gifts.share.seenAt', { where }),
        money: (m) => formatMoney(m.amount, m.currency, lang),
        empty: t('gifts.share.empty'),
      },
      { prices },
    );
    const r = await shareText(text, t('gifts.share.subject', { trip: trip.name }));
    if (r === 'failed') {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility(t('gifts.share.failed'));
      return;
    }
    setFailed(false);
    if (r === 'shared') haptic.success();
  };
  return (
    <SectionCard title={t('gifts.share.title')} subtitle={t('gifts.share.sub')} icon="share-outline" tone="sea">
      <ToggleRow label={t('gifts.share.prices')} hint={t('gifts.share.pricesHint')} value={prices} onChange={setPrices} />
      <Button kind="secondary" icon="share-outline" label={t('gifts.share.send')} hint={t('gifts.share.sendHint')} onPress={send} />
      {failed ? <ErrorNotice title={t('gifts.share.failedTitle')} body={t('gifts.share.failed')} action={t('common.tryAgain')} actionHint={t('gifts.share.sendHint')} onAction={send} /> : null}
    </SectionCard>
  );
}
