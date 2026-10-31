// T97 "I'm safe / Share where I am" (owner-1031 D, deepen Emergency). Pure TypeScript for app/safe.tsx:
// - an Open Location Code ("Plus Code") encoder written from the OLC specification (encode only),
// - coordinates as decimal degrees and degrees-minutes-seconds, accuracy rounding,
// - "near <hotel / saved place>" within NEAR_M of the one location check,
// - message templates filled from catalogue strings (a line whose value is missing is left out),
// - sms: URLs (iOS forms, Android form) with an encoded body, and up to MAX_CONTACTS trusted contacts.
// Trusted contacts live only on this phone (SAFE_CONTACTS_KEY in AsyncStorage); they are never part of a trip file.
// T100: one-tap "Add as trusted contact" for people on the emergency card, and the ticks for a send remembered on this
// phone (SAFE_TICKS_KEY), also never in a trip file.
// Nothing here sends anything: the screen opens Messages or the share sheet and the person presses Send.
import type { Trip } from './model.ts';
import { haversineMeters, validLatLon, type LatLon } from './poi.ts';

export const SAFE_CONTACTS_KEY = 'satchel.safeContacts.v1';
export const MAX_CONTACTS = 5;
/** "near <place>" only within this many metres of the position. */
export const NEAR_M = 300;

// ------------------------------------------------------------------------------------------- Open Location Code

export const OLC_ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;
const PADDING = '0';
const BASE = 20;
const PAIR_CODE_LENGTH = 10;
const GRID_CODE_LENGTH = 5;
const GRID_COLUMNS = 4;
const GRID_ROWS = 5;
const MIN_LENGTH = 2;
const MAX_LENGTH = 15;
/** Integer units per degree at the full 15-digit precision: 20^3 * 5^5 (lat) and 20^3 * 4^5 (lon). */
const FINAL_LAT_PRECISION = 8000 * GRID_ROWS ** GRID_CODE_LENGTH; // 25 000 000
const FINAL_LNG_PRECISION = 8000 * GRID_COLUMNS ** GRID_CODE_LENGTH; // 8 192 000
const LAT_UNITS = 180 * FINAL_LAT_PRECISION;
const LNG_UNITS = 360 * FINAL_LNG_PRECISION;

/** A code length the specification allows: 2-15, and even below 10 (pair digits come in twos). */
export const validOlcLength = (n: number): boolean =>
  Number.isInteger(n) && n >= MIN_LENGTH && n <= MAX_LENGTH && (n >= PAIR_CODE_LENGTH || n % 2 === 0);

/** Degrees to non-negative integer units. Latitude is clipped (90 falls in the top cell); longitude wraps. */
function toIntegers(lat: number, lon: number): [number, number] {
  // Round away float noise first (e.g. 20.3700625 * 25e6 = 509251562.49999994), as the reference encoders do.
  let latVal = Math.floor(Math.round(lat * FINAL_LAT_PRECISION * 1e6) / 1e6) + 90 * FINAL_LAT_PRECISION;
  if (latVal < 0) latVal = 0;
  else if (latVal >= LAT_UNITS) latVal = LAT_UNITS - 1;
  let lngVal = Math.floor(Math.round(lon * FINAL_LNG_PRECISION * 1e6) / 1e6) + 180 * FINAL_LNG_PRECISION;
  lngVal = ((lngVal % LNG_UNITS) + LNG_UNITS) % LNG_UNITS;
  return [latVal, lngVal];
}

/**
 * The full Plus Code for a position (default 10 digits, about 14 x 14 m), e.g. 8FVC9G8F+6X. Shorter codes are
 * padded with 0 up to the separator. Throws RangeError for a non-finite position or a length the spec forbids.
 */
export function encodeOlc(lat: number, lon: number, length = PAIR_CODE_LENGTH): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new RangeError('position');
  if (!validOlcLength(length)) throw new RangeError('length');
  let [latVal, lngVal] = toIntegers(lat, lon);
  let code = '';
  if (length > PAIR_CODE_LENGTH) {
    for (let i = 0; i < GRID_CODE_LENGTH; i++) {
      code = OLC_ALPHABET[(latVal % GRID_ROWS) * GRID_COLUMNS + (lngVal % GRID_COLUMNS)] + code;
      latVal = Math.floor(latVal / GRID_ROWS);
      lngVal = Math.floor(lngVal / GRID_COLUMNS);
    }
  } else {
    latVal = Math.floor(latVal / GRID_ROWS ** GRID_CODE_LENGTH);
    lngVal = Math.floor(lngVal / GRID_COLUMNS ** GRID_CODE_LENGTH);
  }
  for (let i = 0; i < PAIR_CODE_LENGTH / 2; i++) {
    code = OLC_ALPHABET[latVal % BASE] + OLC_ALPHABET[lngVal % BASE] + code;
    latVal = Math.floor(latVal / BASE);
    lngVal = Math.floor(lngVal / BASE);
  }
  code = code.slice(0, SEPARATOR_POSITION) + SEPARATOR + code.slice(SEPARATOR_POSITION);
  if (length >= SEPARATOR_POSITION) return code.slice(0, length + 1);
  return code.slice(0, length) + PADDING.repeat(SEPARATOR_POSITION - length) + SEPARATOR;
}

