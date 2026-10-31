// Travelling together (T82): companions on a trip, who paid each expense, how it is split, balances and settle-up.
// Pure TypeScript, all on the phone: companions are names only and never leave it except inside a .satchel file the
// traveller chooses to send.
//
// People: 'me' ("You") is always on the trip; companions have their own ids. Old expenses with no payer / split read
// as paid by You and shared with no one, so a solo trip behaves exactly as before (every balance is zero).
//
// Splits are in integer minor units of the expense's own currency and always add up to the amount exactly:
// - equal:  everyone listed carries the same, the leftover units go one each to the first people in the list;
// - shares: weights (2 shares pays twice 1 share), leftovers by largest remainder, ties to the earlier person;
// - exact:  the typed amounts. A stored exact split that no longer adds up (edited by hand, damaged file) is read as
//           shares in proportion to those amounts, so it still adds up exactly. Nothing is ever thrown on.
//
// Balances: + means the others owe this person, - means this person owes. Every expense and settlement is booked in
// its own currency first (exact integers, each currency sums to zero). Currencies with a rate (home is 1) are then
// converted into the home currency with the trip's own manual rates and rounded by largest remainder, so the home
// balances still sum to exactly zero. A currency with no rate (or every currency, when the trip has no home) is
// never converted or guessed: its balances are kept apart in that currency, with their own settle-up.
//
// Settle-up uses the greedy rule: repeatedly the person owed most is paid by the person who owes most, the smaller
// of the two amounts. It settles everyone in at most (people with a balance - 1) transfers, which is the fewest for
// the small groups a trip has in nearly every case (it is not guaranteed minimal in rare cases where two subgroups
// happen to cancel out exactly). Ties go to the earlier person (You first, then companions in the order added), so
// the same balances always give the same list. Marking a transfer settled stores a Settlement, booked like an
// expense the payer paid entirely for the receiver, which moves both balances toward zero.
import type { Companion, Expense, ExpenseSplit, LocalDate, Settlement, SplitMode, SplitPart, Trip } from './model.ts';
import { convertMinor, currencyDigits, isCurrency, MAX_MINOR, parseAmount, rateFor, readSpending } from './spending.ts';
import { isLocalDateTime } from './tz.ts';

export const ME = 'me';
export const MAX_COMPANIONS = 19;
export const MAX_NAME = 40;
/** Largest weight for a "shares" split (keeps the arithmetic exact). */
export const MAX_SHARE = 1000;
const MAX_ROWS = 5000;
export const SPLIT_MODES: readonly SplitMode[] = ['equal', 'shares', 'exact'];

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isId = (x: unknown): x is string => typeof x === 'string' && x !== '' && x.length <= 100;
const isMinor = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0 && x <= MAX_MINOR;
const isDay = (x: unknown): x is LocalDate => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);

// ---- companions ----

export const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim();

export function isCompanion(x: unknown): x is Companion {
  return isObj(x) && isId(x.id) && x.id !== ME && typeof x.name === 'string' && cleanName(x.name) !== '' && x.name.length <= MAX_NAME * 2;
}

