// T147 Postcards (owner-1031 D, "less bland and deeper"). A per-trip list of people to write to: a name and a postal
// address (address lines plus a country), a sent tick with the date and the place it was sent from, a "big address"
// layout for the post office counter (address lines large, the country line in capitals as postal services ask), and
// a short "what to write" prompt list drawn from that day's journal pages and ideas (no AI, no network).
//
// Pure TypeScript, no RN imports. Stored on this phone only, one AsyncStorage key per trip (postcardsKey); never on
// the Trip and never in a .satchel trip file (guard test in postcards.test.ts). Plan this trip again copies the
// people (new ids, the same names and addresses) and never the ticks (copyPeople). Words come in through the UI, so
// this file holds no UI text: prompts are typed records the screen turns into catalogue strings.
//
// Sent from: the trip stop whose dates cover the moment the card was ticked, each stop judged on its own IANA zone
// (src/core/weather.ts weatherStops gives the stops with their local dates). The phone's zone is never used.
import type { LocalDate, Trip } from './model.ts';
import { entriesOn, entryPlace, isMood, isWeather, type JournalMood, type JournalWeather } from './journal.ts';
import { ideasOn } from './ideas.ts';
import { fromUtc, isValidZone, localDate } from './tz.ts';

const PREFIX = 'satchel.postcards.v1.';

/** The phone-only storage key for one trip's postcard list. */
export const postcardsKey = (tripId: string): string => `${PREFIX}${tripId}`;
/** True for a key written by this module. */
export const isPostcardsKey = (key: string): boolean => key.startsWith(PREFIX) && key.length > PREFIX.length;

export const LIMITS = { name: 80, line: 120, lines: 8, country: 60, place: 120, people: 200 } as const;

/** When and where a card was sent: the instant (ISO, UTC), the local date and the stop, in that stop's own zone. */
export type Sent = { at: string; date: LocalDate; place: string | null; tz: string };

export type PostcardPerson = {
  id: string;
  name: string;
  /** Address lines as typed (street, town, postcode...), without the country. */
  lines: string[];
  country: string;
  sent: Sent | null;
};

export type PostcardBook = { people: PostcardPerson[] };

export const EMPTY_BOOK: PostcardBook = Object.freeze({ people: Object.freeze([]) as unknown as PostcardPerson[] }) as PostcardBook;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isDay = (v: unknown): v is LocalDate => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** Address text (one line per row, as typed) -> clean lines: trimmed, blanks dropped, capped. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => str(l, LIMITS.line))
    .filter(Boolean)
    .slice(0, LIMITS.lines);
}

function cleanSent(v: unknown): Sent | null {
  if (!isObj(v) || typeof v.at !== 'string' || Number.isNaN(Date.parse(v.at)) || !isDay(v.date)) return null;
  const tz = typeof v.tz === 'string' && isValidZone(v.tz) ? v.tz : 'UTC';
  const place = str(v.place, LIMITS.place) || null;
  return { at: v.at, date: v.date, place, tz };
}

function cleanPerson(v: unknown): PostcardPerson | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id) return null;
  const name = str(v.name, LIMITS.name);
  if (!name) return null;
  const lines = Array.isArray(v.lines) ? v.lines.map((l) => str(l, LIMITS.line)).filter(Boolean).slice(0, LIMITS.lines) : [];
  return { id: v.id, name, lines, country: str(v.country, LIMITS.country), sent: cleanSent(v.sent) };
}

/** The stored list, read defensively (a damaged entry can't crash a screen; bad rows are dropped, ids kept unique). */
export function cleanBook(v: unknown): PostcardBook {
  if (!isObj(v) || !Array.isArray(v.people)) return EMPTY_BOOK;
  const seen = new Set<string>();
  const people: PostcardPerson[] = [];
  for (const raw of v.people) {
    const p = cleanPerson(raw);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    people.push(p);
    if (people.length >= LIMITS.people) break;
  }
  return { people };
}

// ------------------------------------------------------------------------------------------------- people

export type PersonDraft = { name: string; address: string; country: string };
export type PersonError = 'name';

