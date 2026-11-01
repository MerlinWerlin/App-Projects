// T156 step-free travel (owner feedback 1031 D: deepen Map, Toilets and Trips). Pure TypeScript, fully offline.
// - Access needs (wheelchair, step-free, pram / stroller, limited walking) are kept on THIS PHONE only under
//   STEPFREE_KEY, never on a Trip, so a shared .satchel file never says anything about the traveller's body.
// - Toilets: with needs set, wheelchair (and, for a pram, changing-table) toilets come first, and a quick
//   "Accessible only" filter is offered. Map pins and Nearby show the OSM wheelchair tag (yes / limited / no).
// - Per-booking access notes (step-free room, assistance booked, lift, a short note) live on Item.access, so they
//   travel in .satchel files (the T85 every-field guard in roundtrip85.test.ts covers them).
// - "Book travel assistance" readiness and airport rows: generic advice only, never a company name.
// - The access-needs help-card lines reuse src/content/helpcards.json and add a few lines of their own in
//   src/content/stepfree_lines.json (same languages, every translated line marked "check": true for a native read).
import type { Check, Fix } from './readiness.ts';
import type { HelpLanguage, HelpTable, LineId } from './helpcards.ts';
import type { Item, ItemKind, Trip } from './model.ts';
import type { PhraseLang } from './phrases.ts';
import { span, zonesReadable } from './timeline.ts';

// ------------------------------------------------------------------------------------------------- needs

/** Phone-only AsyncStorage key for the access needs and the toilets quick filter (declared once, here). */
export const STEPFREE_KEY = 'satchel.stepfree.v1';

export const ACCESS_NEEDS = ['wheelchair', 'stepFree', 'pram', 'walkLimited'] as const;
export type AccessNeed = (typeof ACCESS_NEEDS)[number];
export const isAccessNeed = (v: unknown): v is AccessNeed => typeof v === 'string' && (ACCESS_NEEDS as readonly string[]).includes(v);

export type StepFreePrefs = { needs: AccessNeed[]; /** Toilets tab quick filter: only toilets that suit the needs. */ accessibleOnly: boolean };
export const NO_PREFS: StepFreePrefs = { needs: [], accessibleOnly: false };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Needs as known ids, no repeats, in the fixed order. */
export function normaliseNeeds(raw: unknown): AccessNeed[] {
  if (!Array.isArray(raw)) return [];
  return ACCESS_NEEDS.filter((id) => raw.includes(id));
}

/** The stored value, cleaned; never throws. */
export function readPrefs(raw: unknown): StepFreePrefs {
  if (!isObj(raw)) return { ...NO_PREFS, needs: [] };
  return { needs: normaliseNeeds(raw.needs), accessibleOnly: raw.accessibleOnly === true };
}

export function toggleNeed(prefs: StepFreePrefs, id: AccessNeed): StepFreePrefs {
  const p = readPrefs(prefs);
  const needs = p.needs.includes(id) ? p.needs.filter((x) => x !== id) : normaliseNeeds([...p.needs, id]);
  // With no needs left the quick filter has nothing to filter by, so it goes off too.
  return { needs, accessibleOnly: needs.length ? p.accessibleOnly : false };
}

export const setAccessibleOnly = (prefs: StepFreePrefs, on: boolean): StepFreePrefs => {
  const p = readPrefs(prefs);
  return { ...p, accessibleOnly: on && p.needs.length > 0 };
};

export const hasAccessNeeds = (prefs: Pick<StepFreePrefs, 'needs'> | null | undefined): boolean => !!prefs && normaliseNeeds(prefs.needs).length > 0;

/** Needs that mean "no steps" (and so wheelchair toilets, lifts and travel assistance matter). */
const STEP_NEEDS: readonly AccessNeed[] = ['wheelchair', 'stepFree', 'walkLimited'];
const wantsStepFree = (needs: readonly AccessNeed[]) => needs.some((n) => STEP_NEEDS.includes(n));
const wantsChanging = (needs: readonly AccessNeed[]) => needs.includes('pram');

// ------------------------------------------------------------------------------------------------- OSM tag