/** The trip's companions, malformed or repeated rows left out (stored order kept). */
export function readCompanions(trip: Pick<Trip, 'companions'>): Companion[] {
  const out: Companion[] = [];
  const seen = new Set<string>();
  for (const c of Array.isArray(trip.companions) ? trip.companions : []) {
    if (!isCompanion(c) || seen.has(c.id) || out.length >= MAX_COMPANIONS) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/** Everyone on the trip in a fixed order: You, then companions as added. */
export const peopleOf = (trip: Pick<Trip, 'companions'>): string[] => [ME, ...readCompanions(trip).map((c) => c.id)];

/** Who a new expense is split between: everyone on the trip, or just You with no companions. */
export const defaultParticipants = (trip: Pick<Trip, 'companions'>): string[] => peopleOf(trip);

export type NameError = 'empty' | 'long' | 'duplicate' | 'full';

/** Problems with a companion name. `youName` is the screen's word for You (a companion can't share it). */
export function validateName(trip: Pick<Trip, 'companions'>, name: string, youName: string, exceptId?: string): NameError | null {
  const n = cleanName(name);
  if (!n) return 'empty';
  if (n.length > MAX_NAME) return 'long';
  const key = n.toLocaleLowerCase();
  const others = readCompanions(trip).filter((c) => c.id !== exceptId);
  if (key === cleanName(youName).toLocaleLowerCase() || others.some((c) => cleanName(c.name).toLocaleLowerCase() === key)) return 'duplicate';
  if (!exceptId && others.length >= MAX_COMPANIONS) return 'full';
  return null;
}

export function addCompanion(trip: Trip, name: string, id: string): Trip {
  return { ...trip, companions: [...readCompanions(trip), { id, name: cleanName(name).slice(0, MAX_NAME) }] };
}

export function renameCompanion(trip: Trip, id: string, name: string): Trip {
  return { ...trip, companions: readCompanions(trip).map((c) => (c.id === id ? { ...c, name: cleanName(name).slice(0, MAX_NAME) } : c)) };
}

/** How many expenses and settlements mention this person (payer, in the split, or either side of a settlement). */
export function companionUse(trip: Trip, id: string): { expenses: number; settlements: number } {
  const expenses = readSpending(trip).expenses.filter((e) => e.paidBy === id || (e.split?.parts ?? []).some((p) => p?.person === id)).length;
  const settlements = readSettlements(trip).filter((s) => s.from === id || s.to === id).length;
  return { expenses, settlements };
}

/**
 * The trip without this companion. What they paid moves to You, they leave every split (a split left with no one is
 * dropped, so You carry it), and their settlements are removed. The screen asks first when companionUse isn't zero.
 */
export function removeCompanion(trip: Trip, id: string): Trip {
  if (id === ME) return trip;
  const companions = readCompanions(trip).filter((c) => c.id !== id);
  const expenses = readSpending(trip).expenses.map((e) => {
    if (e.paidBy !== id && !(e.split?.parts ?? []).some((p) => p?.person === id)) return e;
    const { paidBy, split, ...rest } = e;
    const payer = paidBy === id ? ME : paidBy;
    const parts = Array.isArray(split?.parts) ? split.parts.filter((p) => p?.person !== id) : [];
    // An exact split no longer adds up without them: what was theirs is read in proportion (see splitAmount).
    const out: Expense = { ...rest };
    if (payer !== undefined && payer !== ME) out.paidBy = payer;
    if (split && parts.length) out.split = { ...split, parts };
    return out;
  });
  const settlements = readSettlements(trip).filter((s) => s.from !== id && s.to !== id);
  return { ...trip, companions, expenses, settlements };
}

// ---- splits ----

/**
 * Splits `amount` minor units by whole-number weights so the parts add up exactly. Leftover units go by largest
 * remainder, ties to the earlier entry. All weights 0 (or none valid) splits equally.
 */
export function apportion(amount: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  let w = weights.map((x) => (Number.isSafeInteger(x) && x > 0 ? x : 0));
  if (w.every((x) => x === 0)) w = w.map(() => 1);
  const W = w.reduce((a, b) => a + b, 0);
  // amount = q * W + r keeps every product small enough to stay exact (r < W, weights are bounded).
  const q = Math.floor(amount / W);
  const r = amount - q * W;
  const base = w.map((x) => q * x + Math.floor((r * x) / W));
  const rem = w.map((x, i) => ({ i, rem: (r * x) % W }));
  let left = amount - base.reduce((a, b) => a + b, 0);
  rem.sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of rem) {
    if (left <= 0) break;
    base[i]++;
    left--;
  }
  return base;
}

export type Share = { person: string; amount: number };

/** A split read safely: known people only, each once, values valid for the mode; null when nothing usable is left. */
export function readSplit(x: unknown, known?: ReadonlySet<string>): ExpenseSplit | null {
  if (!isObj(x) || !SPLIT_MODES.includes(x.mode as SplitMode) || !Array.isArray(x.parts)) return null;
  const mode = x.mode as SplitMode;
  const seen = new Set<string>();
  const parts: SplitPart[] = [];
  for (const p of x.parts.slice(0, MAX_COMPANIONS + 1)) {
    if (!isObj(p) || !isId(p.person) || seen.has(p.person) || (known && !known.has(p.person))) continue;
    const v = p.value;
    if (mode === 'shares' && !(Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= MAX_SHARE)) continue;
    if (mode === 'exact' && !(Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= MAX_MINOR)) continue;
    seen.add(p.person);
    parts.push({ person: p.person, value: mode === 'equal' ? 1 : (v as number) });
  }
  return parts.length ? { mode, parts } : null;
}

/** Who carries how much of `amount` under a split; always adds up to `amount` exactly. */
export function splitAmount(amount: number, split: ExpenseSplit): Share[] {
  const { mode, parts } = split;
  if (!parts.length) return [{ person: ME, amount }];
  if (mode === 'exact') {
    const sum = parts.reduce((a, p) => a + p.value, 0);
    if (sum === amount) return parts.map((p) => ({ person: p.person, amount: p.value }));
  }
  // equal: weights 1; shares: their weights; exact that doesn't add up: in proportion to the typed amounts.
  const weights = mode === 'equal' ? parts.map(() => 1) : parts.map((p) => p.value);
  const out = apportion(amount, mode === 'exact' ? proportionalWeights(weights) : weights);
  return parts.map((p, i) => ({ person: p.person, amount: out[i] }));
}

/** Big exact amounts scaled down to weights apportion can handle exactly (ratios kept to about 1 in a million). */
function proportionalWeights(values: readonly number[]): number[] {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = values.reduce((a, v) => gcd(a, v), 0) || 1;
  const reduced = values.map((v) => v / g);
  const max = Math.max(...reduced, 0);
  const total = reduced.reduce((a, b) => a + b, 0);
  // apportion multiplies a remainder (< total) by a weight, so total * max must stay a safe integer.
  if (total * max <= Number.MAX_SAFE_INTEGER) return reduced;
  return reduced.map((v) => Math.round((v / max) * 1e6));
}

export type ResolvedExpense = { payer: string; shares: Share[]; together: boolean };

/**
 * Who paid an expense and who carries it, for the people on the trip. An unknown or missing payer is You; a missing
 * or unusable split (legacy rows) means You carry it all. `together` is false for those plain solo rows.
 */
export function resolveExpense(e: Expense, people: readonly string[]): ResolvedExpense {
  const known = new Set(people);
  const payer = isId(e.paidBy) && known.has(e.paidBy) ? e.paidBy : ME;
  const split = readSplit(e.split, known);
  if (!split) return { payer, shares: [{ person: ME, amount: e.amount }], together: payer !== ME };
  return { payer, shares: splitAmount(e.amount, split), together: true };
}

/** The expense with a payer and split set; a plain "You paid, only You" expense keeps neither field (as before T82). */
export function withSplit(e: Expense, paidBy: string, split: ExpenseSplit | null): Expense {
  const { paidBy: _p, split: _s, ...rest } = e;
  const solo = !split || (split.parts.length === 1 && split.parts[0].person === ME);
  const out: Expense = { ...rest };
  if (paidBy !== ME) out.paidBy = paidBy;
  if (split && !(solo && paidBy === ME)) out.split = split;
  return out;
}

const EXPENSE_KEYS = ['id', 'amount', 'currency', 'category', 'day', 'note', 'createdAt', 'paidBy', 'split'];
/** An edited expense keeping any fields this build doesn't know from the stored one (newer app versions, files). */
export function keepUnknown(prev: Expense | undefined, next: Expense): Expense {
  if (!prev) return next;
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(prev)) if (!EXPENSE_KEYS.includes(k)) extra[k] = v;
  return { ...extra, ...next } as Expense;
}

