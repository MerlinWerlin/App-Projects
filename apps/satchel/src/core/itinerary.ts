// T170 Itinerary import: turns an itinerary into draft bookings for a trip, offline, on the phone. Nothing is sent
// anywhere. Pure TypeScript (Node runs it). Three ways in, one result shape:
//  - a calendar file (.ics, RFC 5545): every VEVENT becomes a draft. Times with a TZID keep that zone's wall clock;
//    UTC ('Z') times are read in the zone of a city named in the event's location or title, else the fallback zone
//    (marked low confidence); all-day events become a hotel stay when they run over nights and the title says so,
//    else an all-day note at 09:00. Cancelled events, alarms and repeat rules beyond the first time are left out.
//  - timetable-style text ("Day 2 · Tue 4 Mar" then "09:00 Breakfast", "10:30–12:00 Louvre tour @ Rue de Rivoli"):
//    a line that starts with a time is a plan, and a date or "Day N" line on its own sets the day for the lines
//    under it. Times stay the wall clock as written, in the zone of a city the text names, else the fallback zone.
//  - booking confirmations (flights, stays, trains, car hire...): src/core/pasteparse.ts reads those; its drafts are
//    merged in here, and a timetable line at the same day and time as a booking is not added twice.
// Every draft is an ItemDraft for the normal booking form (src/core/trips.ts itemFromDraft), so nothing new is
// stored: restaurants, tours and transfers are activities whose title says what they are (src/core/dayview.ts
// gives them their own icon on the Today timetable).
import { airportByCode, zoneFromCity } from './airports.ts';
import type { Item, ItemKind, LocalDate, Trip } from './model.ts';
import { findDates, findTimes, parseBookings, type PasteBooking } from './pasteparse.ts';
import { newItemDraft, validateItem, type ItemDraft } from './trips.ts';
import { addDays, fromUtc, isLocalDateTime, isValidZone, toUtc } from './tz.ts';

export type ImportSource = 'calendar' | 'plan' | 'booking';

export type ImportedPlan = {
  /** Stable within one parse (used as the list key and for the on / off ticks). */
  key: string;
  source: ImportSource;
  draft: ItemDraft;
  /** True when the time or zone is a best guess the traveller should glance at. */
  check: boolean;
};

export type ImportOptions = {
  /** Today ('YYYY-MM-DD'): the year for dates written without one. */
  now: LocalDate;
  /** Zone for times the text gives no clue about (the trip's destination zone, else the phone's). */
  fallbackTz: string;
  /** "Day 1" in the text means this date (the trip's first day). */
  firstDay?: LocalDate;
  /** Day for timetable lines with no date above them (the day being added to). */
  defaultDay?: LocalDate;
  /** Read 03/04/2027 as 4 March (US order). */
  us?: boolean;
};

/** Longest text read (a long email thread or a big calendar export). */
export const MAX_IMPORT_CHARS = 200_000;
/** Most drafts one import offers (a whole-year calendar export is cut, not frozen on). */
export const MAX_IMPORT_ITEMS = 300;

// ---------------------------------------------------------------------------------------------------------------
// What an event is, from its words

const FLIGHT_NO = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/;
const KIND_WORDS: { kind: ItemKind; re: RegExp }[] = [
  { kind: 'flight', re: /\b(flight|fly|flying|airlines?|airways|depart(?:s|ure)?\s+\w+\s+airport)\b|✈/i },
  { kind: 'train', re: /\b(train|rail|shinkansen|eurostar|tgv|ice\s+\d|amtrak|metro\s+line)\b|🚆/i },
  { kind: 'ferry', re: /\b(ferry|boat\s+to|sailing|catamaran|hydrofoil)\b|⛴/i },
  { kind: 'bus', re: /\b(bus|coach|shuttle|transfer|airport\s+pick[\s-]?up|private\s+driver|chauffeur)\b|🚌/i },
  { kind: 'car', re: /\b(car\s+hire|car\s+rental|rental\s+car|hire\s+car|pick\s+up\s+(?:the\s+)?car)\b/i },
  { kind: 'hotel', re: /\b(hotel|stay\s+at|check[\s-]?in\s+at|ryokan|hostel|airbnb|resort|apartment|guesthouse|b&b|inn)\b|🏨/i },
];

/** The booking kind an event's title (and location / notes) suggests; 'activity' when nothing does. */
export function guessKind(title: string, extra = ''): ItemKind {
  const text = `${title} ${extra}`;
  // "Breakfast at the hotel", "Dinner cruise", "Meet the driver": a plan in the day, whatever place it names.
  if (/^\s*(?:breakfast|brunch|lunch|dinner|supper|drinks|coffee|meet|meeting)(?![a-z])/i.test(title)) return 'activity';
  for (const k of KIND_WORDS) if (k.re.test(title)) return k.kind;
  if (FLIGHT_NO.test(title) && /\b[A-Z]{3}\b.*\b[A-Z]{3}\b|→|->|\bto\b/.test(title)) return 'flight';
  for (const k of KIND_WORDS) if (k.kind !== 'bus' && k.kind !== 'hotel' && k.re.test(text)) return k.kind;
  return 'activity';
}