export type WheelchairLevel = 'yes' | 'limited' | 'no';

/** The OSM wheelchair tag as yes / limited / no ('designated' counts as yes); anything else is unknown. */
export function wheelchairLevel(v: unknown): WheelchairLevel | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'yes' || s === 'designated' || s === 'true' || s === '1') return 'yes';
  if (s === 'limited') return 'limited';
  if (s === 'no' || s === 'false' || s === '0') return 'no';
  return undefined;
}

// ------------------------------------------------------------------------------------------------- toilets

type ToiletTags = { wheelchair?: string; changing_table?: string };

/**
 * How well a toilet suits the needs: 2 = a full match (wheelchair yes for step needs, changing table yes for a
 * pram), 1 = only a limited one, 0 = nothing known or no. A toilet tagged wheelchair=no never counts for step needs.
 */
export function toiletAccessTier(t: ToiletTags, needs: readonly AccessNeed[]): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0;
  if (wantsStepFree(needs)) {
    const w = wheelchairLevel(t.wheelchair);
    if (w === 'yes') best = 2;
    else if (w === 'limited') best = 1;
  }
  if (wantsChanging(needs)) {
    const c = wheelchairLevel(t.changing_table);
    if (c === 'yes') best = 2;
    else if (c === 'limited' && best < 1) best = 1;
  }
  return best;
}

export const isAccessibleToilet = (t: ToiletTags, needs: readonly AccessNeed[]): boolean => toiletAccessTier(t, needs) > 0;

/**
 * With needs set: the user's own pinned toilets stay on top, then full matches, then limited ones, then the rest;
 * nearest-first order is kept inside each group (stable). With no needs the list is returned as it was.
 */
export function accessibleFirst<R extends ToiletTags & { pinned?: boolean }>(rows: readonly R[], needs: readonly AccessNeed[]): R[] {
  if (!needs.length) return [...rows];
  return rows
    .map((r, i) => ({ r, i, k: (r.pinned ? 10 : 0) + toiletAccessTier(r, needs) }))
    .sort((a, b) => b.k - a.k || a.i - b.i)
    .map((x) => x.r);
}

/** The quick filter: only toilets that suit the needs, when it is on and needs are set. */
export function accessibleOnly<R extends ToiletTags>(rows: readonly R[], prefs: StepFreePrefs): R[] {
  const p = readPrefs(prefs);
  if (!p.accessibleOnly || !p.needs.length) return [...rows];
  return rows.filter((r) => isAccessibleToilet(r, p.needs));
}

export const accessibleCount = (rows: readonly ToiletTags[], needs: readonly AccessNeed[]): number => rows.filter((r) => isAccessibleToilet(r, needs)).length;

// ------------------------------------------------------------------------------------------------- booking notes

/** Per-booking access notes, on Item.access (kept in .satchel files). Only ticks that are on are stored. */
export type AccessNote = {
  /** A step-free (accessible) room was asked for / confirmed. */
  stepFreeRoom?: boolean;
  /** Travel assistance is booked for this journey. */
  assistance?: boolean;
  /** There is a lift (to the room, platform or venue). */
  lift?: boolean;
  /** Anything else, short ("ramp at side door", "assistance meets at gate"). */
  note?: string;
};
export const ACCESS_KEYS = ['stepFreeRoom', 'assistance', 'lift', 'note'] as const;
export type AccessFlag = Exclude<(typeof ACCESS_KEYS)[number], 'note'>;
export const ACCESS_NOTE_MAX = 300;