/** "8FVC9G8F+6X" -> "8 F V C 9 G 8 F + 6 X": one character at a time for reading aloud and for screen readers. */
export const spellCode = (code: string): string => [...code].join(' ');

// ------------------------------------------------------------------------------------------------ coordinates

export type Hemispheres = { n: string; s: string; e: string; w: string };
export const HEMI_LETTERS: Hemispheres = { n: 'N', s: 'S', e: 'E', w: 'W' };

/** Signed decimal degrees, latitude first: "48.85837, 2.29448" (5 places is about 1 m). -0 prints as 0. */
export function formatDecimal(lat: number, lon: number, places = 5): string {
  const f = (v: number) => {
    const s = v.toFixed(places);
    return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
  };
  return `${f(lat)}, ${f(lon)}`;
}

export type DmsPart = { deg: number; min: number; sec: number; hemi: string };

/** One coordinate as degrees, minutes and seconds (tenths), carrying 60.0″ into the next minute and degree. */
export function dmsPart(value: number, isLat: boolean, hemi: Hemispheres = HEMI_LETTERS): DmsPart {
  const tenths = Math.round(Math.abs(value) * 36000); // tenths of a second
  const deg = Math.floor(tenths / 36000);
  const min = Math.floor((tenths % 36000) / 600);
  const sec = (tenths % 600) / 10;
  const letter = isLat ? (value < 0 && tenths > 0 ? hemi.s : hemi.n) : value < 0 && tenths > 0 ? hemi.w : hemi.e;
  return { deg, min, sec, hemi: letter };
}

const two = (n: number) => (n < 10 ? `0${n}` : String(n));

/** "48°51′30.1″N 2°17′40.1″E". */
export function formatDms(lat: number, lon: number, hemi: Hemispheres = HEMI_LETTERS): string {
  const f = (p: DmsPart) => `${p.deg}°${two(p.min)}′${p.sec < 10 ? '0' : ''}${p.sec.toFixed(1)}″${p.hemi}`;
  return `${f(dmsPart(lat, true, hemi))} ${f(dmsPart(lon, false, hemi))}`;
}

/** GPS accuracy in metres for display: whole metres under 100, tens beyond; null when unknown or nonsense. */
export function roundAccuracy(acc: number | null | undefined): number | null {
  if (typeof acc !== 'number' || !Number.isFinite(acc) || acc <= 0) return null;
  return acc < 100 ? Math.max(1, Math.round(acc)) : Math.round(acc / 10) * 10;
}

/** Apple Maps pin at the position (https, so it opens on any phone), labelled when a label is given. */
export function appleMapsPinUrl(lat: number, lon: number, label?: string | null): string {
  const base = `https://maps.apple.com/?ll=${lat.toFixed(6)},${lon.toFixed(6)}`;
  const q = label?.trim();
  return q ? `${base}&q=${encodeURIComponent(q)}` : base;
}

/** "14:05 (UTC+9)", "08:30 (UTC-3:30)", "23:59 (UTC)": the phone's clock with its offset (minutes east of UTC). */
export function clockStamp(ms: number, offsetMin: number): string {
  const d = new Date(ms + offsetMin * 60_000);
  const time = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  if (!offsetMin) return `${time} (UTC)`;
  const a = Math.abs(offsetMin);
  const off = `${offsetMin < 0 ? '-' : '+'}${Math.floor(a / 60)}${a % 60 ? `:${two(a % 60)}` : ''}`;
  return `${time} (UTC${off})`;
}

// ---------------------------------------------------------------------------------------------- near a place

export type NearCandidate = LatLon & { name: string; kind: 'hotel' | 'place' };
export type NearHit = NearCandidate & { meters: number };

