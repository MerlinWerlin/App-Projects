// T121 Help cards: show-a-local cards for the people you travel with. Pure TypeScript, fully offline.
// - "If I'm lost": one card per person (a companion on the trip, a child, anyone): their name, who to call (a
//   tap-to-call number), the hotel from the current stay booking (battery.currentHotel: the stay you're in, else the
//   next one), a meeting point and an optional photo kept on this phone.
// - Access needs: wheelchair, step-free access, deaf or hard of hearing, blind or low vision, assistance dog, needs to
//   sit, plus free text.
// Both show the fixed sentences from src/content/helpcards.json in the local language with English under them; what
// the traveller types (names, meeting point, other needs) is shown as typed. The language comes from the trip's
// country through the phrase screen's own rule (phrases.pickPhraseLang), so the two screens always agree.
// Stored on this phone only, under HELPCARDS_KEY, never on the Trip: .satchel files cannot carry a card or its photo
// (guard test in helpcards.test.ts). Companions are only a starting point (their name is copied once).
import { currentHotel } from './battery.ts';
import type { Companion, Trip } from './model.ts';
import { isPhraseLang, pickPhraseLang, PHRASE_LANGS, type LangSource, type PhraseLang, type PhraseTable } from './phrases.ts';
import { dialable } from './staydetails.ts';
import { readCompanions } from './together.ts';

/** Phone-only AsyncStorage key for every help card (declared once, here). */
export const HELPCARDS_KEY = 'satchel.helpcards.v1';

export const NEED_IDS = ['wheelchair', 'stepFree', 'deaf', 'blind', 'serviceDog', 'sit'] as const;
export type NeedId = (typeof NEED_IDS)[number];

/** Every fixed sentence or label the cards show, in the order of src/content/helpcards.json. */
export const LINE_IDS = [
  'lostTitle',
  'lostCall',
  'lostStay',
  'labelName',
  'labelCall',
  'labelHotel',
  'labelMeet',
  'needsTitle',
  ...NEED_IDS,
  'labelOther',
] as const;
export type LineId = (typeof LINE_IDS)[number];

export type HelpLine = { text: string; check?: boolean };
export type HelpLanguage = { code: string; lines: Record<string, HelpLine> };
export type HelpTable = { version: number; checked?: string; note?: string; sentences: { id: string; en: string }[]; languages: HelpLanguage[] };

export type CardKind = 'lost' | 'needs';
export const CARD_KINDS: readonly CardKind[] = ['lost', 'needs'];

export type HelpPerson = {
  id: string;
  name: string;
  /** The companion this card started from, when it did (only to stop offering them again). */
  companionId?: string;
  callName: string;
  callPhone: string;
  meetingPoint: string;
  /** A photo copied into Satchel's own documents folder (attachments/), never shared with a trip file. */
  photoUri?: string;
  needs: NeedId[];
  otherNeeds: string;
};

export const LIMITS = { name: 40, callName: 40, phone: 40, meeting: 200, other: 300 } as const;
export const MAX_PEOPLE = 12;

export const isNeedId = (v: unknown): v is NeedId => typeof v === 'string' && (NEED_IDS as readonly string[]).includes(v);
export const isCardKind = (v: unknown): v is CardKind => v === 'lost' || v === 'needs';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const oneLine = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '');

/** Needs as known ids, no repeats, in the fixed order. */
export function normaliseNeeds(raw: unknown): NeedId[] {
  if (!Array.isArray(raw)) return [];
  return NEED_IDS.filter((id) => raw.includes(id));
}

/** The list with this need added, or removed when it was there (fixed order kept). */
export function toggleNeed(raw: unknown, id: NeedId): NeedId[] {
  const list = normaliseNeeds(raw);
  return list.includes(id) ? list.filter((x) => x !== id) : normaliseNeeds([...list, id]);
}

