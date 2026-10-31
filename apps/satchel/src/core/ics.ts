// T89 "Add to Calendar": a standard RFC 5545 .ics file for a whole trip, one day or one booking. Pure TS.
// Times: every timed booking is written as a UTC instant ('Z' form, no VTIMEZONE) computed from the item's own
// wall clock and IANA zone (src/core/tz.ts toUtc, DST-safe), so the phone's own zone is never involved and any
// calendar app shows the right moment; the times as printed on the ticket go in the description.
// Stays that run over one or more nights are all-day events (DATE values, DTEND = check-out date, exclusive), so
// they sit on top of the days instead of blocking hours; check-in and check-out times go in the description.
// Privacy: booking codes and the booking's private notes are left out unless the traveller turns them on.
// Seats, documents, attachments, the emergency card and medical notes are never written.
// Bookings this phone can't place in time (a saved zone it can't read) are left out and counted, never guessed.
// Text: CRLF line endings, TEXT escaping (\\ ; , newline), lines folded at 75 octets without splitting a UTF-8
// character. UIDs come from item ids, so exporting the same booking again updates it instead of adding a copy.
import { formatTime, zoneCity } from './format.ts';
import { isTransport, type Item, type ItemKind, type LocalDate, type Trip } from './model.ts';
import { extraDays, sortItems, zonesReadable } from './timeline.ts';
import { addDays, isLocalDateTime, localDate, toUtc } from './tz.ts';

export type IcsScope = { kind: 'trip' } | { kind: 'day'; date: LocalDate } | { kind: 'item'; id: string };

/** Wording for SUMMARY / DESCRIPTION, filled from the catalogue by the screen (tests pass English). */
export type IcsWords = {
  kind: (k: ItemKind) => string;
  /** "Departs 09:30 Tokyo time" / "Check-in 15:00 Kyoto time" etc., by kind; `at` is "09:30 Tokyo time". */
  starts: (k: ItemKind, at: string) => string;
  ends: (k: ItemKind, at: string) => string;
  /** "09:30 Tokyo time" */
  zoneTime: (time: string, city: string) => string;
  /** "Booking code: DMO4KX" */
  code: (ref: string) => string;
  /** "Notes: …" */
  notes: (text: string) => string;
};

export type IcsOptions = {
  scope?: IcsScope;
  /** Booking codes (PNR / reference). Off unless true. */
  includeCodes?: boolean;
  /** The booking's own notes field. Off unless true. */
  includeNotes?: boolean;
  /** DTSTAMP instant (ms); defaults to now. */
  now?: number;
};

export type IcsResult = {
  text: string;
  /** VEVENTs written. 0 = nothing to add (the screen doesn't offer to share an empty calendar). */
  count: number;
  /** Bookings in scope left out because their saved time zone can't be read on this phone. */
  skipped: number;
};

export const ICS_MIME = 'text/calendar';
export const ICS_UTI = 'com.apple.ical.ics';
export const ICS_PRODID = '-//Satchel//Satchel Trips//EN';
const CRLF = '\r\n';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- text primitives ----

/** RFC 5545 §3.3.11 TEXT escaping: backslash, semicolon, comma and line breaks; other control characters dropped. */
export function escapeText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