export const newPersonDraft = (): PersonDraft => ({ name: '', address: '', country: '' });
export const draftFromPerson = (p: PostcardPerson): PersonDraft => ({ name: p.name, address: p.lines.join('\n'), country: p.country });
export const validatePerson = (d: PersonDraft): PersonError[] => (str(d.name, LIMITS.name) ? [] : ['name']);

/** Adds a person or, with `id`, updates one (the sent tick is kept on an edit). Unchanged when the draft is invalid. */
export function upsertPerson(book: PostcardBook, d: PersonDraft, newId: (prefix: string) => string, id?: string): PostcardBook {
  if (validatePerson(d).length) return book;
  const fields = { name: str(d.name, LIMITS.name), lines: splitLines(d.address), country: str(d.country, LIMITS.country) };
  const old = id ? book.people.find((p) => p.id === id) : undefined;
  if (old) return { people: book.people.map((p) => (p.id === id ? { ...p, ...fields } : p)) };
  if (book.people.length >= LIMITS.people) return book;
  return { people: [...book.people, { id: newId('pc'), ...fields, sent: null }] };
}

export const removePerson = (book: PostcardBook, id: string): PostcardBook => ({ people: book.people.filter((p) => p.id !== id) });

export const findPerson = (book: PostcardBook, id: string): PostcardPerson | undefined => book.people.find((p) => p.id === id);

// ------------------------------------------------------------------------------------------------- sent

/** A trip stop with its local dates in its own zone (src/core/weather.ts WeatherStop fits). */
export type StopLike = { name: string; tz: string; fromDate: LocalDate; toDate: LocalDate };

const dateIn = (utc: number, tz: string): LocalDate | null => {
  try {
    return localDate(fromUtc(utc, tz));
  } catch {
    return null;
  }
};

/**
 * Where a card ticked at `utc` was sent from: the stop whose dates cover that moment on the stop's own clock (the
 * latest-reached when two do, as on a travel day), else the last stop already reached on its own clock, else the
 * first. The date is that stop's local date. No stops: `fallbackTz` (the zone the traveller is in) and no place.
 */
export function sentFrom(stops: readonly StopLike[], utc: number, fallbackTz: string): Omit<Sent, 'at'> {
  let covering: { s: StopLike; d: LocalDate } | null = null;
  let before: { s: StopLike; d: LocalDate } | null = null;
  for (const s of stops) {
    if (!isValidZone(s.tz)) continue;
    const d = dateIn(utc, s.tz);
    if (!d) continue;
    if (s.fromDate <= d && d <= s.toDate && (!covering || s.fromDate >= covering.s.fromDate)) covering = { s, d };
    if (s.fromDate <= d && (!before || s.fromDate >= before.s.fromDate)) before = { s, d };
  }
  const first = stops.find((s) => isValidZone(s.tz));
  const pick = covering ?? before ?? (first ? { s: first, d: dateIn(utc, first.tz) } : null);
  if (pick && pick.d) return { date: pick.d, place: str(pick.s.name, LIMITS.place) || null, tz: pick.s.tz };
  const tz = isValidZone(fallbackTz) ? fallbackTz : 'UTC';
  return { date: dateIn(utc, tz) ?? new Date(utc).toISOString().slice(0, 10), place: null, tz };
}

/** Ticks a person's card as sent at `utc` (from the stop sentFrom picks), or clears the tick. */
export function setSent(book: PostcardBook, id: string, sent: boolean, utc: number, stops: readonly StopLike[], fallbackTz: string): PostcardBook {
  return {
    people: book.people.map((p) => {
      if (p.id !== id) return p;
      if (!sent) return { ...p, sent: null };
      return { ...p, sent: { at: new Date(utc).toISOString(), ...sentFrom(stops, utc, fallbackTz) } };
    }),
  };
}

/** "3 of 5 sent". */
export function sentCount(book: PostcardBook): { sent: number; total: number } {
  return { sent: book.people.filter((p) => p.sent).length, total: book.people.length };
}

/** People still to write to first (in the order added), then the sent ones (oldest sent first). */
export function orderedPeople(book: PostcardBook): PostcardPerson[] {
  const open = book.people.filter((p) => !p.sent);
  const done = book.people.filter((p) => p.sent).sort((a, b) => (a.sent!.at < b.sent!.at ? -1 : a.sent!.at > b.sent!.at ? 1 : 0));
  return [...open, ...done];
}