/** One stored person, cleaned; null when it has no id or no name. Never throws. */
export function cleanPerson(raw: unknown): HelpPerson | null {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id && raw.id.length <= 100 ? raw.id : null;
  const name = oneLine(raw.name, LIMITS.name);
  if (!id || !name) return null;
  const out: HelpPerson = {
    id,
    name,
    callName: oneLine(raw.callName, LIMITS.callName),
    callPhone: oneLine(raw.callPhone, LIMITS.phone),
    meetingPoint: text(raw.meetingPoint, LIMITS.meeting),
    needs: normaliseNeeds(raw.needs),
    otherNeeds: text(raw.otherNeeds, LIMITS.other),
  };
  if (typeof raw.companionId === 'string' && raw.companionId) out.companionId = raw.companionId.slice(0, 100);
  if (typeof raw.photoUri === 'string' && raw.photoUri.trim()) out.photoUri = raw.photoUri.trim();
  return out;
}

/** The stored list, cleaned: bad rows and repeated ids dropped, at most MAX_PEOPLE, stored order kept. */
export function cleanPeople(raw: unknown): HelpPerson[] {
  const list = isObj(raw) && Array.isArray(raw.people) ? raw.people : Array.isArray(raw) ? raw : [];
  const out: HelpPerson[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const p = cleanPerson(r);
    if (!p || seen.has(p.id) || out.length >= MAX_PEOPLE) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/** What the edit form holds (everything but the id). */
export type PersonDraft = Omit<HelpPerson, 'id'>;

export const EMPTY_DRAFT: PersonDraft = { name: '', callName: '', callPhone: '', meetingPoint: '', needs: [], otherNeeds: '' };

export const draftOf = (p: HelpPerson): PersonDraft => {
  const { id: _id, ...rest } = p;
  return { ...rest, needs: [...rest.needs] };
};

/** A new card starting from a companion on the trip: their name, nothing else guessed. */
export const draftForCompanion = (c: Companion): PersonDraft => ({ ...EMPTY_DRAFT, name: oneLine(c.name, LIMITS.name), companionId: c.id });

export type SaveError = 'name' | 'phone' | 'full';
export type SaveResult = { ok: true; list: HelpPerson[]; person: HelpPerson } | { ok: false; reason: SaveError };

/**
 * Adds (id not in the list) or replaces a person. A name is required; a number, when typed, must be one a phone can
 * dial (3+ digits). Never more than MAX_PEOPLE.
 */
export function savePerson(list: readonly HelpPerson[], draft: PersonDraft, id: string): SaveResult {
  const person = cleanPerson({ ...draft, id });
  if (!person) return { ok: false, reason: 'name' };
  if (person.callPhone && !dialable(person.callPhone)) return { ok: false, reason: 'phone' };
  const clean = cleanPeople(list);
  const at = clean.findIndex((p) => p.id === id);
  if (at >= 0) {
    const next = [...clean];
    next[at] = person;
    return { ok: true, list: next, person };
  }
  if (clean.length >= MAX_PEOPLE) return { ok: false, reason: 'full' };
  return { ok: true, list: [...clean, person], person };
}

/** The list without this person, and the photo file that should go with them (if any). */
export function removePerson(list: readonly HelpPerson[], id: string): { list: HelpPerson[]; photo: string | null } {
  const clean = cleanPeople(list);
  const gone = clean.find((p) => p.id === id);
  return { list: clean.filter((p) => p.id !== id), photo: gone?.photoUri ?? null };
}

/** Companions on this trip who have no card yet (offered as one-tap "Add Sam"). */
export function companionsWithoutCard(trip: Pick<Trip, 'companions'> | null, list: readonly HelpPerson[]): Companion[] {
  if (!trip) return [];
  const usedIds = new Set(list.map((p) => p.companionId).filter(Boolean));
  const usedNames = new Set(list.map((p) => p.name.toLocaleLowerCase()));
  return readCompanions(trip).filter((c) => !usedIds.has(c.id) && !usedNames.has(oneLine(c.name, LIMITS.name).toLocaleLowerCase()));
}

export const hasNeeds = (p: Pick<HelpPerson, 'needs' | 'otherNeeds'>): boolean => p.needs.length > 0 || !!p.otherNeeds.trim();

/** The cards this person has: the lost card always, the needs card once a need is ticked or written. */
export const cardsOf = (p: HelpPerson): CardKind[] => (hasNeeds(p) ? ['lost', 'needs'] : ['lost']);

// ------------------------------------------------------------------------------------------------- language

/** The language for the cards: the same pick as the phrase screen, kept only when the help table carries it. */
export function pickHelpLang(
  phrases: PhraseTable,
  help: HelpTable,
  opts: { tripCountry?: string | null; lastUsed?: unknown; phoneCountry?: string | null },
): { lang: PhraseLang; from: LangSource } {
  const pick = pickPhraseLang(phrases, opts);
  if (findHelpLanguage(help, pick.lang)) return pick;
  const first = help.languages.find((l) => isPhraseLang(l.code));
  return { lang: first && isPhraseLang(first.code) ? first.code : pick.lang, from: 'default' };
}

export function findHelpLanguage(table: HelpTable, code: string | null | undefined): HelpLanguage | null {
  if (!code) return null;
  return table.languages.find((l) => l.code === code) ?? null;
}

/** One fixed line: English and the local text (the English again when a language lacks it). */
export type BiLine = { id: LineId; en: string; local: string; lang: PhraseLang };

export function helpLine(table: HelpTable, lang: PhraseLang, id: LineId): BiLine {
  const en = table.sentences.find((s) => s.id === id)?.en ?? id;
  const local = findHelpLanguage(table, lang)?.lines[id]?.text?.trim() || en;
  return { id, en, local, lang };
}

// ------------------------------------------------------------------------------------------------- hotel

export type CardHotel = { name: string; address: string; localAddress: string; phone: string; state: 'now' | 'next' };

/** The hotel for the lost card: the stay you're in now, else the next one; null with no stay booked. */
export function hotelForCards(trips: Trip[], now: number): CardHotel | null {
  const pick = currentHotel(trips, now);
  if (!pick) return null;
  const p = pick.item.place;
  return {
    name: p?.name?.trim() || pick.item.title.trim(),
    address: p?.address?.trim() ?? '',
    localAddress: p?.localAddress?.trim() ?? '',
    phone: p?.phone?.trim() ?? '',
    state: pick.state,
  };
}

/** The hotel's lines as shown on the card: local-language address first (what a local reads), then the other. */
export function hotelText(h: CardHotel): string {
  const lines = [h.name, h.localAddress, h.address !== h.localAddress ? h.address : ''].filter(Boolean);
  return lines.join('\n');
}

// ------------------------------------------------------------------------------------------------- card views

export type CardRow = { label: BiLine; value: string; /** A dialable number for a call button. */ dial?: string };

export type LostView = { kind: 'lost'; title: BiLine; rows: CardRow[]; lines: BiLine[]; photoUri: string | null };
export type NeedsView = { kind: 'needs'; title: BiLine; name: BiLine & { value: string }; needs: BiLine[]; other: CardRow | null };

/** The lost card: title, then name / who to call / hotel / meeting point (each only when known), then the asks. */
export function lostView(table: HelpTable, lang: PhraseLang, p: HelpPerson, hotel: CardHotel | null): LostView {
  const line = (id: LineId) => helpLine(table, lang, id);
  const rows: CardRow[] = [{ label: line('labelName'), value: p.name }];
  const dial = dialable(p.callPhone);
  if (p.callName || p.callPhone) {
    const value = [p.callName, p.callPhone].filter(Boolean).join('\n');
    rows.push(dial ? { label: line('labelCall'), value, dial } : { label: line('labelCall'), value });
  }
  if (hotel) {
    const hDial = dialable(hotel.phone);
    const value = [hotelText(hotel), hotel.phone].filter(Boolean).join('\n');
    rows.push(hDial ? { label: line('labelHotel'), value, dial: hDial } : { label: line('labelHotel'), value });
  }
  if (p.meetingPoint) rows.push({ label: line('labelMeet'), value: p.meetingPoint });
  const lines: BiLine[] = [];
  if (dial) lines.push(line('lostCall'));
  lines.push(line('lostStay'));
  return { kind: 'lost', title: line('lostTitle'), rows, lines, photoUri: p.photoUri ?? null };
}

/** The needs card: title, the ticked needs in fixed order, then what was typed under "Other needs". */
export function needsView(table: HelpTable, lang: PhraseLang, p: HelpPerson): NeedsView {
  const line = (id: LineId) => helpLine(table, lang, id);
  return {
    kind: 'needs',
    title: line('needsTitle'),
    name: { ...line('labelName'), value: p.name },
    needs: normaliseNeeds(p.needs).map(line),
    other: p.otherNeeds.trim() ? { label: line('labelOther'), value: p.otherNeeds.trim() } : null,
  };
}

const bi = (l: BiLine): string => (l.local === l.en ? l.en : `${l.local}\n${l.en}`);
const labelled = (r: CardRow): string => `${r.label.local === r.label.en ? r.label.en : `${r.label.local} / ${r.label.en}`}:\n${r.value}`;

/** Plain text for the share sheet: local language first, English under each line. No photo. */
export function shareText(view: LostView | NeedsView): string {
  const parts: string[] = [bi(view.title)];
  if (view.kind === 'lost') {
    for (const r of view.rows) parts.push(labelled(r));
    for (const l of view.lines) parts.push(bi(l));
  } else {
    parts.push(labelled({ label: view.name, value: view.name.value }));
    for (const n of view.needs) parts.push(bi(n));
    if (view.other) parts.push(labelled(view.other));
  }
  return parts.join('\n\n');
}

/** Base size of the big local text: short lines go bigger (Dynamic Type scales further; the card scrolls). */
export function bigSize(s: string): number {
  const n = [...s.trim()].length;
  if (n <= 14) return 40;
  if (n <= 28) return 34;
  if (n <= 48) return 30;
  return 26;
}

// ------------------------------------------------------------------------------------------------- params

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
export const parseKindParam = (v: unknown): CardKind => (isCardKind(first(v)) ? (first(v) as CardKind) : 'lost');
export const parseIdParam = (v: unknown): string | null => {
  const s = first(v);
  return typeof s === 'string' && s && s.length <= 100 ? s : null;
};

// ------------------------------------------------------------------------------------------------- content check

/** Content problems (empty = good): every phrase language has every line, non-empty, each marked for a native check. */
export function helpTableProblems(table: HelpTable): string[] {
  const out: string[] = [];
  const ids = table.sentences.map((s) => s.id);
  for (const id of LINE_IDS) if (!ids.includes(id)) out.push(`sentence ${id}: no English line`);
  for (const s of table.sentences) {
    if (!(LINE_IDS as readonly string[]).includes(s.id)) out.push(`sentence ${s.id}: unknown id`);
    if (!s.en?.trim()) out.push(`sentence ${s.id}: empty English`);
  }
  const codes = table.languages.map((l) => l.code);
  for (const code of PHRASE_LANGS) if (!codes.includes(code)) out.push(`language ${code}: missing`);
  for (const l of table.languages) {
    if (!isPhraseLang(l.code)) out.push(`language ${l.code}: not a phrase language`);
    for (const id of LINE_IDS) {
      const line = l.lines[id];
      if (!line || !line.text?.trim()) out.push(`${l.code} ${id}: missing`);
      else if (line.check !== true) out.push(`${l.code} ${id}: not marked for a native-speaker check`);
    }
    for (const id of Object.keys(l.lines)) if (!(LINE_IDS as readonly string[]).includes(id)) out.push(`${l.code} ${id}: unknown line`);
  }
  return out;
}