const utf8Len = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/**
 * RFC 5545 §3.1 folding: no line longer than 75 octets (excluding CRLF); continuation lines begin with one space,
 * which counts toward their 75. Splits only between whole characters (code points), so UTF-8 stays valid.
 */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = utf8Len(ch.codePointAt(0) ?? 0);
    if (bytes + n > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join(CRLF);
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** UTC DATE-TIME form: 20261103T003000Z. */
export function utcStamp(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** DATE form: 20261103. */
export const icsDate = (d: LocalDate) => d.replace(/-/g, '');

/** Stable UID from the item id (characters outside [A-Za-z0-9._-] are hex-escaped, so different ids never collide). */
export function itemUid(id: string): string {
  let safe = '';
  for (const ch of id) safe += /[A-Za-z0-9._-]/.test(ch) ? ch : `=${(ch.codePointAt(0) ?? 0).toString(16)}=`;
  return `${safe}@satchel.trip`;
}

// ---- events ----

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
/** Notes keep their line breaks (only runs of spaces are tidied). */
const cleanMultiline = (s: string | undefined) =>
  (s ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const hasClock = (local: string) => isLocalDateTime(local);
const isDateOnly = (local: string) => DATE_RE.test(local) && isLocalDateTime(`${local}T00:00`);

/** An item that can't be placed: a timed stamp in a zone this phone can't read, or a malformed stamp. */
function placeable(i: Item): boolean {
  if (isDateOnly(i.start.local)) return true;
  if (!hasClock(i.start.local)) return false;
  if (i.end && !hasClock(i.end.local) && !isDateOnly(i.end.local)) return false;
  return zonesReadable(i);
}

/** A stay over at least one night: hotel with a check-out date after its check-in date. */
function isStay(i: Item): boolean {
  if (i.kind !== 'hotel' || !i.end) return false;
  return localDate(i.end.local) > localDate(i.start.local);
}

function location(i: Item): string {
  const join = (name?: string, addr?: string) => {
    const n = clean(name);
    const a = clean(addr);
    if (n && a && a !== n && !a.includes(n)) return `${n}, ${a}`;
    return a || n;
  };
  if (isTransport(i.kind)) return join(i.from?.name, i.from?.address);
  if (i.place) return join(i.place.name, clean(i.place.address) || clean(i.place.localAddress));
  return '';
}

function geo(i: Item): string | null {
  const p = isTransport(i.kind) ? i.from : i.place;
  if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number' || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return null;
  return `${Number(p.lat.toFixed(6))};${Number(p.lon.toFixed(6))}`;
}

function description(i: Item, w: IcsWords, o: { codes: boolean; notes: boolean }): string {
  const lines: string[] = [w.kind(i.kind)];
  if (isTransport(i.kind)) {
    const route = [clean(i.from?.name), clean(i.to?.name)].filter(Boolean).join(' → ');
    if (route && route !== clean(i.title)) lines.push(route);
    const service = [clean(i.carrier), clean(i.number)].filter(Boolean).join(' ');
    if (service) lines.push(service);
  }
  const at = (s: { local: string; tz: string }) => w.zoneTime(formatTime(s.local), zoneCity(s.tz));
  if (hasClock(i.start.local)) lines.push(w.starts(i.kind, at(i.start)));
  if (i.end && hasClock(i.end.local)) lines.push(w.ends(i.kind, at(i.end)));
  const ref = clean(i.ref);
  if (o.codes && ref) lines.push(w.code(ref));
  const notes = cleanMultiline(i.notes);
  if (o.notes && notes) lines.push(w.notes(notes));
  return lines.join('\n');
}

function vevent(i: Item, w: IcsWords, o: { codes: boolean; notes: boolean; stamp: string }): string[] {
  const p = (name: string, value: string) => `${name}:${value}`;
  const lines = ['BEGIN:VEVENT', p('UID', itemUid(i.id)), p('DTSTAMP', o.stamp)];
  if (isDateOnly(i.start.local)) {
    const endDate = i.end && isDateOnly(i.end.local) && i.end.local > i.start.local ? i.end.local : addDays(i.start.local, 1);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(i.start.local)}`, `DTEND;VALUE=DATE:${icsDate(endDate)}`, 'TRANSP:TRANSPARENT');
  } else if (isStay(i)) {
    // Check-out day is exclusive: in 3 Nov, out 6 Nov covers the nights of 3, 4 and 5 Nov.
    lines.push(`DTSTART;VALUE=DATE:${icsDate(localDate(i.start.local))}`, `DTEND;VALUE=DATE:${icsDate(localDate(i.end!.local))}`, 'TRANSP:TRANSPARENT');
  } else {
    const start = toUtc(i.start);
    lines.push(p('DTSTART', utcStamp(start)));
    // RFC 5545: DTEND must be later than DTSTART. Point-in-time items (notes, no end) carry DTSTART only.
    if (i.end && hasClock(i.end.local)) {
      const end = toUtc(i.end);
      if (end > start) lines.push(p('DTEND', utcStamp(end)));
    }
  }
  lines.push(p('SUMMARY', escapeText(clean(i.title) || w.kind(i.kind))));
  const loc = location(i);
  if (loc) lines.push(p('LOCATION', escapeText(loc)));
  const g = geo(i);
  if (g) lines.push(p('GEO', g));
  lines.push(p('DESCRIPTION', escapeText(description(i, w, o))));
  lines.push('END:VEVENT');
  return lines;
}

/** The items a scope covers: a day is what its timeline card shows (bookings starting then, journeys under way). */
export function itemsInScope(trip: Trip, scope: IcsScope): Item[] {
  if (scope.kind === 'item') return trip.items.filter((i) => i.id === scope.id);
  if (scope.kind === 'day') return trip.items.filter((i) => localDate(i.start.local) === scope.date || extraDays(i).includes(scope.date));
  return trip.items;
}

/** The .ics text for the scope. Empty scope: a calendar with no events and count 0. */
export function buildIcs(trip: Trip, words: IcsWords, opts: IcsOptions = {}): IcsResult {
  const scope = opts.scope ?? { kind: 'trip' };
  const o = { codes: opts.includeCodes === true, notes: opts.includeNotes === true, stamp: utcStamp(opts.now ?? Date.now()) };
  const inScope = itemsInScope(trip, scope);
  const ok = inScope.filter(placeable);
  const skipped = inScope.length - ok.length;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${ICS_PRODID}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const name = clean(trip.name);
  if (name) lines.push(`X-WR-CALNAME:${escapeText(name)}`);
  // sortItems puts unreadable zones last; those are already filtered out, so this is real start order.
  for (const i of sortItems(ok)) lines.push(...vevent(i, words, o));
  lines.push('END:VCALENDAR');
  return { text: lines.map(foldLine).join(CRLF) + CRLF, count: ok.length, skipped };
}

/** File name for the export: '<trip name>.ics', '<trip name> <date>.ics' or '<booking title>.ics', safe for Files. */
export function icsFileName(trip: Trip, scope: IcsScope): string {
  const safe = (s: string) =>
    s
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .slice(0, 60)
      .trim();
  const base = safe(trip.name) || 'Trip';
  if (scope.kind === 'day') return `${base} ${scope.date}.ics`;
  if (scope.kind === 'item') {
    const it = trip.items.find((i) => i.id === scope.id);
    return `${safe(it?.title ?? '') || base}.ics`;
  }
  return `${base}.ics`;
}