/** A stored or imported value as clean AccessNote, or undefined when nothing is left. Unknown keys are dropped. */
export function readAccess(raw: unknown): AccessNote | undefined {
  if (!isObj(raw)) return undefined;
  const out: AccessNote = {};
  if (raw.stepFreeRoom === true) out.stepFreeRoom = true;
  if (raw.assistance === true) out.assistance = true;
  if (raw.lift === true) out.lift = true;
  if (typeof raw.note === 'string') {
    const n = raw.note.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, ACCESS_NOTE_MAX);
    if (n) out.note = n;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The item with its access notes replaced (an empty result removes the field). */
export function withAccess<I extends Item>(item: I, next: AccessNote | undefined): I {
  const { access: _a, ...rest } = item;
  const clean = readAccess(next);
  return (clean ? { ...rest, access: clean } : rest) as I;
}

export const toggleAccessFlag = <I extends Item>(item: I, flag: AccessFlag): I => {
  const cur = readAccess(item.access) ?? {};
  return withAccess(item, { ...cur, [flag]: !cur[flag] });
};

export const ASSISTANCE_KINDS: readonly ItemKind[] = ['flight', 'train', 'ferry', 'bus'];
const isAssistanceKind = (k: ItemKind) => ASSISTANCE_KINDS.includes(k);

/** The ticks a booking of this kind offers (the note is offered on every kind). */
export function accessFlagsFor(kind: ItemKind): AccessFlag[] {
  if (kind === 'hotel') return ['stepFreeRoom', 'lift'];
  if (isAssistanceKind(kind)) return ['assistance'];
  if (kind === 'activity') return ['assistance', 'lift'];
  return [];
}

/** Plan this trip again (src/core/tripcopy.ts): the lift and the note are about the place; the room request and the assistance booking belong to that trip. */
export function copyAccess(raw: unknown): AccessNote | undefined {
  const a = readAccess(raw);
  if (!a) return undefined;
  return readAccess({ lift: a.lift, note: a.note });
}

// ------------------------------------------------------------------------------------------------- assistance

/** General guidance shown with the rows: many carriers ask for this much notice (never a company's own rule). */
export const ASSISTANCE_NOTICE_HOURS = 48;

/** Needs that make the travel-assistance rows show (a pram alone does not). */
export const needsAssistance = (prefs: Pick<StepFreePrefs, 'needs'> | null | undefined): boolean => !!prefs && wantsStepFree(normaliseNeeds(prefs.needs));

export const assistanceBooked = (item: Pick<Item, 'access'>): boolean => readAccess(item.access)?.assistance === true;

/** Journeys of the trip that have not left yet (zones readable), departure order. */
export function upcomingJourneys(trip: Pick<Trip, 'items'>, now: number): Item[] {
  return (trip.items ?? [])
    .filter((i) => isAssistanceKind(i.kind) && zonesReadable(i) && span(i).start > now)
    .sort((a, b) => span(a).start - span(b).start);
}

export type AssistanceFix = Extract<Fix, { kind: 'assistance' }>;

/**
 * The readiness row "Book travel assistance": null unless needs are set and a journey is still ahead. pass when
 * every upcoming journey is marked booked; otherwise warn (reason none / some, done / total), fixing on the first
 * journey not marked yet. Never 'fail': Satchel can't know what the traveller arranged by phone.
 */
export function assistanceCheck(trip: Pick<Trip, 'items'>, prefs: StepFreePrefs | null | undefined, now: number): Check | null {
  if (!needsAssistance(prefs)) return null;
  const legs = upcomingJourneys(trip, now);
  if (!legs.length) return null;
  const booked = legs.filter(assistanceBooked);
  const total = legs.length;
  const done = booked.length;
  if (done === total) return { id: 'assistance', status: 'pass', reason: 'all', done, total, fix: null };
  const first = legs.find((l) => !assistanceBooked(l)) as Item;
  return { id: 'assistance', status: 'warn', reason: done ? 'some' : 'none', done, total, fix: { kind: 'assistance', itemId: first.id } };
}

export type AirportAssistance = { booked: boolean; hoursLeft: number | null; late: boolean };

/**
 * The airport-day row for one booking: null unless it's a journey and needs are set. `late`: departure is within
 * ASSISTANCE_NOTICE_HOURS and nothing is marked (the row then says to ask at the desk on arrival).
 */
export function airportAssistance(item: Item, prefs: StepFreePrefs | null | undefined, now: number): AirportAssistance | null {
  if (!needsAssistance(prefs) || !isAssistanceKind(item.kind) || !zonesReadable(item)) return null;
  const booked = assistanceBooked(item);
  const ms = span(item).start - now;
  const hoursLeft = ms > 0 ? Math.floor(ms / 3_600_000) : null;
  return { booked, hoursLeft, late: !booked && (hoursLeft === null || hoursLeft < ASSISTANCE_NOTICE_HOURS) };
}

// ------------------------------------------------------------------------------------------------- help card lines

export const SF_LINE_IDS = ['pram', 'walkLimited', 'liftAsk'] as const;
export type SfLineId = (typeof SF_LINE_IDS)[number];
export type StepFreeTable = { version: number; checked?: string; note?: string; sentences: { id: string; en: string }[]; languages: HelpLanguage[] };

type LineRef = { from: 'help'; id: LineId } | { from: 'sf'; id: SfLineId };
/** Each need's sentences: help-card lines where helpcards.json already says it, our own lines otherwise. */
export const NEED_LINES: Record<AccessNeed, readonly LineRef[]> = {
  wheelchair: [{ from: 'help', id: 'wheelchair' }],
  stepFree: [{ from: 'help', id: 'stepFree' }],
  pram: [{ from: 'sf', id: 'pram' }],
  walkLimited: [
    { from: 'sf', id: 'walkLimited' },
    { from: 'help', id: 'sit' },
  ],
};

export type SfLine = { id: string; en: string; local: string; lang: PhraseLang };

function lineOf(table: { sentences: { id: string; en: string }[]; languages: HelpLanguage[] }, lang: PhraseLang, id: string): SfLine {
  const en = table.sentences.find((s) => s.id === id)?.en ?? id;
  const local = table.languages.find((l) => l.code === lang)?.lines[id]?.text?.trim() || en;
  return { id, en, local, lang };
}

/**
 * The access-needs card for the needs set on this phone, in the stay country's language with English under it: the
 * help-card title, each need's lines (no repeats), then "Is there a lift?" when any step need is set. Empty lines
 * when no needs are set.
 */
export function needsCard(needs: readonly AccessNeed[], help: HelpTable, sf: StepFreeTable, lang: PhraseLang): { title: SfLine; lines: SfLine[] } {
  const title = lineOf(help, lang, 'needsTitle');
  const seen = new Set<string>();
  const lines: SfLine[] = [];
  const add = (ref: LineRef) => {
    const key = `${ref.from}:${ref.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(lineOf(ref.from === 'help' ? help : sf, lang, ref.id));
  };
  for (const n of normaliseNeeds(needs)) for (const ref of NEED_LINES[n]) add(ref);
  if (lines.length && (wantsStepFree(needs) || wantsChanging(needs))) add({ from: 'sf', id: 'liftAsk' });
  return { title, lines };
}

/** Plain text for the share sheet: local first, English under each line. */
export function needsCardText(card: { title: SfLine; lines: SfLine[] }): string {
  const bi = (l: SfLine) => (l.local === l.en ? l.en : `${l.local}\n${l.en}`);
  return [card.title, ...card.lines].map(bi).join('\n\n');
}

/** Content problems (empty = good): every help-card language has every line, non-empty, each marked for a native check. */
export function stepfreeTableProblems(sf: StepFreeTable, help: HelpTable): string[] {
  const out: string[] = [];
  const ids = sf.sentences.map((s) => s.id);
  for (const id of SF_LINE_IDS) if (!ids.includes(id)) out.push(`sentence ${id}: no English line`);
  for (const s of sf.sentences) if (!(SF_LINE_IDS as readonly string[]).includes(s.id) || !s.en?.trim()) out.push(`sentence ${s.id}: unknown or empty`);
  const codes = sf.languages.map((l) => l.code);
  for (const l of help.languages) if (!codes.includes(l.code)) out.push(`language ${l.code}: missing`);
  for (const l of sf.languages) {
    for (const id of SF_LINE_IDS) {
      const line = l.lines[id];
      if (!line || !line.text?.trim()) out.push(`${l.code} ${id}: missing`);
      else if (line.check !== true) out.push(`${l.code} ${id}: not marked for a native-speaker check`);
    }
    for (const id of Object.keys(l.lines)) if (!(SF_LINE_IDS as readonly string[]).includes(id)) out.push(`${l.code} ${id}: unknown line`);
  }
  return out;
}