// ---- settlements ----

export function isSettlement(x: unknown): x is Settlement {
  return (
    isObj(x) &&
    isId(x.id) &&
    isId(x.from) &&
    isId(x.to) &&
    x.from !== x.to &&
    isMinor(x.amount) &&
    isCurrency(x.currency) &&
    (x.day === undefined || isDay(x.day)) &&
    (x.createdAt === undefined || typeof x.createdAt === 'string')
  );
}

/** The trip's settlements, malformed or repeated rows left out. */
export function readSettlements(trip: Pick<Trip, 'settlements'>): Settlement[] {
  const out: Settlement[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(trip.settlements) ? trip.settlements.slice(0, MAX_ROWS) : []) {
    if (!isSettlement(s) || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

export type Transfer = { from: string; to: string; amount: number };

export function addSettlement(trip: Trip, t: Transfer, currency: string, id: string, day?: LocalDate, now = new Date().toISOString()): Trip {
  const s: Settlement = { id, from: t.from, to: t.to, amount: t.amount, currency, ...(day ? { day } : {}), createdAt: now };
  return { ...trip, settlements: [...readSettlements(trip), s] };
}

export function removeSettlement(trip: Trip, id: string): Trip {
  return { ...trip, settlements: readSettlements(trip).filter((s) => s.id !== id) };
}

// ---- balances ----

export type Balance = { person: string; amount: number };
export type CurrencyBalances = { currency: string; balances: Balance[] };
export type Balances = {
  home: string | null;
  people: string[];
  /** Everyone's balance in home minor units (sums to zero); null when the trip has no home currency. */
  inHome: Balance[] | null;
  /** Currencies with no rate, each kept in its own minor units (sums to zero), alphabetical. Only ones with a non-zero balance. */
  apart: CurrencyBalances[];
  /** True when anything was split with or paid by someone else, or a settlement exists. */
  shared: boolean;
};

/** Each currency's balances in its own minor units (every currency sums to zero), from expenses and settlements. */
export function ledger(trip: Trip): { people: string[]; byCurrency: Map<string, Map<string, number>>; shared: boolean } {
  const people = peopleOf(trip);
  const known = new Set(people);
  const byCurrency = new Map<string, Map<string, number>>();
  const book = (currency: string, person: string, amount: number) => {
    let m = byCurrency.get(currency);
    if (!m) {
      m = new Map(people.map((p) => [p, 0]));
      byCurrency.set(currency, m);
    }
    m.set(person, (m.get(person) ?? 0) + amount);
  };
  let shared = false;
  for (const e of readSpending(trip).expenses) {
    const r = resolveExpense(e, people);
    if (!r.together) continue;
    shared = true;
    book(e.currency, r.payer, e.amount);
    for (const s of r.shares) book(e.currency, s.person, -s.amount);
  }
  for (const s of readSettlements(trip)) {
    if (!known.has(s.from) || !known.has(s.to)) continue;
    shared = true;
    book(s.currency, s.from, s.amount);
    book(s.currency, s.to, -s.amount);
  }
  return { people, byCurrency, shared };
}

/**
 * Converts one currency's balances (summing to zero) into home minor units with the trip's rate. Each is rounded
 * down, then the units still needed to reach zero go to the largest remainders (ties to the earlier person), so the
 * converted balances sum to exactly zero too.
 */
export function convertBalances(balances: readonly Balance[], from: string, rate: number, home: string): Balance[] {
  if (from === home && rate === 1) return balances.map((b) => ({ ...b }));
  const scale = rate * 10 ** (currencyDigits(home) - currencyDigits(from));
  const exact = balances.map((b) => Number((b.amount * scale).toPrecision(12)));
  const floors = exact.map((x) => Math.floor(x));
  const target = Math.round(Number((balances.reduce((a, b) => a + b.amount, 0) * scale).toPrecision(12)));
  let left = target - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - floors[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return balances.map((b, i) => ({ person: b.person, amount: floors[i] === 0 ? 0 : floors[i] }));
}

export function balances(trip: Trip): Balances {
  const { budget, rates } = readSpending(trip);
  const home = budget?.currency ?? null;
  const { people, byCurrency, shared } = ledger(trip);
  const homeSum = new Map(people.map((p) => [p, 0]));
  const apart: CurrencyBalances[] = [];
  for (const currency of [...byCurrency.keys()].sort()) {
    const m = byCurrency.get(currency) as Map<string, number>;
    const list = people.map((person) => ({ person, amount: m.get(person) ?? 0 }));
    const rate = rateFor(currency, home, rates);
    if (home == null || rate == null) {
      if (list.some((b) => b.amount !== 0)) apart.push({ currency, balances: list });
      continue;
    }
    for (const b of convertBalances(list, currency, rate, home)) homeSum.set(b.person, (homeSum.get(b.person) ?? 0) + b.amount);
  }
  return { home, people, inHome: home == null ? null : people.map((person) => ({ person, amount: homeSum.get(person) ?? 0 })), apart, shared };
}

// ---- settle up ----

/** The greedy settle-up for balances that sum to zero (see the file header). Ties go to the earlier person. */
export function settleUp(list: readonly Balance[]): Transfer[] {
  const cred = list.map((b, i) => ({ ...b, i })).filter((b) => b.amount > 0);
  const debt = list.map((b, i) => ({ person: b.person, amount: -b.amount, i })).filter((b) => b.amount > 0);
  const pick = (xs: typeof cred) => xs.reduce<(typeof cred)[number] | null>((best, x) => (x.amount > 0 && (!best || x.amount > best.amount || (x.amount === best.amount && x.i < best.i)) ? x : best), null);
  const out: Transfer[] = [];
  for (let guard = 0; guard < list.length * 2; guard++) {
    const c = pick(cred);
    const d = pick(debt);
    if (!c || !d) break;
    const amount = Math.min(c.amount, d.amount);
    out.push({ from: d.person, to: c.person, amount });
    c.amount -= amount;
    d.amount -= amount;
  }
  return out;
}

export type SettlePlan = {
  home: string | null;
  /** Transfers in the home currency (empty when settled or no home). */
  inHome: Transfer[];
  /** Transfers per currency with no rate, kept in that currency. */
  apart: { currency: string; transfers: Transfer[] }[];
  /** Nothing is owed by anyone, in any currency. */
  settled: boolean;
};

export function settlePlan(b: Balances): SettlePlan {
  const inHome = b.inHome ? settleUp(b.inHome) : [];
  const apart = b.apart.map((g) => ({ currency: g.currency, transfers: settleUp(g.balances) })).filter((g) => g.transfers.length);
  return { home: b.home, inHome, apart, settled: inHome.length === 0 && apart.length === 0 };
}

// ---- the expense form's payer / split fields ----

export type TogetherDraft = {
  paidBy: string;
  mode: SplitMode;
  /** Who is in the split, in trip order. */
  people: string[];
  /** Typed weights for "shares" (default "1"). */
  shares: Record<string, string>;
  /** Typed amounts for "exact". */
  exact: Record<string, string>;
};
export type TogetherError = 'people' | 'shares' | 'exact' | 'exactSum';

export function newTogetherDraft(trip: Pick<Trip, 'companions'>): TogetherDraft {
  return { paidBy: ME, mode: 'equal', people: defaultParticipants(trip), shares: {}, exact: {} };
}

/** The form fields for a stored expense (legacy rows: You paid, only You). */
export function togetherDraftFromExpense(trip: Trip, e: Expense): TogetherDraft {
  const people = peopleOf(trip);
  const r = resolveExpense(e, people);
  const split = readSplit(e.split, new Set(people));
  if (!split) return { paidBy: r.payer, mode: 'equal', people: [ME], shares: {}, exact: {} };
  const shares: Record<string, string> = {};
  const exact: Record<string, string> = {};
  if (split.mode === 'shares') for (const p of split.parts) shares[p.person] = String(p.value);
  // Exact fields show what each person actually carries (also when a stored exact split no longer added up).
  if (split.mode === 'exact') for (const s of r.shares) exact[s.person] = minorText(s.amount, e.currency);
  const inSplit = new Set(split.parts.map((p) => p.person));
  return { paidBy: r.payer, mode: split.mode, people: people.filter((p) => inSplit.has(p)), shares, exact };
}

const minorText = (minor: number, currency: string) => {
  const d = currencyDigits(currency);
  if (d === 0) return String(minor);
  const s = String(minor).padStart(d + 1, '0');
  return `${s.slice(0, -d)}.${s.slice(-d)}`;
};

/** Toggles a person in or out of the split (trip order kept). */
export function togglePerson(d: TogetherDraft, person: string, order: readonly string[]): TogetherDraft {
  const on = d.people.includes(person);
  const set = new Set(on ? d.people.filter((p) => p !== person) : [...d.people, person]);
  return { ...d, people: order.filter((p) => set.has(p)) };
}

const parseShare = (s: string | undefined): number | null => {
  const t = (s ?? '1').trim() || '1';
  if (!/^[0-9]+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= MAX_SHARE ? n : null;
};
/** A typed exact amount in minor units: blank or 0 is 0; null when unreadable. */
const parseExact = (s: string | undefined, currency: string): number | null => {
  const t = (s ?? '').trim();
  if (t === '' || /^0+([.,]0*)?$/.test(t)) return 0;
  return parseAmount(t, currency);
};

/** What's left to assign in an exact split (negative: too much), or null while a field can't be read. */
export function exactRemaining(d: TogetherDraft, amount: number, currency: string): number | null {
  let sum = 0;
  for (const p of d.people) {
    const v = parseExact(d.exact[p], currency);
    if (v == null) return null;
    sum += v;
  }
  return amount - sum;
}

/** Problems with the payer / split fields for an expense of `amount` (minor units, null while the amount is invalid). */
export function validateTogether(d: TogetherDraft, amount: number | null, currency: string): TogetherError[] {
  if (!d.people.length) return ['people'];
  if (d.mode === 'shares' && d.people.some((p) => parseShare(d.shares[p]) == null)) return ['shares'];
  if (d.mode === 'exact') {
    if (d.people.some((p) => parseExact(d.exact[p], currency) == null)) return ['exact'];
    if (amount != null && exactRemaining(d, amount, currency) !== 0) return ['exactSum'];
  }
  return [];
}

/** The stored split for valid fields (call validateTogether first). */
export function splitFromDraft(d: TogetherDraft, currency: string): ExpenseSplit {
  if (d.mode === 'equal') return { mode: 'equal', parts: d.people.map((person) => ({ person, value: 1 })) };
  if (d.mode === 'shares') return { mode: 'shares', parts: d.people.map((person) => ({ person, value: parseShare(d.shares[person]) ?? 1 })) };
  return { mode: 'exact', parts: d.people.map((person) => ({ person, value: parseExact(d.exact[person], currency) ?? 0 })) };
}

// ---- .satchel files ----

/**
 * The together fields of a trip in a .satchel file, made safe: malformed companions and settlements are dropped,
 * and a payer or split that isn't readable is removed from its expense (so it reads as You). Valid rows keep any
 * fields this build doesn't know. Older files have none of this and come back unchanged.
 */
export function cleanFileTogether<T extends Record<string, unknown>>(t: T): T {
  const out: Record<string, unknown> = { ...t };
  if ('companions' in t) {
    const companions = readCompanions({ companions: t.companions as Companion[] });
    if (companions.length) out.companions = companions;
    else delete out.companions;
  }
  if ('settlements' in t) {
    const settlements = readSettlements({ settlements: t.settlements as Settlement[] });
    if (settlements.length) out.settlements = settlements;
    else delete out.settlements;
  }
  if (Array.isArray(t.expenses)) {
    out.expenses = (t.expenses as Record<string, unknown>[]).map((e) => {
      if (!isObj(e) || (!('paidBy' in e) && !('split' in e))) return e;
      const { paidBy, split, ...rest } = e;
      const r: Record<string, unknown> = { ...rest };
      if (isId(paidBy)) r.paidBy = paidBy;
      if (readSplit(split)) r.split = split;
      return r;
    });
  }
  return out as T;
}