// ------------------------------------------------------------------------------------------------- big address

/**
 * The lines for the big address view and for copying: the name, the address lines as typed, then the country line
 * in capitals (as postal services ask, so a sorting office abroad reads it at a glance). Empty parts are left out.
 */
export function addressLines(p: Pick<PostcardPerson, 'name' | 'lines' | 'country'>): { lines: string[]; country: string } {
  const lines = [str(p.name, LIMITS.name), ...p.lines.map((l) => str(l, LIMITS.line))].filter(Boolean);
  return { lines, country: str(p.country, LIMITS.country).toUpperCase() };
}

/** The address as plain text, one line per row (country last, in capitals). */
export function addressText(p: Pick<PostcardPerson, 'name' | 'lines' | 'country'>): string {
  const a = addressLines(p);
  return [...a.lines, a.country].filter(Boolean).join('\n');
}

/** True when there is something to show beyond the name. */
export const hasAddress = (p: Pick<PostcardPerson, 'lines' | 'country'>): boolean => p.lines.length > 0 || !!p.country.trim();

// ------------------------------------------------------------------------------------------------- plan again

/** Plan this trip again: the same people with new ids, names and addresses, never the ticks. */
export function copyPeople(book: PostcardBook, newId: (prefix: string) => string): PostcardBook {
  return { people: book.people.map((p) => ({ id: newId('pc'), name: p.name, lines: [...p.lines], country: p.country, sent: null })) };
}

// ------------------------------------------------------------------------------------------------- what to write

/** One prompt; the screen words it from the postcards.prompt.* catalogue. */
export type Prompt =
  | { kind: 'note'; text: string }
  | { kind: 'place'; name: string }
  | { kind: 'mood'; mood: JournalMood }
  | { kind: 'weather'; weather: JournalWeather }
  | { kind: 'went'; name: string }
  | { kind: 'plan'; name: string }
  | { kind: 'generic'; id: GenericPrompt };

export const GENERIC_PROMPTS = ['food', 'sound', 'surprise', 'wish', 'view'] as const;
export type GenericPrompt = (typeof GENERIC_PROMPTS)[number];

export const MAX_PROMPTS = 5;
const NOTE_CHARS = 90;

/** A journal note's first sentence, cut to a postcard-sized line (whole words, with an ellipsis when cut). */
export function noteLine(note: string, max = NOTE_CHARS): string {
  const flat = note.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const m = flat.match(/^.+?[.!?](?=\s|$)/);
  const first = (m ? m[0] : flat).trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

/**
 * Up to MAX_PROMPTS things to write about on `day`, from that day's journal pages (a line of the note, the place,
 * the mood, the weather) and that day's ideas (been there first, then planned). Topped up with gentle generic
 * prompts so the list is never empty. No duplicates.
 */
export function writePrompts(trip: Trip, day: LocalDate): Prompt[] {
  const out: Prompt[] = [];
  const seen = new Set<string>();
  const add = (p: Prompt, key: string) => {
    if (out.length >= MAX_PROMPTS || seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };
  const entries = entriesOn(trip, day);
  for (const e of entries) {
    const line = noteLine(e.note);
    if (line) add({ kind: 'note', text: line }, `n:${line.toLowerCase()}`);
  }
  for (const e of entries) {
    const place = entryPlace(trip, e);
    if (place?.name) add({ kind: 'place', name: place.name }, `p:${place.name.toLowerCase()}`);
  }
  const ideas = ideasOn(trip, day);
  for (const i of ideas.filter((x) => x.done)) add({ kind: 'went', name: i.name }, `p:${i.name.toLowerCase()}`);
  for (const e of entries) if (isMood(e.mood)) add({ kind: 'mood', mood: e.mood }, `m:${e.mood}`);
  for (const e of entries) if (isWeather(e.weather)) add({ kind: 'weather', weather: e.weather }, `w:${e.weather}`);
  for (const i of ideas.filter((x) => !x.done)) add({ kind: 'plan', name: i.name }, `p:${i.name.toLowerCase()}`);
  for (const id of GENERIC_PROMPTS) add({ kind: 'generic', id }, `g:${id}`);
  return out;
}