/** "SYD → NRT", "Sydney to Tokyo", "Paris - London": the two ends of a journey written in a title. */
export function routeIn(title: string): { from: string; to: string } | null {
  const m = /([\p{L}][\p{L} .'()]{1,40}?)\s*(?:→|->|–>|\bto\b|\s[-–]\s)\s*([\p{L}][\p{L} .'()]{1,40})/u.exec(title.replace(/^(?:flight|train|ferry|bus|coach)\s*:?\s*([A-Z0-9]{2}\s?\d{1,4}\s*)?/i, ''));
  if (!m) return null;
  const clean = (s: string) => s.replace(/\(.*?\)/g, '').trim();
  const from = clean(m[1]);
  const to = clean(m[2]);
  return from && to ? { from, to } : null;
}

/** Zone for a place written in text: an airport code, else a city in the bundled table. */
function zoneFor(text: string): string | undefined {
  for (const code of text.match(/\b[A-Z]{3}\b/g) ?? []) {
    const a = airportByCode(code);
    if (a?.tz && isValidZone(a.tz)) return a.tz;
  }
  const c = zoneFromCity(text);
  return c && isValidZone(c.tz) ? c.tz : undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Calendar files (.ics)

/** True when the text is an iCalendar file (or a pasted one). */
export const looksLikeIcs = (text: string) => /BEGIN:VCALENDAR/i.test(text.slice(0, 4000)) || /^\s*BEGIN:VEVENT/im.test(text.slice(0, 4000));

/** RFC 5545 §3.1: a line that starts with a space or tab continues the one before it. */
export function unfoldIcs(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

/** RFC 5545 §3.3.11 TEXT: \n, \, \; and \\ back to plain text. */
export function unescapeIcs(s: string): string {
  return s.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

type IcsProp = { name: string; params: Record<string, string>; value: string };

function readProp(line: string): IcsProp | null {
  // NAME;PARAM=a;PARAM="b:c":VALUE — the value starts at the first colon outside quotes.
  let inQuote = false;
  let at = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ':' && !inQuote) {
      at = i;
      break;
    }
  }
  if (at < 0) return null;
  const head = line.slice(0, at).split(';');
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(at + 1) };
}

/** Windows zone names some calendar apps write as TZID (a few common ones; others fall back). */
const WINDOWS_ZONES: Record<string, string> = {
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'E. Australia Standard Time': 'Australia/Brisbane',
  'Cen. Australia Standard Time': 'Australia/Adelaide',
  'W. Australia Standard Time': 'Australia/Perth',
  'Tasmania Standard Time': 'Australia/Hobart',
  'New Zealand Standard Time': 'Pacific/Auckland',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore',
  'SE Asia Standard Time': 'Asia/Bangkok',
  'India Standard Time': 'Asia/Kolkata',
  'Arabian Standard Time': 'Asia/Dubai',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest',
  'GTB Standard Time': 'Europe/Athens',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  UTC: 'UTC',
};

/** An IANA zone from a TZID parameter ("Europe/Paris", "/Europe/Paris", a Windows name), or undefined. */
export function zoneFromTzid(tzid: string | undefined): string | undefined {
  if (!tzid) return undefined;
  const t = tzid.trim().replace(/^\/+/, '');
  if (WINDOWS_ZONES[t]) return WINDOWS_ZONES[t];
  if (t.includes('/') && isValidZone(t)) return t;
  // "/freeassociation.sourceforge.net/Tzfile/Europe/Paris" and similar: the last two parts.
  const tail = t.split('/').slice(-2).join('/');
  return tail.includes('/') && isValidZone(tail) ? tail : undefined;
}

type IcsWhen = { kind: 'date'; date: LocalDate } | { kind: 'utc'; utc: number } | { kind: 'local'; local: string; tz?: string };

function readWhen(p: IcsProp | undefined): IcsWhen | null {
  if (!p) return null;
  const v = p.value.trim();
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (d) {
    const date = `${d[1]}-${d[2]}-${d[3]}`;
    return isLocalDateTime(`${date}T00:00`) ? { kind: 'date', date } : null;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  const local = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  if (!isLocalDateTime(local)) return null;
  if (m[7]) return { kind: 'utc', utc: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) };
  return { kind: 'local', local, tz: zoneFromTzid(p.params.TZID) };
}

/** ISO 8601 duration (P1D, PT1H30M, P1W) in minutes, or null. */
export function durationMinutes(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m || v.trim() === 'P' || /T$/.test(v.trim())) return null;
  const min = (+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 1440 + +(m[4] ?? 0) * 60 + +(m[5] ?? 0) + Math.round(+(m[6] ?? 0) / 60);
  return m[1] === '-' ? -min : min;
}