/** Hotels with coordinates and saved places (not bundled sample points) on every trip, one row per name + spot. */
export function nearCandidates(trips: readonly Trip[]): NearCandidate[] {
  const out: NearCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: NearCandidate) => {
    const key = `${c.name.toLowerCase()}|${c.lat.toFixed(5)}|${c.lon.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  for (const trip of trips) {
    for (const item of trip.items ?? []) {
      const p = item.place;
      if (item.kind !== 'hotel' || !p || !validLatLon(p.lat, p.lon)) continue;
      const name = (p.name?.trim() || item.title?.trim() || '').trim();
      if (name) push({ name, lat: p.lat as number, lon: p.lon as number, kind: 'hotel' });
    }
    for (const p of Array.isArray(trip.places) ? trip.places : []) {
      if (!p || p.sample || typeof p.name !== 'string' || !p.name.trim() || !validLatLon(p.lat, p.lon)) continue;
      push({ name: p.name.trim(), lat: p.lat, lon: p.lon, kind: 'place' });
    }
  }
  return out;
}

/** The closest candidate within maxM metres (ties: hotels first, then list order), or null. */
export function nearestPlace(pos: LatLon, candidates: readonly NearCandidate[], maxM = NEAR_M): NearHit | null {
  if (!validLatLon(pos.lat, pos.lon)) return null;
  let best: NearHit | null = null;
  for (const c of candidates) {
    const meters = haversineMeters(pos, c);
    if (meters > maxM) continue;
    if (!best || meters < best.meters || (meters === best.meters && c.kind === 'hotel' && best.kind !== 'hotel')) best = { ...c, meters };
  }
  return best;
}

// ------------------------------------------------------------------------------------------------ templates

export const TEMPLATE_KINDS = ['safe', 'landed', 'late', 'help'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
export const isTemplateKind = (v: unknown): v is TemplateKind => (TEMPLATE_KINDS as readonly unknown[]).includes(v);

export type TemplateVars = Record<string, string | number | null | undefined>;

/**
 * Fills {name} placeholders. Returns null when any placeholder has no value (missing, null or blank), so a line
 * such as "My hotel: {hotel}" disappears instead of reading "My hotel: ".
 */
export function fillTemplate(template: string, vars: TemplateVars): string | null {
  let missing = false;
  const out = template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    const s = v == null ? '' : String(v).trim();
    if (!s) missing = true;
    return s;
  });
  return missing ? null : out;
}

/** Catalogue strings for one message (the screen passes them in, already translated). */
export type MessageStrings = {
  head: string;
  time: string;
  near: string;
  coords: string;
  accuracy: string;
  plus: string;
  map: string;
  noFix: string;
  hotel: string;
};

export type MessageFacts = {
  time: string;
  /** Present only after a successful location check. */
  position?: { lat: number; lon: number; accuracy: number | null } | null;
  near?: string | null;
  /** "Name, address" of the hotel you're staying at now (or next). */
  hotel?: string | null;
};

/** The message body: headline, time, then where I am (or that no fix was possible), then my hotel. */
export function composeMessage(s: MessageStrings, f: MessageFacts): string {
  const pos = f.position && validLatLon(f.position.lat, f.position.lon) ? f.position : null;
  const vars: TemplateVars = {
    time: f.time,
    place: f.near,
    hotel: f.hotel,
    acc: pos ? roundAccuracy(pos.accuracy) : null,
    coords: pos ? formatDecimal(pos.lat, pos.lon) : null,
    plus: pos ? encodeOlc(pos.lat, pos.lon) : null,
    map: pos ? appleMapsPinUrl(pos.lat, pos.lon) : null,
  };
  const lines = [s.head, s.time, s.near, s.coords, s.accuracy, s.plus, s.map, pos ? null : s.noFix, s.hotel];
  return lines
    .map((l) => (l == null ? null : fillTemplate(l, vars)))
    .filter((l): l is string => !!l)
    .join('\n');
}

// --------------------------------------------------------------------------------------------- phone numbers

/** Digits with an optional leading + (spaces, dashes, dots and brackets dropped); 3-20 digits, else null. */
export function cleanPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || /[^\d+\s().\- ]/.test(t)) return null;
  const plus = t.startsWith('+');
  const digits = t.replace(/\D/g, '');
  if (digits.length < 3 || digits.length > 20 || t.indexOf('+', 1) !== -1) return null;
  return (plus ? '+' : '') + digits;
}

export type SmsPlatform = 'ios' | 'android';

/**
 * An sms: link that opens Messages with the recipients and the body filled in; the person still presses Send.
 * iOS: none -> sms:&body=..., one -> sms:+44...&body=..., several -> sms:/open?addresses=a,b&body=...
 * Android: sms:a,b?body=... Invalid numbers are dropped, duplicates kept once. The body is percent-encoded.
 */
export function smsUrl(recipients: readonly string[], body: string, platform: SmsPlatform = 'ios'): string {
  const nums = [...new Set(recipients.map(cleanPhone).filter((n): n is string => !!n))];
  const text = encodeURIComponent(body);
  if (platform === 'android') return `sms:${nums.map(encodeURIComponent).join(',')}?body=${text}`;
  if (nums.length === 0) return `sms:&body=${text}`;
  if (nums.length === 1) return `sms:${nums[0]}&body=${text}`;
  return `sms:/open?addresses=${nums.map(encodeURIComponent).join(',')}&body=${text}`;
}

// --------------------------------------------------------------------------------------------- trusted contacts

export type SafeContact = { id: string; name: string; phone: string };
export const CONTACT_NAME_MAX = 60;

const cleanName = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, CONTACT_NAME_MAX).trim() : '');

/** Stored contacts, cleaned: valid phone, trimmed name, first of each number kept, at most MAX_CONTACTS. */
export function cleanContacts(raw: unknown): SafeContact[] {
  if (!Array.isArray(raw)) return [];
  const out: SafeContact[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (out.length >= MAX_CONTACTS) break;
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    const phone = cleanPhone(o.phone);
    if (typeof o.id !== 'string' || !o.id || !phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ id: o.id, name: cleanName(o.name), phone });
  }
  return out;
}

export type AddContactResult = { ok: true; list: SafeContact[] } | { ok: false; reason: 'phone' | 'full' | 'duplicate' };

export function addContact(list: readonly SafeContact[], draft: { name?: string | null; phone?: string | null }, id: string): AddContactResult {
  const phone = cleanPhone(draft.phone ?? '');
  if (!phone) return { ok: false, reason: 'phone' };
  const current = cleanContacts(list);
  if (current.some((c) => c.phone === phone)) return { ok: false, reason: 'duplicate' };
  if (current.length >= MAX_CONTACTS) return { ok: false, reason: 'full' };
  return { ok: true, list: [...current, { id, name: cleanName(draft.name), phone }] };
}

export const removeContact = (list: readonly SafeContact[], id: string): SafeContact[] => cleanContacts(list).filter((c) => c.id !== id);

// ------------------------------------------------------------------------- T100: from the emergency card

/** A person on the emergency card (src/core/model.ts EmergencyContact), read loosely. */
export type CardPerson = { id?: string; name?: string | null; phone?: string | null; relation?: string | null };
export type TrustOffer = { key: string; name: string; phone: string; relation?: string };

/**
 * People on the emergency card who can be added as trusted contacts with one tap: a valid phone number that no
 * trusted contact has yet (compared as cleaned digits), one offer per number, in card order. Empty when the trusted
 * list is full.
 */
export function cardContactsToTrust(card: readonly CardPerson[] | null | undefined, trusted: readonly SafeContact[]): TrustOffer[] {
  const current = cleanContacts(trusted);
  if (current.length >= MAX_CONTACTS || !Array.isArray(card)) return [];
  const have = new Set(current.map((c) => c.phone));
  const out: TrustOffer[] = [];
  card.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const phone = cleanPhone(p.phone);
    if (!phone || have.has(phone)) return;
    have.add(phone);
    const relation = typeof p.relation === 'string' ? p.relation.trim() : '';
    out.push({ key: typeof p.id === 'string' && p.id ? p.id : `card_${i}`, name: cleanName(p.name), phone, ...(relation ? { relation } : {}) });
  });
  return out;
}

// ------------------------------------------------------------------------- T100: remembered ticks

/** Which trusted contacts were ticked for the message, on this phone only (never in a trip file). */
export const SAFE_TICKS_KEY = 'satchel.safeTicks.v1';
/** `known`: contacts that existed when the ticks were saved, so a contact added later starts ticked. */
export type SafeTicks = { ticked: string[]; known: string[] };

const idList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))].slice(0, 50) : []);

/** Stored ticks, cleaned (junk reads as nothing remembered). */
export function cleanTicks(raw: unknown): SafeTicks {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ticked: [], known: [] };
  const r = raw as Record<string, unknown>;
  return { ticked: idList(r.ticked), known: idList(r.known) };
}

/**
 * Ids of the contacts to pre-tick: the ones ticked last time, plus any contact added since (ticked by default, as
 * before T100). With nothing remembered every contact is ticked.
 */
export function tickedIds(raw: unknown, contacts: readonly SafeContact[]): Set<string> {
  const t = cleanTicks(raw);
  const ticked = new Set(t.ticked);
  const known = new Set(t.known);
  return new Set(contacts.filter((c) => !known.has(c.id) || ticked.has(c.id)).map((c) => c.id));
}

/** What to store after a tick changes: the ticked ids and every current contact as known. */
export function ticksToStore(contacts: readonly SafeContact[], ticked: ReadonlySet<string>): SafeTicks {
  return { ticked: contacts.filter((c) => ticked.has(c.id)).map((c) => c.id), known: contacts.map((c) => c.id) };
}

/** Flips one contact's tick and returns what to store. */
export function toggleTick(raw: unknown, contacts: readonly SafeContact[], id: string): SafeTicks {
  const now = tickedIds(raw, contacts);
  if (!contacts.some((c) => c.id === id)) return ticksToStore(contacts, now);
  if (now.has(id)) now.delete(id);
  else now.add(id);
  return ticksToStore(contacts, now);
}
