// T77 Paste a booking: turns a pasted confirmation (email, text message, booking web page) into draft bookings,
// offline, with no network and nothing sent anywhere. Pure: no React Native, Node runs it directly.
//
// How it reads text:
//  1. The text is cut into paragraphs (blank lines). Each paragraph is given a kind by its words (a flight needs a
//     flight number such as "QF 25", "JL5" or "NH 110" in flight context); paragraphs with no kind (a greeting, a
//     "Booking reference: ABC123" header) join the booking they sit in, or the shared header before the first one.
//  2. Neighbouring paragraphs of the same kind are one booking; a flight booking is then cut into legs at each
//     flight number, so a multi-leg itinerary gives one draft per leg.
//  3. Each line is cut at role words ("Depart", "Arrive", "Check-in", "Check-out", "Pick-up", "Drop-off"...), and the
//     dates and times in each part go to the start or end. Unlabelled ones fill start, then end, in order.
//
// Dates: 12 Mar 2027, 12 March 2027, Mar 12, 2027, 2027-03-12, 12/03/2027 (day first unless the US hint is set; a
// part over 12 settles it either way), 'Fri 12 Mar' (the year is the next one from `now`, checked against the
// weekday). Times: 14:35, 2:35 PM, 2.35pm, 3pm. Times stay the wall clock printed on the booking, in the place's
// own zone (ops/CONVENTIONS.md): airport codes give zones from the bundled table (src/core/airports.ts); an unknown
// code is kept as typed and its zone is left blank for the traveller. Other places take the zone of a city named in
// the text, else the fallback zone, marked low confidence.
//
// Every field carries a confidence: 'low' marks a guess (an inferred year without a matching weekday, an
// ambiguous day/month, a default check-in time, a fallback zone, an arrival day worked out from the clock) so the
// screen can say "check this". Nothing here saves: the traveller reviews every draft in the normal booking form.
import { airportByCode, zoneFromCity } from './airports.ts';
import { findWifi, type PastedWifi } from './pastewifi.ts';
import type { Item, ItemKind, LocalDate, Trip } from './model.ts';
import type { ItemDraft } from './trips.ts';
import { addDays, isValidZone, toUtc } from './tz.ts';

export type Confidence = 'high' | 'low';
export const PASTE_FIELDS = [
  'title',
  'from',
  'to',
  'start',
  'end',
  'zone',
  'place',
  'address',
  'phone',
  'carrier',
  'number',
  'seat',
  'terminal',
  'gate',
  'boarding',
  'dropOff',
  'ref',
] as const;
export type PasteField = (typeof PASTE_FIELDS)[number];

export type PasteAirport = { terminal?: string; gate?: string; boarding?: string };

export type PasteBooking = {
  kind: ItemKind;
  /** Ready for the booking form. Empty strings where nothing was found (a blank zone means "choose one"). */
  draft: ItemDraft;
  /** Flights only: departure terminal, gate and boarding time (departure airport's clock). */
  airport?: PasteAirport;
  confidence: Partial<Record<PasteField, Confidence>>;
  /** Airport codes not in the bundled table: kept as typed, zone left for the traveller. */
  unknownCodes: string[];
  /** Car hire returned somewhere other than the pick-up place (the screen puts it in the notes, in words). */
  dropOff?: string;
  /** T112 hotels only: Wi-Fi network / password lines, offered for the booking's Stay details (never put in the draft). */
  wifi?: PastedWifi;
};

export type PasteOptions = {
  /** Today ('YYYY-MM-DD'), for the year of dates printed without one. */
  now: LocalDate;
  /** Read 03/12/2027 as March 12 (US order). Default: day first. */
  us?: boolean;
  /** Zone for places the text gives no clue about (the trip's last zone or the phone's). Marked low confidence. */
  fallbackTz?: string;
};

// ---------------------------------------------------------------------------------------------------------------
// Dates

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WD = '(?:\\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?,?\\s+)?';
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const YEAR = '(?:,?\\s*(\\d{4})(?![\\d:.]))?';

const DATE_PATTERNS: { re: RegExp; read: (m: RegExpExecArray, us: boolean) => RawDate | null }[] = [
  {
    re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    read: (m) => ({ y: +m[1], mo: +m[2], d: +m[3], yearKnown: true, ambiguous: false }),
  },
  {
    re: new RegExp(`${WD}\\b(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4}|\\d{2})(?![\\d/.:])`, 'gi'),
    read: (m, us) => {
      const a = +m[2];
      const b = +m[3];
      const y = m[4].length === 2 ? 2000 + +m[4] : +m[4];
      // A part over 12 settles the order; otherwise the hint (day first by default) decides, as a guess.
      const usOrder = a > 12 ? false : b > 12 ? true : us;
      const ambiguous = a <= 12 && b <= 12 && a !== b;
      return { y, mo: usOrder ? a : b, d: usOrder ? b : a, yearKnown: true, ambiguous, wd: m[1] };
    },
  },
  {
    re: new RegExp(`${WD}\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s-]*${MON}(?![a-z])\\.?${YEAR}`, 'gi'),
    read: (m) => ({ y: m[4] ? +m[4] : 0, mo: MONTHS[m[3].slice(0, 3).toLowerCase()], d: +m[2], yearKnown: !!m[4], ambiguous: false, wd: m[1] }),
  },
  {
    re: new RegExp(`${WD}\\b${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?![:.]\\d)${YEAR}`, 'gi'),
    read: (m) => ({ y: m[4] ? +m[4] : 0, mo: MONTHS[m[2].slice(0, 3).toLowerCase()], d: +m[3], yearKnown: !!m[4], ambiguous: false, wd: m[1] }),
  },
];

type RawDate = { y: number; mo: number; d: number; yearKnown: boolean; ambiguous: boolean; wd?: string };
export type FoundDate = { date: LocalDate; at: number; end: number; confidence: Confidence };

const pad = (n: number) => String(n).padStart(2, '0');

function realDate(y: number, mo: number, d: number): LocalDate | null {
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2200)) return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