type RawEvent = Record<string, IcsProp>;

/** The VEVENTs in a calendar file (alarms and other nested parts skipped). Never throws. */
export function icsEvents(text: string): RawEvent[] {
  const out: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let nested = 0;
  for (const line of unfoldIcs(text.slice(0, MAX_IMPORT_CHARS))) {
    const p = readProp(line.trim());
    if (!p) continue;
    if (p.name === 'BEGIN') {
      const what = p.value.trim().toUpperCase();
      if (what === 'VEVENT' && !cur) {
        cur = {};
        nested = 0;
      } else if (cur) nested++;
      continue;
    }
    if (p.name === 'END') {
      const what = p.value.trim().toUpperCase();
      if (cur && nested > 0) nested--;
      else if (cur && what === 'VEVENT') {
        out.push(cur);
        cur = null;
      }
      continue;
    }
    if (cur && nested === 0 && !(p.name in cur)) cur[p.name] = p;
  }
  return out;
}

const tidy = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Drafts from a calendar file. */
export function parseIcs(text: string, opts: ImportOptions): ImportedPlan[] {
  const out: ImportedPlan[] = [];
  for (const ev of icsEvents(text)) {
    if (out.length >= MAX_IMPORT_ITEMS) break;
    if (ev.STATUS && /CANCELL?ED/i.test(ev.STATUS.value)) continue;
    const title = oneLine(unescapeIcs(ev.SUMMARY?.value ?? ''));
    const location = oneLine(unescapeIcs(ev.LOCATION?.value ?? ''));
    const notes = tidy(unescapeIcs(ev.DESCRIPTION?.value ?? '')).slice(0, 2000);
    const start = readWhen(ev.DTSTART);
    if (!start || (!title && !location)) continue;
    let end = readWhen(ev.DTEND);
    if (!end && ev.DURATION) {
      const min = durationMinutes(ev.DURATION.value);
      if (min !== null && min > 0) {
        if (start.kind === 'date') end = { kind: 'date', date: addDays(start.date, Math.max(1, Math.round(min / 1440))) };
        else if (start.kind === 'utc') end = { kind: 'utc', utc: start.utc + min * 60_000 };
        else end = { kind: 'local', local: shiftLocal(start.local, min), tz: start.tz };
      }
    }
    const kind = guessKind(title || location, `${location} ${notes}`);
    const placeZone = zoneFor(`${location} ${title}`);
    // A journey's end is read on the clock where it arrives (its route's second place), when the title names it.
    const route = isTransportKind(kind) ? routeIn(title) ?? routeIn(location) : null;
    const arriveZone = route ? zoneFor(route.to) : undefined;
    const zone = placeZone ?? opts.fallbackTz;
    let check = false;
    const d = newItemDraft(kind, opts.now, zone);
    d.title = title || location;
    d.notes = notes;
    d.ref = refIn(`${title}\n${notes}`) ?? '';
    const stamp = (w: IcsWhen, tzHint?: string): { date: string; time: string; tz: string } => {
      if (w.kind === 'date') return { date: w.date, time: '', tz: tzHint ?? zone };
      if (w.kind === 'utc') {
        const tz = tzHint ?? zone;
        if (!tzHint && !placeZone) check = true;
        const local = fromUtc(w.utc, tz);
        return { date: local.slice(0, 10), time: local.slice(11, 16), tz };
      }
      const tz = w.tz ?? tzHint ?? zone;
      if (!w.tz && !tzHint && !placeZone) check = true;
      return { date: w.local.slice(0, 10), time: w.local.slice(11, 16), tz };
    };
    const s = stamp(start);
    const e = end ? stamp(end, end.kind === 'utc' ? arriveZone : start.kind === 'local' ? start.tz : undefined) : null;
    if (start.kind === 'date') {
      // All day: a stay when it runs over nights and reads like one; else a note at 09:00 on the day.
      const lastDay = end && end.kind === 'date' && end.date > start.date ? end.date : addDays(start.date, 1);
      const nights = Math.round((toUtc({ local: `${lastDay}T00:00`, tz: 'UTC' }) - toUtc({ local: `${start.date}T00:00`, tz: 'UTC' })) / 86_400_000);
      if (nights >= 1 && (kind === 'hotel' || /\b(stay|nights?|accommodation)\b/i.test(title))) {
        Object.assign(d, newItemDraft('hotel', start.date, zone), { title: d.title, notes: d.notes, ref: d.ref });
        d.endDate = lastDay;
        check = true;
      } else {
        Object.assign(d, newItemDraft('note', start.date, zone), { title: d.title, notes: d.notes });
        d.startTime = '09:00';
        check = true;
      }
    } else {
      d.startDate = s.date;
      d.startTime = s.time;
      d.startTz = s.tz;
      if (e && e.time) {
        d.endDate = e.date;
        d.endTime = e.time;
        d.endTz = e.tz;
      } else {
        d.endDate = '';
        d.endTime = '';
        d.endTz = s.tz;
      }
    }
    fillPlace(d, location, title);
    out.push({ key: `cal-${out.length}`, source: 'calendar', draft: fitKind(d), check });
  }
  return out;
}

const isTransportKind = (k: ItemKind) => k === 'flight' || k === 'train' || k === 'ferry' || k === 'bus';

/** A local wall time plus minutes (no zone involved: the event's own clock). */
function shiftLocal(local: string, min: number): string {
  return fromUtc(toUtc({ local, tz: 'UTC' }) + min * 60_000, 'UTC');
}

/** "Booking reference: ABC123", "Confirmation #ABC123", "PNR ABC123". */
function refIn(text: string): string | undefined {
  const m = /\b(?:booking\s*(?:ref(?:erence)?|code|number)|confirmation(?:\s*(?:code|number|no\.?))?|reservation\s*(?:code|number)|pnr|ref(?:erence)?)\s*[:#]?\s*([A-Z0-9]{5,10})\b/i.exec(text);
  return m && /\d|^[A-Z]{6}$/.test(m[1]) ? m[1].toUpperCase() : undefined;
}

/** Where it happens: from → to for journeys, a place for the rest. */
function fillPlace(d: ItemDraft, location: string, title: string) {
  if (d.kind === 'flight' || d.kind === 'train' || d.kind === 'ferry' || d.kind === 'bus') {
    const r = routeIn(title) ?? routeIn(location);
    if (r) {
      d.fromName = r.from;
      d.toName = r.to;
    } else if (location) d.fromName = location;
    const f = FLIGHT_NO.exec(title);
    if (d.kind === 'flight' && f) d.number = `${f[1]}${f[2]}`;
    return;
  }
  if (!location) return;
  const [name, ...rest] = location.split(/,\s*/);
  d.placeName = name.trim();
  d.address = rest.join(', ').trim() || (d.placeName === location ? '' : location);
  if (!d.address && /\d/.test(d.placeName)) {
    d.address = location;
    d.placeName = '';
  }
}

/**
 * Makes the draft fit the form's rules for its kind: a journey or car with no end time becomes an activity (it still
 * shows at its time, with its own icon), so a draft is never offered that the form would refuse.
 */
function fitKind(d: ItemDraft): ItemDraft {
  const errs = validateItem(d);
  if (errs.includes('endRequired') || errs.includes('end') || errs.includes('endTz') || errs.includes('endBeforeStart')) {
    const route = [d.fromName, d.toName].filter(Boolean).join(' → ');
    return {
      ...d,
      kind: 'activity',
      placeName: d.placeName || (route && d.toName ? '' : d.fromName),
      fromName: '',
      toName: '',
      endDate: errs.includes('endBeforeStart') || !d.endTime ? '' : d.endDate,
      endTime: errs.includes('endBeforeStart') || !d.endTime ? '' : d.endTime,
      number: '',
      seat: '',
      carrier: '',
    };
  }
  return d;
}

// ---------------------------------------------------------------------------------------------------------------
// Timetable-style text

const DAY_N = /^\s*(?:[-*•·]\s*)?day\s*(\d{1,3})\b/i;
const LEAD_TIME = /^\s*(?:[-*•·–]\s*)?(?:(?:at|from)\s+)?(\d{1,2}(?:[:.][0-5]\d)?\s*(?:[ap]\.?\s?m\.?)?|noon|midday)\b/i;
const SEP = /^[\s\-–—:|·•,]+|[\s\-–—:|·•,]+$/g;

/** "Free time", "At leisure", "Own time" and similar: a free block, not a booking. */
export const FREE_WORDS = /\b(free\s+(?:time|day|afternoon|morning|evening)|at\s+(?:your\s+)?leisure|own\s+time|day\s+at\s+leisure|nothing\s+planned)\b/i;

/** Drafts from a day-by-day itinerary ("Day 1", dated headings, then lines that start with a time). */
export function parsePlanText(text: string, opts: ImportOptions): ImportedPlan[] {
  const out: ImportedPlan[] = [];
  const lines = text.slice(0, MAX_IMPORT_CHARS).replace(/\r\n?/g, '\n').split('\n');
  const cityTz = zoneFor(text.slice(0, 5000));
  const tz = cityTz ?? opts.fallbackTz;
  let day: LocalDate | undefined;
  let dayKnown = false;
  for (const raw of lines) {
    if (out.length >= MAX_IMPORT_ITEMS) break;
    const line = raw.replace(/[   ]/g, ' ').trim();
    if (!line) continue;
    const lead = LEAD_TIME.exec(line);
    const times = findTimes(line);
    const startsWithTime = !!lead && (times.length > 0 ? times[0].at <= lead[0].length : /noon|midday/i.test(lead[1]));
    if (!startsWithTime) {
      // A heading: "Day 3", "Day 3 – Thu 6 Mar", "Thursday 6 March".
      const dn = DAY_N.exec(line);
      const dates = findDates(line, { now: opts.now, us: opts.us });
      if (dates.length && line.length < 80) {
        day = dates[0].date;
        dayKnown = true;
      } else if (dn && opts.firstDay) {
        day = addDays(opts.firstDay, Math.max(0, +dn[1] - 1));
        dayKnown = true;
      }
      continue;
    }
    // A plan line.
    const t1 = times[0]?.time ?? '12:00';
    const t2 = times[1] && /^[\s\-–—to]+$/i.test(line.slice(times[0].end, times[1].at)) ? times[1].time : '';
    const cutAt = t2 ? times[1].end : times[0] ? times[0].end : lead![0].length;
    let rest = line.slice(cutAt).replace(SEP, '').trim();
    const dates = findDates(rest, { now: opts.now, us: opts.us });
    let date = day ?? opts.defaultDay;
    if (dates.length) {
      date = dates[0].date;
      rest = (rest.slice(0, dates[0].at) + rest.slice(dates[0].end)).replace(SEP, '').trim();
    }
    if (!rest || !date) continue;
    let [title, place] = rest.split(/\s+@\s+|\s+\|\s+/);
    title = title.replace(SEP, '').trim();
    place = (place ?? '').replace(SEP, '').trim();
    if (!title) continue;
    const free = FREE_WORDS.test(title);
    const kind = free ? 'note' : guessKind(title, place);
    const d = newItemDraft(kind, date, tz);
    d.title = title;
    d.startDate = date;
    d.startTime = t1;
    d.startTz = tz;
    d.endDate = t2 ? (t2 < t1 ? addDays(date, 1) : date) : '';
    d.endTime = t2;
    d.endTz = tz;
    if (kind === 'hotel') {
      d.placeName = place || title.replace(/^(?:check[\s-]?in\s*(?:at|:)?\s*)/i, '').trim();
      // A check-in line is a point in the day: the stay's nights are unknown, so one night is offered (check it).
      if (!t2) {
        d.endDate = addDays(date, 1);
        d.endTime = '11:00';
      }
    } else fillPlace(d, place, title);
    out.push({ key: `plan-${out.length}`, source: 'plan', draft: fitKind(d), check: !dayKnown || !cityTz || kind === 'hotel' });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// One entry point for the screen

/** Everything found in a piece of text: calendar file, else confirmations plus timetable lines (no doubles). */
export function parseItinerary(text: string, opts: ImportOptions): ImportedPlan[] {
  try {
    if (typeof text !== 'string' || !text.trim()) return [];
    if (looksLikeIcs(text)) return parseIcs(text, opts);
    // JSON: booking markup from an email, or the reply from the traveller's own AI chat.
    if (looksLikeJson(text)) {
      const v = jsonIn(text);
      if (v !== undefined) return isJsonLd(v) ? parseJsonLd(v, opts) : readAiReply(text, opts).plans;
    }
    const bookings: ImportedPlan[] = parseBookings(text.slice(0, 50_000), { now: opts.now, us: opts.us, fallbackTz: opts.fallbackTz })
      .filter((b: PasteBooking) => b.draft.startDate && b.draft.startTime && isValidZone(b.draft.startTz))
      .map((b, i) => ({ key: `bk-${i}`, source: 'booking' as const, draft: fitKind({ ...b.draft, title: b.draft.title.trim() || b.draft.placeName || b.draft.toName }), check: Object.values(b.confidence).includes('low') }));
    const taken = new Set(bookings.map((b) => `${b.draft.startDate}T${b.draft.startTime}`));
    const plans = parsePlanText(text, opts).filter((p) => !taken.has(`${p.draft.startDate}T${p.draft.startTime}`));
    return [...bookings, ...plans].slice(0, MAX_IMPORT_ITEMS);
  } catch {
    return [];
  }
}

/** Drafts the form would accept (anything else is not offered). */
export const usable = (list: readonly ImportedPlan[]) => list.filter((p) => validateItem(p.draft).length === 0);

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** True when the trip already has this plan: same start (wall clock and zone) and the same title or kind + number. */
export function alreadyPlanned(p: ImportedPlan, trip: Pick<Trip, 'items'>): boolean {
  const start = `${p.draft.startDate}T${p.draft.startTime}`;
  return trip.items.some(
    (it: Item) => it.start.local === start && (norm(it.title) === norm(p.draft.title) || (it.kind === p.draft.kind && !!p.draft.number && norm(it.number) === norm(p.draft.number))),
  );
}

/** The trip dates an import covers, so the screen can offer to widen the trip. */
export function importSpan(list: readonly ImportedPlan[]): { from: LocalDate; to: LocalDate } | null {
  const days = list.flatMap((p) => [p.draft.startDate, p.draft.endDate]).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return days.length ? { from: days[0], to: days[days.length - 1] } : null;
}

/** The trip whose dates hold most of the imported plans (within 3 days), else undefined. */
export function tripForImport<T extends Pick<Trip, 'id' | 'startDate' | 'endDate'>>(list: readonly ImportedPlan[], trips: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestN = 0;
  for (const t of trips) {
    const from = addDays(t.startDate, -3);
    const to = addDays(t.endDate, 3);
    const n = list.filter((p) => p.draft.startDate >= from && p.draft.startDate <= to).length;
    if (n > bestN) {
      best = t;
      bestN = n;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
// T170: structured data — schema.org booking markup (JSON-LD) and replies from the traveller's own AI chat

/** The text is JSON (an array or object), possibly inside a ``` code fence as AI chats write it. */
export function jsonIn(text: string): unknown | undefined {
  const t = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const body = (fenced ? fenced[1] : t).trim();
  const from = body.search(/[[{]/);
  if (from < 0 || from > 200) return undefined;
  const open = body[from];
  const to = body.lastIndexOf(open === '[' ? ']' : '}');
  if (to <= from) return undefined;
  try {
    return JSON.parse(body.slice(from, to + 1));
  } catch {
    return undefined;
  }
}

/** Text that is meant to be JSON (starts with [ or {, or has a ``` code fence as AI chats write): its errors are worth showing. */
export const looksLikeJson = (text: string) => /^\s*[[{]|```/.test(text);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const types = (o: Obj): string[] => (Array.isArray(o['@type']) ? (o['@type'] as unknown[]).map(str) : [str(o['@type'])]);
const nameOf = (v: unknown): string => (isObj(v) ? str(v.name) || str(v.iataCode) : str(v));
function addressText(v: unknown): string {
  if (!isObj(v)) return str(v);
  return [v.streetAddress, v.addressLocality, v.addressRegion, v.postalCode, isObj(v.addressCountry) ? v.addressCountry.name : v.addressCountry].map(str).filter(Boolean).join(', ');
}
/** "2027-03-12T09:30:00+11:00" -> the wall clock as written (date, HH:mm). */
function wall(v: unknown): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(str(v));
  return m ? { date: m[1], time: m[2] ? `${m[2]}:${m[3]}` : '' } : { date: '', time: '' };
}

/** Every object in a JSON-LD value (arrays and @graph opened). */
function nodes(v: unknown, out: Obj[] = [], depth = 0): Obj[] {
  if (depth > 6) return out;
  if (Array.isArray(v)) for (const x of v) nodes(x, out, depth + 1);
  else if (isObj(v)) {
    if (Array.isArray(v['@graph'])) nodes(v['@graph'], out, depth + 1);
    else out.push(v);
  }
  return out;
}

/** True when the value carries schema.org markup. */
export const isJsonLd = (v: unknown) => nodes(v).some((o) => '@type' in o || '@context' in o);

/** Drafts from schema.org reservations (flights, stays, trains, buses, boats, car hire, restaurants, events, taxis). */
export function parseJsonLd(value: unknown, opts: ImportOptions): ImportedPlan[] {
  const out: ImportedPlan[] = [];
  for (const r of nodes(value)) {
    if (out.length >= MAX_IMPORT_ITEMS) break;
    const t = types(r).find((x) => /Reservation$/.test(x)) ?? '';
    if (!t || /Cancel/i.test(str(r.reservationStatus))) continue;
    const f: Obj = isObj(r.reservationFor) ? r.reservationFor : {};
    const ref = str(r.reservationNumber) || str(r.confirmationNumber);
    let kind: ItemKind = 'activity';
    let title = '';
    let start = { date: '', time: '' };
    let end = { date: '', time: '' };
    let from = '';
    let to = '';
    let fromCode = '';
    let toCode = '';
    let place = '';
    let address = '';
    let number = '';
    let carrier = '';
    if (t === 'FlightReservation') {
      kind = 'flight';
      const air = isObj(f.airline) ? f.airline : {};
      carrier = str(air.name);
      const fn = str(f.flightNumber);
      number = /^[A-Z0-9]{2}\d/.test(fn) ? fn : `${str(air.iataCode)}${fn}`;
      fromCode = isObj(f.departureAirport) ? str(f.departureAirport.iataCode) : '';
      toCode = isObj(f.arrivalAirport) ? str(f.arrivalAirport.iataCode) : '';
      from = nameOf(f.departureAirport);
      to = nameOf(f.arrivalAirport);
      start = wall(f.departureTime);
      end = wall(f.arrivalTime);
      title = [carrier || 'Flight', number].filter(Boolean).join(' ');
    } else if (t === 'TrainReservation' || t === 'BusReservation' || t === 'BoatReservation') {
      kind = t === 'TrainReservation' ? 'train' : t === 'BusReservation' ? 'bus' : 'ferry';
      from = nameOf(f.departureStation ?? f.departureBusStop ?? f.departureBoatTerminal);
      to = nameOf(f.arrivalStation ?? f.arrivalBusStop ?? f.arrivalBoatTerminal);
      number = str(f.trainNumber ?? f.busNumber);
      carrier = nameOf(f.provider ?? f.busCompany ?? r.provider);
      start = wall(f.departureTime);
      end = wall(f.arrivalTime);
      title = [str(f.trainName ?? f.busName) || carrier, number].filter(Boolean).join(' ') || `${from} → ${to}`;
    } else if (t === 'LodgingReservation') {
      kind = 'hotel';
      title = nameOf(f) || 'Stay';
      place = title;
      address = addressText(f.address);
      start = wall(r.checkinTime ?? r.checkinDate);
      end = wall(r.checkoutTime ?? r.checkoutDate);
      if (!start.time) start.time = '15:00';
      if (!end.time) end.time = '11:00';
    } else if (t === 'RentalCarReservation') {
      kind = 'car';
      carrier = nameOf(f.rentalCompany ?? r.provider);
      title = [carrier, nameOf(f)].filter(Boolean).join(' · ') || 'Car hire';
      place = nameOf(r.pickupLocation);
      address = addressText(isObj(r.pickupLocation) ? r.pickupLocation.address : '');
      start = wall(r.pickupTime);
      end = wall(r.dropoffTime);
    } else if (t === 'FoodEstablishmentReservation') {
      title = nameOf(f) || 'Restaurant';
      place = title;
      address = addressText(f.address);
      start = wall(r.startTime ?? r.startDate);
      end = wall(r.endTime);
    } else if (t === 'TaxiReservation') {
      title = `Transfer${nameOf(r.provider) ? ` · ${nameOf(r.provider)}` : ''}`;
      place = nameOf(r.pickupLocation);
      address = addressText(isObj(r.pickupLocation) ? r.pickupLocation.address : '');
      start = wall(r.pickupTime);
    } else {
      // EventReservation and any other reservation with a start.
      title = nameOf(f) || str(r.name) || 'Booking';
      const loc = f.location;
      place = nameOf(loc);
      address = addressText(isObj(loc) ? loc.address : '');
      start = wall(f.startDate ?? r.startTime ?? r.startDate);
      end = wall(f.endDate ?? r.endTime);
    }
    if (!start.date) continue;
    const startZone = (fromCode && zoneFor(fromCode)) || zoneFor(`${from} ${place} ${address}`);
    const endZone = (toCode && zoneFor(toCode)) || (to ? zoneFor(to) : undefined) || startZone;
    const tz = startZone ?? opts.fallbackTz;
    const d = newItemDraft(kind, start.date, tz);
    Object.assign(d, {
      title,
      startDate: start.date,
      startTime: start.time || '09:00',
      startTz: tz,
      endDate: end.date && end.time ? end.date : '',
      endTime: end.date && end.time ? end.time : '',
      endTz: endZone ?? tz,
      fromName: from && fromCode && !from.includes(fromCode) ? `${from} (${fromCode})` : from,
      toName: to && toCode && !to.includes(toCode) ? `${to} (${toCode})` : to,
      placeName: place,
      address,
      ref,
      number,
      carrier,
      seat: isObj(r.reservedTicket) && isObj(r.reservedTicket.ticketedSeat) ? str(r.reservedTicket.ticketedSeat.seatNumber) : '',
    });
    out.push({ key: `ld-${out.length}`, source: 'booking', draft: fitKind(d), check: !startZone || !start.time });
  }
  return out;
}

/** The plan types the "use your own AI" reply may use, and the booking kind each becomes. */
export const AI_TYPES: Record<string, ItemKind> = {
  flight: 'flight',
  train: 'train',
  ferry: 'ferry',
  boat: 'ferry',
  bus: 'bus',
  transfer: 'activity',
  taxi: 'activity',
  car: 'car',
  hotel: 'hotel',
  stay: 'hotel',
  food: 'activity',
  restaurant: 'activity',
  tour: 'activity',
  activity: 'activity',
  free: 'note',
  note: 'note',
};

/** Why one item of an AI reply was left out (the screen words it). */
export type AiProblem = { item: number; reason: 'notObject' | 'date' | 'time' | 'title' | 'zone' | 'end' };
export type AiReply = { plans: ImportedPlan[]; problems: AiProblem[]; error: null | 'json' | 'notList' | 'empty' };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const pad5 = (t: string) => (/^\d:\d\d$/.test(t) ? `0${t}` : t);

/**
 * Reads the reply from the traveller's own AI chat: a JSON list of plans in the format `aiPrompt` asks for. Items
 * that don't fit are left out and listed (item number + reason); nothing is guessed except a missing zone (the
 * fallback zone, marked "check this"). Never throws.
 */
export function readAiReply(text: string, opts: ImportOptions): AiReply {
  try {
    const v = jsonIn(text);
    if (v === undefined) return { plans: [], problems: [], error: 'json' };
    const list = Array.isArray(v) ? v : isObj(v) && Array.isArray(v.items) ? v.items : isObj(v) && Array.isArray(v.plans) ? v.plans : null;
    if (!list) return { plans: [], problems: [], error: 'notList' };
    if (!list.length) return { plans: [], problems: [], error: 'empty' };
    const plans: ImportedPlan[] = [];
    const problems: AiProblem[] = [];
    list.slice(0, MAX_IMPORT_ITEMS).forEach((raw: unknown, i: number) => {
      const n = i + 1;
      if (!isObj(raw)) return void problems.push({ item: n, reason: 'notObject' });
      const date = str(raw.date);
      const start = pad5(str(raw.start ?? raw.time));
      const end = pad5(str(raw.end));
      const title = str(raw.title ?? raw.name);
      const tzRaw = str(raw.timezone ?? raw.tz);
      const type = str(raw.type).toLowerCase();
      const kind = AI_TYPES[type] ?? guessKind(title);
      const endDate = str(raw.endDate) || (end ? date : kind === 'hotel' && DATE_ONLY.test(date) ? addDays(date, 1) : '');
      if (!DATE_ONLY.test(date) || !isLocalDateTime(`${date}T00:00`)) return void problems.push({ item: n, reason: 'date' });
      if (start && !HHMM.test(start)) return void problems.push({ item: n, reason: 'time' });
      if (!title) return void problems.push({ item: n, reason: 'title' });
      if ((end && !HHMM.test(end)) || (endDate && !DATE_ONLY.test(endDate))) return void problems.push({ item: n, reason: 'end' });
      if (tzRaw && !isValidZone(tzRaw)) return void problems.push({ item: n, reason: 'zone' });
      const place = str(raw.place);
      const tz = tzRaw || zoneFor(`${place} ${str(raw.from)} ${str(raw.address)}`) || opts.fallbackTz;
      const endTz = zoneFor(str(raw.to)) ?? tz;
      const d = newItemDraft(kind, date, tz);
      const titled = (type === 'transfer' || type === 'taxi') && !/transfer|taxi/i.test(title) ? `Transfer: ${title}` : title;
      const hasEnd = !!end || kind === 'hotel';
      Object.assign(d, {
        title: titled,
        startDate: date,
        startTime: start || (kind === 'hotel' ? '15:00' : '09:00'),
        startTz: tz,
        endDate: hasEnd ? endDate : '',
        endTime: hasEnd ? end || '11:00' : '',
        endTz: isTransportKind(kind) ? endTz : tz,
        fromName: str(raw.from),
        toName: str(raw.to),
        placeName: place,
        address: str(raw.address),
        ref: str(raw.code ?? raw.confirmation ?? raw.ref),
        notes: str(raw.notes).slice(0, 2000),
      });
      const fno = kind === 'flight' ? FLIGHT_NO.exec(title) : null;
      if (fno) d.number = `${fno[1]}${fno[2]}`;
      plans.push({ key: `ai-${i}`, source: 'plan', draft: fitKind(d), check: !tzRaw || !start });
    });
    return { plans, problems, error: null };
  } catch {
    return { plans: [], problems: [], error: 'json' };
  }
}

/**
 * The prompt for "Use your own AI": the traveller copies it (with their itinerary text when they have pasted it)
 * into their own AI chat and pastes the reply back. Asks for a strict JSON list Satchel can check.
 */
export function aiPrompt(itinerary: string, trip?: { name: string; startDate: string; endDate: string }): string {
  const lines = [
    'Turn my travel itinerary below into a JSON list for my travel app.',
    'Reply with ONLY the JSON (no other words), in exactly this shape:',
    '[',
    '  {"date": "2027-03-03", "start": "09:30", "end": "11:00", "endDate": "", "type": "tour", "title": "Old town walking tour", "place": "Town Hall", "address": "", "from": "", "to": "", "code": "", "timezone": "Europe/Paris"}',
    ']',
    'Rules:',
    '- One object per booking or plan, in time order.',
    '- date and endDate are YYYY-MM-DD. start and end are 24-hour HH:MM, in local time where it happens. Use "" when unknown.',
    '- type is one of: flight, train, ferry, bus, transfer, car, hotel, food, tour, activity, free, note.',
    '- Flights, trains, ferries and buses: "from" and "to" are the places; end and endDate are the arrival.',
    '- Hotels: date and start are check-in; endDate and end are check-out.',
    '- code is the booking or confirmation code. timezone is the IANA time zone where it starts (like Asia/Tokyo).',
    '- Do not invent anything that is not in the itinerary.',
  ];
  if (trip) lines.push(`The trip is "${trip.name}", ${trip.startDate} to ${trip.endDate} (use these years for dates without one).`);
  lines.push('', 'My itinerary:', itinerary.trim() ? itinerary.trim().slice(0, 30_000) : '[paste your itinerary here]');
  return lines.join('\n');
}