const weekdayOf = (date: LocalDate) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** A date printed without a year: the first one on or after `now` less 45 days, preferring a year whose weekday matches. */
function inferYear(r: RawDate, now: LocalDate): { date: LocalDate; confidence: Confidence } | null {
  const y0 = Number(now.slice(0, 4));
  const floor = addDays(now, -45);
  const options: LocalDate[] = [];
  for (const y of [y0, y0 + 1, y0 + 2]) {
    const date = realDate(y, r.mo, r.d);
    if (date && date >= floor) options.push(date);
  }
  if (!options.length) return null;
  if (r.wd) {
    const match = options.find((o) => weekdayOf(o) === r.wd!.slice(0, 3).toLowerCase());
    if (match) return { date: match, confidence: 'high' };
  }
  return { date: options[0], confidence: 'low' };
}

/** Every date in `s`, in order, as 'YYYY-MM-DD' with where it sits in the string. */
export function findDates(s: string, opts: Pick<PasteOptions, 'now' | 'us'>): FoundDate[] {
  const out: FoundDate[] = [];
  const taken: [number, number][] = [];
  const free = (a: number, b: number) => taken.every(([x, y]) => b <= x || a >= y);
  for (const p of DATE_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(s))) {
      const at = m.index;
      const end = at + m[0].length;
      if (!free(at, end)) continue;
      const r = p.read(m, !!opts.us);
      if (!r || !r.mo) continue;
      let found: { date: LocalDate; confidence: Confidence } | null;
      if (r.yearKnown) {
        const date = realDate(r.y, r.mo, r.d);
        found = date ? { date, confidence: r.ambiguous || (r.wd && weekdayOf(date) !== r.wd.slice(0, 3).toLowerCase()) ? 'low' : 'high' } : null;
      } else found = inferYear(r, opts.now);
      if (!found) continue;
      taken.push([at, end]);
      out.push({ ...found, at, end });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------------------------------------------------------
// Times

export type FoundTime = { time: string; at: number; end: number; nextDay: boolean };

const TIME_COLON = /(?<![\d.,$€£¥:])(\d{1,2})([:.])([0-5]\d)(?![\d:])(?:\s*([ap])\.?\s?m\b\.?)?(?:\s*(?:\(\s*)?\+\s?1\b)?/gi;
const TIME_AMPM = /(?<![\d:.])\b(\d{1,2})\s*([ap])\.?\s?m\b\.?/gi;
const TIME_WORDS = /\b(depart|arriv|check|pick|drop|time|start|end|from|until|board|open|leav|return|at)\w*/i;

function clock(h: number, min: number, ap?: string): string | null {
  if (ap) {
    if (h < 1 || h > 12) return null;
    const p = ap.toLowerCase();
    h = p === 'p' ? (h % 12) + 12 : h % 12;
  } else if (h > 23) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** Every time of day in `s` ('HH:mm', 24 h). A dot only counts with am/pm or near a time word (not a price). */
export function findTimes(s: string): FoundTime[] {
  const out: FoundTime[] = [];
  const timeish = TIME_WORDS.test(s);
  TIME_COLON.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TIME_COLON.exec(s))) {
    if (m[2] === '.' && !m[4] && !timeish) continue;
    const time = clock(+m[1], +m[3], m[4]);
    if (time) out.push({ time, at: m.index, end: m.index + m[0].length, nextDay: /\+\s?1\b/.test(m[0]) });
  }
  TIME_AMPM.lastIndex = 0;
  while ((m = TIME_AMPM.exec(s))) {
    const at = m.index;
    if (out.some((o) => at < o.end && at + m![0].length > o.at)) continue;
    const time = clock(+m[1], 0, m[2]);
    if (time) out.push({ time, at, end: at + m[0].length, nextDay: false });
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------------------------------------------------------
// Roles: which part of a line is about the start, the end, or something else (boarding, doors...)

type Role = 'start' | 'end' | 'other' | 'none';
type Part = { role: Role; word: string; text: string };

const ROLE_RE =
  /\b(?<other>boarding(?:\s+time)?|doors(?:\s+open)?|gate\s+closes|bag(?:gage)?\s+drop|check[\s-]?in\s+(?:opens|closes)|online\s+check[\s-]?in|last\s+entry)\b|\b(?<start>depart(?:s|ure|ing)?|dep\b\.?|leaves|leaving|check[\s-]?in|pick[\s-]?up|collection|starts?(?:\s+time)?|from\b|outbound|sails|sailing)|\b(?<end>arriv(?:e|es|al|ing)|arr\b\.?|check[\s-]?out|drop[\s-]?off|return(?:s|\s+date)?|ends?\b|until|to\b)/gi;

/** Cuts a line at role words. The part before the first one has role 'none'. */
export function lineParts(line: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  let role: Role = 'none';
  let word = '';
  ROLE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROLE_RE.exec(line))) {
    const g = m.groups ?? {};
    const r: Role = g.other ? 'other' : g.start ? 'start' : 'end';
    // "to" and "from" only lead a part at the start of a line or after a separator ("From: Sydney", "10:00 to 18:00").
    if (/^(to|from)$/i.test(m[0]) && !/(^|[\s:,|(]|\d)\s*$/.test(line.slice(0, m.index))) continue;
    if (/^to$/i.test(m[0]) && !/(^\s*|\d\s*|[:,|]\s*)$/.test(line.slice(0, m.index))) continue;
    parts.push({ role, word, text: line.slice(last, m.index) });
    role = r;
    word = m[0].toLowerCase();
    last = m.index + m[0].length;
  }
  parts.push({ role, word, text: line.slice(last) });
  return parts.filter((p) => p.text.trim() || p.role !== 'none');
}

type When = { role: Role; word: string; date?: FoundDate; time?: FoundTime; line: number; text: string };

function whens(lines: string[], opts: PasteOptions): When[] {
  const out: When[] = [];
  lines.forEach((line, i) => {
    for (const p of lineParts(line)) {
      const dates = findDates(p.text, opts);
      let rest = p.text;
      for (const d of dates) rest = rest.slice(0, d.at) + ' '.repeat(d.end - d.at) + rest.slice(d.end);
      const times = findTimes(rest);
      const n = Math.max(dates.length, times.length);
      for (let k = 0; k < n; k++) out.push({ role: p.role, word: p.word, date: dates[k], time: times[k], line: i, text: p.text });
    }
  });
  return out;
}

type Span = { date: string; time: string; dateC: Confidence; timeC: Confidence; nextDay: boolean };

/** Start and end date/time from labelled parts first, then unlabelled ones in order. */
function resolveWhen(ws: When[]): { start: Span; end: Span; boarding?: string } {
  // Each part can give its date to one side and its time to one side; labelled parts first, then unlabelled in order.
  const used = new Set<string>();
  const take = (role: Role, field: 'date' | 'time'): When | undefined => {
    const i = ws.findIndex((w, k) => w.role === role && w[field] && !used.has(`${field}:${k}`));
    const j = i >= 0 ? i : ws.findIndex((w, k) => w.role === 'none' && w[field] && !used.has(`${field}:${k}`));
    if (j < 0) return undefined;
    used.add(`${field}:${j}`);
    return ws[j];
  };
  const sd = take('start', 'date');
  const st = take('start', 'time');
  const ed = take('end', 'date');
  const et = take('end', 'time');
  const boarding = ws.find((w) => w.role === 'other' && /board/.test(w.word) && w.time)?.time?.time;
  return {
    start: { date: sd?.date?.date ?? '', time: st?.time?.time ?? '', dateC: sd?.date?.confidence ?? 'low', timeC: 'high', nextDay: false },
    end: { date: ed?.date?.date ?? '', time: et?.time?.time ?? '', dateC: ed?.date?.confidence ?? 'low', timeC: 'high', nextDay: !!et?.time?.nextDay },
    boarding,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Flights and airports

const NOT_DESIGNATORS = new Set(['AM', 'PM', 'NO', 'TO', 'ON', 'AT', 'IN', 'OF', 'ID', 'OK', 'ST', 'RD', 'NR', 'CH', 'UK', 'US', 'EU', 'TV', 'GB', 'KG', 'CM', 'MM', 'KM', 'MB']);
const FLIGHT_NO = /(?<![\w-])([A-Z][A-Z0-9]|[0-9][A-Z])\s?(\d{1,4})(?![\w:.])/g;
const FLIGHT_CONTEXT = /\b(flights?|airlines?|airways|boarding|depart(?:s|ure)?|arriv(?:e|es|al)|terminal|gate|baggage|e-?ticket|PNR|itinerary|aircraft|cabin|economy|business class)\b/i;
const NOT_BEFORE_FLIGHT_NO = /\b(seat|gate|terminal|car|coach|room|platform|bay|level|floor|row|deck|no|unit|suite|pier|berth|zone)\s*:?\s*$/i;

/** Flight numbers in a line ("QF 25", "JL5", "NH 110" -> "QF 25", "JL 5", "NH 110"). */
export function flightNumbers(line: string, context: boolean): string[] {
  const out: string[] = [];
  FLIGHT_NO.lastIndex = 0;
  let m: RegExpExecArray | null;
  const labelled = /\bflight\b/i.test(line);
  while ((m = FLIGHT_NO.exec(line))) {
    const des = m[1];
    if (!/[A-Z]/.test(des) || NOT_DESIGNATORS.has(des)) continue;
    if (NOT_BEFORE_FLIGHT_NO.test(line.slice(0, m.index))) continue;
    // A bare "AB 12" needs the line to say flight, or the paragraph to be about flying with a route on this line.
    const codes = codesIn(line).length;
    if (!labelled && codes < 2 && !(context && (codes > 0 || findTimes(line).length > 0))) continue;
    out.push(`${des} ${String(+m[2])}`);
  }
  return out;
}

const NOT_CODES = new Set(
  'THE AND FOR YOU ARE NOT ALL ANY BUT CAN HAS HER HIS ITS OUR OUT WAS WHO WHY HOW NEW NOW OLD ONE TWO SEE GET PNR REF TEL FAX VIA PER QTY USD AUD NZD EUR GBP JPY CAD CHF CNY HKD SGD KRW THB GMT UTC BST CET EST PST JST MON TUE WED THU FRI SAT SUN JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC ADT CHD INF YES VAT TAX FEE DEP ARR APT INT DOM'.split(' '),
);

type Code = { code: string; at: number; name?: string; known: boolean };

/** Airport codes in a line: known ones anywhere, unknown ones only as "Name (XYZ)" or in an "XYZ → ABC" route. */
export function codesIn(line: string): Code[] {
  const out: Code[] = [];
  const add = (c: Code) => {
    if (!out.some((o) => o.at === c.at)) out.push(c);
  };
  const paren = /([A-Za-zÀ-ɏ][\wÀ-ɏ.' -]{0,40}?)\s*\(([A-Z]{3})\)/g;
  let m: RegExpExecArray | null;
  while ((m = paren.exec(line))) {
    if (NOT_CODES.has(m[2])) continue;
    const name = cleanName(m[1]);
    add({ code: m[2], at: m.index + m[0].indexOf(`(${m[2]})`) + 1, name: name || undefined, known: !!airportByCode(m[2]) });
  }
  const route = /\b([A-Z]{3})\s*(?:→|->|⟶|➝|>|–|—|-|\bto\b)\s*([A-Z]{3})\b/g;
  while ((m = route.exec(line))) {
    if (NOT_CODES.has(m[1]) || NOT_CODES.has(m[2])) continue;
    add({ code: m[1], at: m.index, known: !!airportByCode(m[1]) });
    add({ code: m[2], at: m.index + m[0].lastIndexOf(m[2]), known: !!airportByCode(m[2]) });
  }
  const bare = /\b([A-Z]{3})\b/g;
  while ((m = bare.exec(line))) {
    if (!NOT_CODES.has(m[1]) && airportByCode(m[1])) add({ code: m[1], at: m.index, known: true });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** "Departs: Sydney Kingsford" -> "Sydney Kingsford": drops a leading label and separators. */
function cleanName(s: string): string {
  let n = s.replace(/.*[:→>|–—]\s*/, '');
  n = n.replace(/^\s*(?:depart(?:s|ure|ing)?|arriv(?:e|es|al|ing)|from|to|dep|arr|leaves?|flight)\b\.?\s*/i, '');
  // A flight number or a time before the name ("SF 802  Melbourne (MEL)", "21:00 Sydney (SYD)").
  n = n.replace(/^\s*(?:(?:[A-Z][A-Z0-9]|[0-9][A-Z])\s?\d{1,4}\b|\d{1,2}[:.]\d{2}\s*(?:[ap]\.?m\.?)?)\s*/i, '');
  return n.trim().replace(/[\s,-]+$/, '');
}

function airportPlace(c: Code): { name: string; city: string; tz: string } {
  const a = airportByCode(c.code);
  if (a) return { name: `${c.name && c.name.length > 2 && !/^\d/.test(c.name) ? c.name : a.city} (${c.code})`, city: a.city, tz: a.tz };
  return { name: c.name ? `${c.name} (${c.code})` : c.code, city: c.name ?? c.code, tz: '' };
}

// ---------------------------------------------------------------------------------------------------------------
// Shared field finders

/** A booking reference, confirmation number or PNR. Values must look like codes (capitals and digits). */
export function findRef(lines: string[]): string | undefined {
  const label = /\b(?:booking|confirmation|reservation|order|ticket)\s*(?:reference|ref\.?|number|no\.?|code|#|id)?\s*[:#]?\s*|\b(?:PNR|record locator|ref(?:erence)?\.?)\s*(?:no\.?|number)?\s*[:#]?\s*/gi;
  for (const line of lines) {
    label.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = label.exec(line))) {
      if (!m[0].trim()) {
        label.lastIndex++;
        continue;
      }
      const v = /^([A-Z0-9][A-Z0-9-]{3,19})\b/.exec(line.slice(m.index + m[0].length));
      if (v && (/\d/.test(v[1]) || /^[A-Z]{5,8}$/.test(v[1])) && !/^(19|20)\d\d-\d/.test(v[1])) return v[1];
    }
  }
  return undefined;
}

function labelled(lines: string[], re: RegExp): { value: string; line: number } | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (m && m[1]?.trim()) return { value: m[1].trim().replace(/[\s,;.]+$/, ''), line: i };
  }
  return undefined;
}

const findPhone = (lines: string[]) => labelled(lines, /\b(?:tel|phone|telephone|ph|call)\b\.?\s*:?\s*(\+?[\d][\d ()-]{6,}\d)/i)?.value;

/** "Address:" and the lines that carry on from it (up to two, until a blank or another label). */
function findAddress(lines: string[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(?:address|location address|hotel address|venue address)\s*:\s*(.*)$/i.exec(lines[i]);
    if (!m) continue;
    const parts = [m[1].trim()].filter(Boolean);
    for (let k = i + 1; k < lines.length && k <= i + 2; k++) {
      const l = lines[k].trim();
      if (!l || /:/.test(l) || findDates(l, { now: '2000-01-01' }).length) break;
      parts.push(l);
    }
    if (parts.length) return parts.join(', ');
  }
  return undefined;
}

const looksLikeAddress = (l: string) => /\d/.test(l) && /,|\b(st|street|rd|road|ave|avenue|lane|ln|dori|cho|machi|ku|ward|blvd|way|place|pl|square|sq)\b/i.test(l) && !/:/.test(l) && l.length < 120;

/** Value after "Label:" where the label is one of `names`. */
const labelRe = (names: string) => new RegExp(`^\\s*(?:${names})\\s*:\\s*(.+)$`, 'i');

// ---------------------------------------------------------------------------------------------------------------
// Kinds

const KIND_WORDS: { kind: ItemKind; re: RegExp; weight: number }[] = [
  { kind: 'hotel', re: /\b(hotel|inn|ryokan|hostel|resort|guest\s?house|motel|lodge|suites|apartments?|b&b|accommodation|property)\b/gi, weight: 3 },
  { kind: 'hotel', re: /\b(check[\s-]?in|check[\s-]?out|nights?|room|guests?)\b/gi, weight: 1 },
  { kind: 'train', re: /\b(train|rail(?:way)?|shinkansen|intercity|express train|sleeper)\b/gi, weight: 3 },
  { kind: 'train', re: /\b(platform|carriage|station|coach\s+\w{1,2}\b)/gi, weight: 1 },
  { kind: 'bus', re: /\b(bus|coach(?!\s+\w{1,2}\b)|shuttle)\b/gi, weight: 3 },
  { kind: 'ferry', re: /\b(ferry|sailing|vessel|catamaran|crossing)\b/gi, weight: 3 },
  { kind: 'ferry', re: /\b(pier|wharf|terminal|cabin|deck|port)\b/gi, weight: 1 },
  { kind: 'car', re: /\b(car\s+hire|car\s+rental|rental\s+car|hire\s+car|rental|vehicle|campervan)\b/gi, weight: 3 },
  { kind: 'car', re: /\b(pick[\s-]?up|drop[\s-]?off|driver|mileage|excess)\b/gi, weight: 1 },
  { kind: 'activity', re: /\b(tickets?|admission|event|concert|show|museum|gallery|tour|venue|performance|match|stadium|theatre|theater|festival|exhibition|experience|class|workshop)\b/gi, weight: 2 },
];

function kindOf(lines: string[]): ItemKind | null {
  const text = lines.join('\n');
  const flighty = FLIGHT_CONTEXT.test(text);
  if (lines.some((l) => flightNumbers(l, flighty).length)) return 'flight';
  const score = new Map<ItemKind, number>();
  for (const k of KIND_WORDS) {
    const n = (text.match(k.re) ?? []).length;
    if (n) score.set(k.kind, (score.get(k.kind) ?? 0) + n * k.weight);
  }
  let best: ItemKind | null = null;
  let top = 1;
  for (const [k, n] of score) if (n > top) [best, top] = [k, n];
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
// Building drafts

function emptyDraft(kind: ItemKind): ItemDraft {
  return {
    kind,
    title: '',
    startDate: '',
    startTime: '',
    startTz: '',
    endDate: '',
    endTime: '',
    endTz: '',
    fromName: '',
    toName: '',
    fromPos: '',
    toPos: '',
    placePos: '',
    placeName: '',
    address: '',
    localAddress: '',
    placePhone: '',
    ref: '',
    seat: '',
    carrier: '',
    number: '',
    notes: '',
  };
}

/** Puts start/end on the draft. Missing end date: same day as the start, or the next when the clock says so. */
function applyWhen(b: PasteBooking, w: ReturnType<typeof resolveWhen>, endFallbackDays = 0) {
  const d = b.draft;
  d.startDate = w.start.date;
  d.startTime = w.start.time;
  d.endDate = w.end.date;
  d.endTime = w.end.time;
  let endC: Confidence = w.end.date ? w.end.dateC : 'low';
  if (!d.endDate && d.endTime && d.startDate) {
    d.endDate = addDays(d.startDate, w.end.nextDay ? 1 : endFallbackDays);
    // Same day (or the printed "+1") is right when the clock agrees; an arrival before the departure means the next
    // day (an overnight flight or train), which is a guess. Without both zones the day can't be checked.
    const zones = isValidZone(d.startTz) && isValidZone(d.endTz);
    endC = w.end.nextDay || (zones && endFallbackDays === 0) ? 'high' : 'low';
    if (!w.end.nextDay && d.startTime && zones && toUtc({ local: `${d.endDate}T${d.endTime}`, tz: d.endTz }) < toUtc({ local: `${d.startDate}T${d.startTime}`, tz: d.startTz })) {
      d.endDate = addDays(d.endDate, 1);
      endC = 'low';
    }
  }
  if (d.startDate || d.startTime) b.confidence.start = d.startDate && d.startTime ? w.start.dateC : 'low';
  if (d.endDate || d.endTime) b.confidence.end = d.endDate && d.endTime ? endC : 'low';
}

function setZone(b: PasteBooking, startTz: string, endTz: string, c: Confidence) {
  b.draft.startTz = startTz;
  b.draft.endTz = endTz;
  b.confidence.zone = startTz && endTz ? c : 'low';
}

function placeZone(text: string, opts: PasteOptions): { tz: string; c: Confidence } {
  const z = zoneFromCity(text);
  if (z) return { tz: z.tz, c: 'high' };
  return { tz: opts.fallbackTz && isValidZone(opts.fallbackTz) ? opts.fallbackTz : '', c: 'low' };
}

function set(b: PasteBooking, field: PasteField, key: keyof ItemDraft, value: string | undefined, c: Confidence = 'high') {
  if (!value) return;
  (b.draft[key] as string) = value;
  b.confidence[field] = c;
}

function flightLeg(lines: string[], shared: Shared, opts: PasteOptions): PasteBooking {
  const b: PasteBooking = { kind: 'flight', draft: emptyDraft('flight'), confidence: {}, unknownCodes: [] };
  const flighty = true;
  const number = lines.map((l) => flightNumbers(l, flighty)[0]).find(Boolean);
  set(b, 'number', 'number', number);
  const codes: Code[] = [];
  for (const l of lines) for (const c of codesIn(l)) if (!codes.some((x) => x.code === c.code)) codes.push(c);
  const from = codes[0] ? airportPlace(codes[0]) : undefined;
  const to = codes[1] ? airportPlace(codes[1]) : undefined;
  b.unknownCodes = codes.slice(0, 2).filter((c) => !c.known).map((c) => c.code);
  if (from) set(b, 'from', 'fromName', from.name, codes[0].known || codes[0].name ? 'high' : 'low');
  if (to) set(b, 'to', 'toName', to.name, codes[1].known || codes[1].name ? 'high' : 'low');
  if (from || to) setZone(b, from?.tz ?? '', to?.tz ?? from?.tz ?? '', from?.tz && to?.tz ? 'high' : 'low');
  if (from && to) set(b, 'title', 'title', `${from.city} → ${to.city}`);
  else if (number) set(b, 'title', 'title', number, 'low');
  const w = resolveWhen(whens(lines, opts));
  applyWhen(b, w, 0);
  const carrier = labelled(lines, labelRe('airline|carrier|operated by|operator')) ?? labelled(lines, /\b(?:operated by|with)\s+([A-Z][\w&' -]*\b(?:Air|Airways|Airlines|Aviation|Wings?|Jet))\b/);
  set(b, 'carrier', 'carrier', carrier?.value ?? shared.carrier);
  const seat = labelled(lines, /\bseats?\s*(?:no\.?|number)?\s*:?\s*(\d{1,2}[A-K])\b/i)?.value;
  set(b, 'seat', 'seat', seat);
  const terminal = labelled(lines, /\bterminal\s*:?\s*((?:T\s?)?(?:\d{1,2}[A-Z]?|[A-Z]\b|international|domestic|north|south|east|west))/i)?.value ?? labelled(lines, /(?:^|\s|,)(T\d)\b/)?.value;
  const gate = labelled(lines, /\bgate\s*:?\s*([A-Z]?\d{1,3}[A-Z]?)\b/i)?.value;
  const airport: PasteAirport = {};
  if (terminal) {
    airport.terminal = terminal.replace(/^T\s/, 'T');
    b.confidence.terminal = 'high';
  }
  if (gate) {
    airport.gate = gate;
    b.confidence.gate = 'high';
  }
  if (w.boarding) {
    airport.boarding = w.boarding;
    b.confidence.boarding = 'high';
  }
  if (Object.keys(airport).length) b.airport = airport;
  set(b, 'ref', 'ref', findRef(lines) ?? shared.ref);
  return b;
}

/** "Tokyo → Kyoto", "From: Tokyo Station  To: Kyoto Station": a journey's two ends, without dates or times. */
function journeyEnds(lines: string[]): { from?: string; to?: string } {
  const strip = (s: string) =>
    s
      .replace(/\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b\.?,?/gi, ' ')
      .replace(/\d{1,2}[:.]\d{2}\s*(?:[ap]\.?m\.?)?/gi, ' ')
      .replace(/\b\d{1,2}\s*[ap]\.?m\b\.?/gi, ' ')
      .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s*${MON}\\b\\.?(?:,?\\s*\\d{4})?`, 'gi'), ' ')
      .replace(new RegExp(`\\b${MON}\\.?\\s+\\d{1,2}(?:,?\\s*\\d{4})?`, 'gi'), ' ')
      .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g, ' ')
      .replace(/\b(?:platform|plat\.?|bay|pier|gate)\s*:?\s*\w+/gi, ' ')
      .replace(/^[\s:,|-]+|[\s:,|(-]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  const from = labelled(lines, /\b(?:from|departs?|departing|depart from|leaves)\s*:?\s*(.+?)(?=\s+(?:to|arrives?)\b\s*:?|$)/i);
  const to = labelled(lines, /(?:^|\s|\|)(?:to|arrives?|arriving|arrive at)\b\s*:?\s*(.+)$/i);
  let f = from ? strip(from.value) : '';
  let t = to ? strip(to.value) : '';
  if (!f || !t) {
    const r = labelled(lines, /^(.+?)\s*(?:→|->|⟶|➝|⇒|>|–|—|\bto\b)\s*(.+)$/);
    if (r) {
      const m = /^(.+?)\s*(?:→|->|⟶|➝|⇒|>|–|—|\bto\b)\s*(.+)$/.exec(lines[r.line])!;
      f = f || strip(cleanName(m[1]));
      t = t || strip(m[2]);
    }
  }
  const ok = (s: string) => s && s.length <= 60 && /\p{L}/u.test(s) ? s : undefined;
  return { from: ok(f), to: ok(t) };
}

function journey(kind: ItemKind, lines: string[], shared: Shared, opts: PasteOptions): PasteBooking {
  const b: PasteBooking = { kind, draft: emptyDraft(kind), confidence: {}, unknownCodes: [] };
  const ends = journeyEnds(lines);
  set(b, 'from', 'fromName', ends.from);
  set(b, 'to', 'toName', ends.to);
  const zs = placeZone(`${ends.from ?? ''} ${lines.join(' ')}`, opts);
  const ze = ends.to ? zoneFromCity(ends.to) : undefined;
  setZone(b, zs.tz, ze?.tz ?? zs.tz, zs.c);
  if (ends.from && ends.to) set(b, 'title', 'title', `${ends.from} → ${ends.to}`);
  applyWhen(b, resolveWhen(whens(lines, opts)), 0);
  const word = kind === 'train' ? 'train|service' : kind === 'bus' ? 'bus|service|route' : 'ferry|sailing|vessel|service';
  const num = labelled(lines, new RegExp(`\\b(?:${word})\\s*(?:no\\.?|number|#)?\\s*:?\\s*((?:[A-Z][a-z]+\\s)?[A-Z]{0,4}\\s?\\d{1,5}[A-Z]?)\\b`, 'i'));
  set(b, 'number', 'number', num?.value);
  const carrier = labelled(lines, labelRe('operator|operated by|company|carrier|line'));
  set(b, 'carrier', 'carrier', carrier?.value ?? shared.carrier);
  const carSeat = /\b(?:car|coach|carriage)\s*:?\s*(\w{1,3})\s*[,/]?\s*seats?\s*:?\s*(\d{1,3}[A-F]?)\b/i;
  const s1 = lines.map((l) => carSeat.exec(l)).find(Boolean);
  const seat = s1 ? `Car ${s1[1]}, ${s1[2]}` : labelled(lines, /\b(?:seat|berth|cabin)\s*(?:no\.?|number)?\s*:?\s*(\w{1,5})\b/i)?.value;
  set(b, 'seat', 'seat', seat);
  set(b, 'ref', 'ref', findRef(lines) ?? shared.ref);
  return b;
}

const HOTEL_WORD = /\b(hotel|inn|ryokan|hostel|resort|guest\s?house|motel|lodge|suites|apartments|b&b)\b/i;
const NOT_A_NAME = /\b(confirm|confirmation|booking|reservation|receipt|details|your|dear|thank|check|cancel|policy|invoice|summary)\w*/i;

function hotel(lines: string[], shared: Shared, opts: PasteOptions): PasteBooking {
  const b: PasteBooking = { kind: 'hotel', draft: emptyDraft('hotel'), confidence: {}, unknownCodes: [] };
  let nameLine = -1;
  let name = labelled(lines, labelRe('hotel|hotel name|property|accommodation|where you(?:\'|’)re staying|stay'))?.value;
  if (name) nameLine = lines.findIndex((l) => l.includes(name!));
  if (!name) {
    const at = labelled(lines, /\b(?:at|stay at|staying at)\s+((?:the\s+)?[A-Z][\w'&-]*(?:\s+(?:[A-Z][\w'&-]*|&|de|del|la|le|of|the)){0,6})/);
    if (at && HOTEL_WORD.test(at.value)) [name, nameLine] = [at.value, at.line];
  }
  if (!name) {
    nameLine = lines.findIndex((l) => HOTEL_WORD.test(l) && !NOT_A_NAME.test(l) && !/:/.test(l) && l.trim().length <= 60 && !/[.!?]$/.test(l.trim()));
    if (nameLine >= 0) name = lines[nameLine].trim();
  }
  set(b, 'place', 'placeName', name);
  set(b, 'title', 'title', name);
  let address = findAddress(lines);
  if (!address && nameLine >= 0) {
    const next = lines.slice(nameLine + 1, nameLine + 3).filter((l) => looksLikeAddress(l.trim()));
    if (next.length) address = next.map((l) => l.trim()).join(', ');
  }
  if (!address) address = lines.find((l) => looksLikeAddress(l.trim()) && !findDates(l, opts).length)?.trim();
  set(b, 'address', 'address', address);
  set(b, 'phone', 'placePhone', findPhone(lines));
  const z = placeZone(`${address ?? ''} ${name ?? ''} ${lines.join(' ')}`, opts);
  setZone(b, z.tz, z.tz, z.c);
  // At a hotel, "arrival" is check-in and "departure" is check-out.
  const w = resolveWhen(whens(lines, opts).map((x) => (/^arr/.test(x.word) ? { ...x, role: 'start' } : /^(dep|leav)/.test(x.word) ? { ...x, role: 'end' } : x)));
  // "3 nights" gives the check-out day when it isn't printed.
  const nights = /\b(\d{1,2})\s*nights?\b/i.exec(lines.join(' '));
  if (!w.end.date && w.start.date && nights) [w.end.date, w.end.dateC] = [addDays(w.start.date, +nights[1]), 'high'];
  const defaultIn = !w.start.time && !!w.start.date;
  const defaultOut = !w.end.time && !!w.end.date;
  if (defaultIn) w.start.time = '15:00';
  if (defaultOut) w.end.time = '11:00';
  applyWhen(b, w, 1);
  if (defaultIn) b.confidence.start = 'low';
  if (defaultOut) b.confidence.end = 'low';
  set(b, 'ref', 'ref', findRef(lines) ?? shared.ref);
  const wifi = findWifi(lines) ?? shared.wifi;
  if (wifi) b.wifi = wifi;
  return b;
}

function car(lines: string[], shared: Shared, opts: PasteOptions): PasteBooking {
  const b: PasteBooking = { kind: 'car', draft: emptyDraft('car'), confidence: {}, unknownCodes: [] };
  const company = labelled(lines, labelRe('supplier|rental company|car hire company|company|provided by|operator|agency'))?.value ?? shared.carrier;
  set(b, 'carrier', 'carrier', company);
  // Pick-up / drop-off places: the labelled part with dates and times taken out.
  const where = (re: RegExp) => {
    const hit = labelled(lines, re);
    if (!hit) return undefined;
    const v = journeyEnds([`From: ${hit.value}`]).from;
    return v && !/^(date|time|location)$/i.test(v) ? v : undefined;
  };
  const pick = labelled(lines, labelRe('pick[\\s-]?up location|pick[\\s-]?up branch|pick[\\s-]?up desk'))?.value ?? where(/\bpick[\s-]?up\b\s*(?:location)?\s*:?\s*(.+)$/i);
  const drop = labelled(lines, labelRe('drop[\\s-]?off location|return location|drop[\\s-]?off branch'))?.value ?? where(/\b(?:drop[\s-]?off|return)\b\s*(?:location)?\s*:?\s*(.+)$/i);
  set(b, 'place', 'placeName', pick);
  set(b, 'title', 'title', company && pick ? `${company} · ${pick}` : (company ?? pick), 'high');
  if (drop && drop !== pick) b.dropOff = drop;
  set(b, 'address', 'address', findAddress(lines));
  set(b, 'phone', 'placePhone', findPhone(lines));
  const z = placeZone(`${pick ?? ''} ${lines.join(' ')}`, opts);
  setZone(b, z.tz, z.tz, z.c);
  applyWhen(b, resolveWhen(whens(lines, opts)), 0);
  set(b, 'ref', 'ref', findRef(lines) ?? shared.ref);
  return b;
}

function activity(lines: string[], shared: Shared, opts: PasteOptions): PasteBooking {
  const b: PasteBooking = { kind: 'activity', draft: emptyDraft('activity'), confidence: {}, unknownCodes: [] };
  let name = labelled(lines, labelRe('event|show|tour|activity|experience|performance|exhibition|attraction|title'))?.value;
  if (!name) name = labelled(lines, /\b(?:tickets?\s+for|admission\s+to|booked\s+for|your\s+tickets?\s+to)\s*:?\s*(.+?)(?:\s+(?:on|at)\s+\w+.*)?[.!]?$/i)?.value;
  let c: Confidence = 'high';
  if (!name) {
    const first = lines.find((l) => l.trim() && !/:/.test(l) && !NOT_A_NAME.test(l) && !findDates(l, opts).length && !findTimes(l).length && l.trim().length <= 60);
    if (first) [name, c] = [first.trim(), 'low'];
  }
  set(b, 'title', 'title', name, c);
  const venue = labelled(lines, labelRe('venue|location|where|meeting point|meet at|place'))?.value;
  set(b, 'place', 'placeName', venue);
  set(b, 'address', 'address', findAddress(lines));
  set(b, 'phone', 'placePhone', findPhone(lines));
  const z = placeZone(`${venue ?? ''} ${lines.join(' ')}`, opts);
  setZone(b, z.tz, z.tz, z.c);
  const ws = whens(lines, opts);
  const w = resolveWhen(ws);
  // Doors only: use them as the start, marked as a guess.
  const doors = ws.find((x) => x.role === 'other' && /doors/.test(x.word) && x.time)?.time?.time;
  if (!w.start.time && doors) w.start.time = doors;
  applyWhen(b, w, 0);
  if (!w.end.time) {
    b.draft.endDate = '';
    delete b.confidence.end;
  }
  const seat = labelled(lines, /\b(?:seats?|seating|row)\s*:?\s*((?:(?:row|section|block)\s+)?\w{1,4}(?:[, ]+(?:row|seat)\s*\w{1,4})*)/i)?.value;
  set(b, 'seat', 'seat', seat);
  set(b, 'ref', 'ref', findRef(lines) ?? shared.ref);
  return b;
}

/** wifi (T112): Wi-Fi lines before the bookings, used only when the paste has exactly one hotel. */
type Shared = { ref?: string; carrier?: string; wifi?: PastedWifi };

/** "Sunfield Air", "Coral Wing Airways": an airline-looking name anywhere in the lines. */
const airlineIn = (lines: string[]) => /\b([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,3}\s+(?:Airways|Airlines|Air))\b/.exec(lines.join('\n'))?.[1] || undefined;

/** The company named in a shared header: a labelled one, else an airline-looking name. */
const carrierIn = (lines: string[]) => labelled(lines, labelRe('airline|carrier|operator|supplier|company'))?.value ?? airlineIn(lines);

// ---------------------------------------------------------------------------------------------------------------
// Entry point

/** Splits flight lines into legs at each new flight number; a route or date line just above a number joins its leg. */
function flightLegs(lines: string[]): string[][] {
  const at: number[] = [];
  let lastNo = '';
  lines.forEach((l, i) => {
    const n = flightNumbers(l, true)[0];
    if (n && n !== lastNo) {
      at.push(i);
      lastNo = n;
    }
  });
  if (at.length <= 1) return [lines];
  const starts = at.map((i, k) => {
    let s = i;
    const floor = k ? at[k - 1] + 1 : 0;
    for (let j = i - 1; j >= floor && j >= i - 2; j--) {
      const l = lines[j];
      if (codesIn(l).length >= 2 || /^\s*(flight|leg|segment)\s*\d+\b/i.test(l) || (findDates(l, { now: '2000-01-01' }).length && !findTimes(l).length && !codesIn(l).length)) s = j;
      else break;
    }
    return k === 0 ? 0 : s;
  });
  return starts.map((s, k) => lines.slice(s, k + 1 < starts.length ? starts[k + 1] : lines.length));
}

/** True when the draft has enough to be worth showing: a day, or a name plus a reference or route. */
function worthShowing(b: PasteBooking): boolean {
  const d = b.draft;
  if (d.startDate) return true;
  if (b.kind === 'flight') return !!d.number && !!(d.fromName || d.toName);
  return !!(d.title || d.placeName) && !!(d.ref || d.fromName);
}

/** Candidate bookings found in pasted text, in the order they appear. Never throws; garbage gives []. */
export function parseBookings(text: string, opts: PasteOptions): PasteBooking[] {
  try {
    return parse(text, opts);
  } catch {
    return [];
  }
}

function parse(text: string, opts: PasteOptions): PasteBooking[] {
  if (typeof text !== 'string' || !text.trim()) return [];
  const clean = text
    .slice(0, 50_000)
    .replace(/\r\n?/g, '\n')
    .replace(/[   \t]/g, ' ')
    .replace(/[​-‍﻿]/g, '');
  const paras = clean
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').filter((l) => l.trim()))
    .filter((p) => p.length);
  type Group = { kind: ItemKind | null; lines: string[] };
  const groups: Group[] = [];
  const head: string[] = [];
  for (const p of paras) {
    const k = kindOf(p);
    const cur = groups[groups.length - 1];
    if (!k) {
      if (cur) cur.lines.push(...p);
      else head.push(...p);
    } else if (cur && cur.kind === k) cur.lines.push(...p);
    else groups.push({ kind: k, lines: [...p] });
  }
  // One paragraph with no kind of its own but flight numbers spread over lines is still read as a whole.
  if (!groups.length && head.length) {
    const k = kindOf(head);
    if (k) groups.push({ kind: k, lines: head.splice(0) });
  }
  const shared: Shared = {
    ref: findRef(head),
    carrier: carrierIn(head),
    wifi: groups.filter((g) => g.kind === 'hotel').length === 1 ? findWifi(head) ?? undefined : undefined,
  };
  const out: PasteBooking[] = [];
  for (const g of groups) {
    switch (g.kind) {
      case 'flight': {
        const legs = flightLegs(g.lines);
        const legShared = { ref: shared.ref ?? findRef(g.lines), carrier: shared.carrier ?? airlineIn(g.lines) };
        let prevEnd = '';
        for (const leg of legs) {
          const b = flightLeg(leg, legShared, opts);
          // A later leg with no date of its own: the day the previous leg landed, as a guess.
          if (!b.draft.startDate && prevEnd && b.draft.startTime) {
            b.draft.startDate = prevEnd;
            b.confidence.start = 'low';
          }
          prevEnd = b.draft.endDate || b.draft.startDate || prevEnd;
          out.push(b);
        }
        break;
      }
      case 'hotel':
        out.push(hotel(g.lines, shared, opts));
        break;
      case 'car':
        out.push(car(g.lines, shared, opts));
        break;
      case 'activity':
        out.push(activity(g.lines, shared, opts));
        break;
      case 'train':
      case 'bus':
      case 'ferry':
        out.push(journey(g.kind, g.lines, shared, opts));
        break;
      default:
        break;
    }
  }
  return out.filter(worthShowing);
}

// ---------------------------------------------------------------------------------------------------------------
// For the screen

export type FoundField = { field: PasteField; value: string; confidence: Confidence };

/** What was found, in a fixed reading order, for the result cards. Times are shown as printed (with the date). */
export function foundFields(b: PasteBooking): FoundField[] {
  const d = b.draft;
  const v: Partial<Record<PasteField, string>> = {
    title: d.title,
    from: d.fromName,
    to: d.toName,
    start: [d.startDate, d.startTime].filter(Boolean).join(' '),
    end: [d.endDate, d.endTime].filter(Boolean).join(' '),
    zone: d.startTz && d.endTz && d.startTz !== d.endTz ? `${d.startTz} → ${d.endTz}` : d.startTz,
    place: d.kind === 'hotel' && d.placeName === d.title ? '' : d.placeName,
    address: d.address,
    phone: d.placePhone,
    carrier: d.carrier,
    number: d.number,
    seat: d.seat,
    terminal: b.airport?.terminal,
    gate: b.airport?.gate,
    boarding: b.airport?.boarding,
    dropOff: b.dropOff,
    ref: d.ref,
  };
  const out: FoundField[] = [];
  for (const f of PASTE_FIELDS) {
    const value = v[f];
    if (value) out.push({ field: f, value, confidence: b.confidence[f] ?? 'high' });
  }
  return out;
}

/** Fields the traveller should look at: low confidence, plus a missing zone, day or time. */
export function needsCheck(b: PasteBooking): PasteField[] {
  const out = new Set<PasteField>(PASTE_FIELDS.filter((f) => b.confidence[f] === 'low'));
  if (!b.draft.startTz || !b.draft.endTz) out.add('zone');
  if (!b.draft.startDate || !b.draft.startTime) out.add('start');
  return PASTE_FIELDS.filter((f) => out.has(f));
}

/** The draft for the booking form, with a title (the screen's fallback when none was found) and blank zones as given. */
export function draftForForm(b: PasteBooking, fallbackTitle: string, dropOffNote?: (place: string) => string): ItemDraft {
  const notes = b.dropOff && dropOffNote ? [b.draft.notes, dropOffNote(b.dropOff)].filter(Boolean).join('\n') : b.draft.notes;
  return { ...b.draft, title: b.draft.title.trim() || fallbackTitle, notes };
}

/** True when the trip already has this booking (same kind and start, and the same number, reference or title). */
export function alreadyInTrip(b: PasteBooking, trip: Pick<Trip, 'items'> | undefined): boolean {
  if (!trip || !b.draft.startDate || !b.draft.startTime) return false;
  const start = `${b.draft.startDate}T${b.draft.startTime}`;
  const same = (x: string | undefined, y: string) => !!y && (x ?? '').trim().toLowerCase() === y.trim().toLowerCase();
  return trip.items.some(
    (it: Item) => it.kind === b.kind && it.start.local === start && (same(it.number, b.draft.number) || same(it.ref, b.draft.ref) || same(it.title, b.draft.title)),
  );
}

/** The trip whose dates contain the booking's first day, else undefined (the screen then asks). */
export function suggestTrip<T extends Pick<Trip, 'id' | 'startDate' | 'endDate'>>(found: readonly PasteBooking[], trips: readonly T[]): T | undefined {
  const day = found.map((b) => b.draft.startDate).filter(Boolean).sort()[0];
  if (!day) return undefined;
  return trips.find((t) => t.startDate <= day && day <= t.endDate) ?? trips.find((t) => addDays(t.startDate, -3) <= day && day <= addDays(t.endDate, 3));
}
