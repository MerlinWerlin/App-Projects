// Emergency card logic: the bundled numbers table (lookup, search, display model with "verify locally" and
// "source pending"), a "which country am I in" guess from the trip's time zones, card completeness and tel: URIs.
// Pure TypeScript. The table JSON is passed in by the caller (the UI imports it; tests read it from disk).
import type { EmergencyCard, EmergencyContact, Item, LocalDate, Trip } from './model.ts';
import { nextUp, tripPhase } from './timeline.ts';
import { LEGACY_ZONES } from './tzzones.ts';

// ------------------------------------------------------------------ table

export const SERVICES = ['general', 'police', 'ambulance', 'fire', 'tourist_police'] as const;
export type Service = (typeof SERVICES)[number];

export type EmergencyRow = {
  iso2: string;
  country: string;
  general: string | null;
  police: string | null;
  ambulance: string | null;
  fire: string | null;
  tourist_police: string | null;
  notes?: string | null;
  source_url: string | null;
  source_checked: string | null;
  confidence: 'high' | 'medium' | 'low' | string;
  /** Second-model (GUARD) review: fields it doubted. Numbers are never changed because of a flag. */
  guard_flags?: GuardFlag[] | null;
};

/** One doubt from the GUARD review. `field` is a service name, "notes", "country", or several joined by "/". */
export type GuardFlag = { field: string; given?: string | null; second_opinion?: string | null; why?: string | null };

export type EmergencyTable = { version: number; imported?: string; origin?: string; rule: string; countries: EmergencyRow[] };

export function findCountry(table: EmergencyTable, iso2: string | null | undefined): EmergencyRow | null {
  if (!iso2) return null;
  const code = iso2.trim().toUpperCase();
  return table.countries.find((r) => r.iso2 === code) ?? null;
}

/** Lowercase, accents removed, so "cote" finds "Côte d'Ivoire". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Countries matching a search, best first: exact ISO code, then name starts with the query, then a word in the
 * name starts with it, then the name contains it. An empty query lists every country A–Z.
 */
export function searchCountries(table: EmergencyTable, query: string): EmergencyRow[] {
  const q = fold(query);
  const byName = [...table.countries].sort((a, b) => (a.country < b.country ? -1 : a.country > b.country ? 1 : 0));
  if (!q) return byName;
  const rank = (r: EmergencyRow): number => {
    const name = fold(r.country);
    if (q.length === 2 && r.iso2.toLowerCase() === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.split(/[\s\-'(),.]+/).some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    return -1;
  };
  return byName
    .map((r) => ({ r, k: rank(r) }))
    .filter((x) => x.k >= 0)
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
}

// ------------------------------------------------------------------ display model

/** One number to call, with every service it serves (Japan's 119 is ambulance and fire). */
export type NumberLine = {
  number: string;
  services: Service[];
  tel: string;
  /** True when the GUARD review doubted any service this number is listed for: show "Number doubted — check locally". */
  doubted: boolean;
};

/** A field the GUARD review can doubt: a service, the table note, or the whole entry. */
export type DoubtField = Service | 'notes' | 'entry';

export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

export type SourceInfo = { kind: 'pending' } | { kind: 'checked'; host: string; date: string };

export type RowDisplay = {
  iso2: string;
  country: string;
  /** Distinct numbers in service order (general first). Empty when the table has no confirmed number. */
  lines: NumberLine[];
  noNumber: boolean;
  /** Always true: the bundled table is never presented as guaranteed current. */
  verifyLocally: true;
  source: SourceInfo;
  notes: string | null;
  /** The import's own rating (never a verification). Anything unrecognised is 'unknown'. */
  confidence: Confidence;
  /** Every field the GUARD review doubted, in a fixed order. */
  doubted: DoubtField[];
  /** Doubted fields with no number line of their own (a blank service, the whole entry). The note is `notesDoubted`. */
  doubtedElsewhere: DoubtField[];
  notesDoubted: boolean;
};

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Host of an https URL without "www." (regex, because URL.hostname is not reliable on Hermes). */
export function urlHost(url: string | null | undefined): string | null {
  const m = /^https:\/\/([^/?#:@\s]+)(?::\d+)?(?:[/?#]|$)/i.exec((url ?? '').trim());
  if (!m) return null;
  return m[1].toLowerCase().replace(/^www\./, '');
}

/**
 * A row counts as sourced only with BOTH an https source URL and a real checked date. Anything else is
 * "source pending", and the URL is not shown as if it were proof.
 */
export function sourceOf(row: Pick<EmergencyRow, 'source_url' | 'source_checked'>): SourceInfo {
  const host = urlHost(row.source_url);
  const d = DATE.exec((row.source_checked ?? '').trim());
  if (!host || !d) return { kind: 'pending' };
  const [, y, mo, da] = d;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(da)));
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== Number(mo) - 1 || dt.getUTCDate() !== Number(da)) return { kind: 'pending' };
  return { kind: 'checked', host, date: `${y}-${mo}-${da}` };
}

/**
 * Why a row that claims a source (has a URL or a date) still counts as "source pending". Empty means either fully
 * sourced or not claiming a source at all. A row is sourced only with an https URL AND an ISO YYYY-MM-DD date that
 * exists on the calendar.
 */
export type SourceProblem = 'url-without-date' | 'date-without-url' | 'url-not-https' | 'date-not-iso';

const filled = (s: string | null | undefined) => typeof s === 'string' && s.trim().length > 0;

export function sourceProblems(row: Pick<EmergencyRow, 'source_url' | 'source_checked'>): SourceProblem[] {
  const hasUrl = filled(row.source_url);
  const hasDate = filled(row.source_checked);
  if (!hasUrl && !hasDate) return [];
  const out: SourceProblem[] = [];
  if (hasUrl && !hasDate) out.push('url-without-date');
  if (hasDate && !hasUrl) out.push('date-without-url');
  if (hasUrl && !urlHost(row.source_url)) out.push('url-not-https');
  if (hasDate && sourceOf({ source_url: 'https://x.invalid', source_checked: row.source_checked }).kind !== 'checked') out.push('date-not-iso');
  return out;
}

export type SourceAudit = {
  /** Rows with an https URL and a valid checked date. */
  sourced: string[];
  /** Everything else (no claim, or a claim with a problem). */
  pending: string[];
  /** Rows that claim a source but are missing or malformed in part: shown as pending. */
  problems: { iso2: string; problems: SourceProblem[] }[];
};

/** Whole-table check run by the tests and by any future import: which rows may show a source line. */
export function auditSources(table: EmergencyTable): SourceAudit {
  const audit: SourceAudit = { sourced: [], pending: [], problems: [] };
  for (const r of table.countries) {
    if (sourceOf(r).kind === 'checked') audit.sourced.push(r.iso2);
    else audit.pending.push(r.iso2);
    const p = sourceProblems(r);
    if (p.length) audit.problems.push({ iso2: r.iso2, problems: p });
  }
  return audit;
}

const DOUBT_ORDER: DoubtField[] = [...SERVICES, 'notes', 'entry'];

/** Fields named by one GUARD flag ("police / ambulance / fire" names three). Unknown names doubt the whole entry. */
export function flagFields(flag: GuardFlag): DoubtField[] {
  const parts = String(flag?.field ?? '')
    .toLowerCase()
    .split(/\s*(?:\/|,|&|\band\b)\s*/)
    .map((x) => x.trim().replace(/\s+/g, '_'))
    .filter(Boolean);
  if (!parts.length) return ['entry'];
  return parts.map((p): DoubtField => ((SERVICES as readonly string[]).includes(p) ? (p as Service) : p === 'notes' || p === 'note' ? 'notes' : 'entry'));
}

/** Every doubted field of a row, deduplicated, in display order. */
export function doubtedFields(row: Pick<EmergencyRow, 'guard_flags'>): DoubtField[] {
  const set = new Set<DoubtField>();
  for (const f of Array.isArray(row.guard_flags) ? row.guard_flags : []) for (const d of flagFields(f)) set.add(d);
  return DOUBT_ORDER.filter((d) => set.has(d));
}

export function confidenceOf(raw: unknown): Confidence {
  const c = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return c === 'high' || c === 'medium' || c === 'low' ? c : 'unknown';
}

export function displayRow(row: EmergencyRow): RowDisplay {
  const doubted = doubtedFields(row);
  const lines: NumberLine[] = [];
  for (const service of SERVICES) {
    const raw = row[service];
    const tel = telUri(raw);
    if (!raw || !tel) continue;
    const number = raw.trim();
    const existing = lines.find((l) => l.number === number);
    if (existing) existing.services.push(service);
    else lines.push({ number, services: [service], tel, doubted: false });
  }
  for (const l of lines) l.doubted = l.services.some((s) => doubted.includes(s));
  const notes = typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim() : null;
  const onLine = new Set<DoubtField>(lines.flatMap((l) => l.services));
  const notesDoubted = doubted.includes('notes') && notes !== null;
  return {
    iso2: row.iso2,
    country: row.country,
    lines,
    noNumber: lines.length === 0,
    verifyLocally: true,
    source: sourceOf(row),
    notes,
    confidence: confidenceOf(row.confidence),
    doubted,
    doubtedElsewhere: doubted.filter((d) => !onLine.has(d) && d !== 'notes'),
    notesDoubted,
  };
}

/** The service a line is labelled with: "general" covers everything it shares a number with. */
export const lineLabelServices = (line: NumberLine): Service[] => (line.services.includes('general') ? ['general'] : line.services);

// ------------------------------------------------------------------ tel: URIs

/**
 * `tel:` URI with digits and one leading + only (no spaces, letters, * or #, so nothing but a plain number is
 * ever dialled). Null when fewer than 2 digits remain.
 */
export function telUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const plus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (digits.length < 2 || digits.length > 20) return null;
  return `tel:${plus ? '+' : ''}${digits}`;
}

export const isDialable = (raw: string | null | undefined) => telUri(raw) !== null;

// ------------------------------------------------------------------ where am I?

/** Common travel zones → ISO 3166-1 alpha-2. Unknown zones return null so the UI asks the user to pick. */
export const ZONE_COUNTRY: Readonly<Record<string, string>> = {
  // Asia
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Macau': 'MO',
  'Asia/Taipei': 'TW',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Bangkok': 'TH',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN',
  'Asia/Phnom_Penh': 'KH',
  'Asia/Vientiane': 'LA',
  'Asia/Yangon': 'MM',
  'Asia/Jakarta': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Manila': 'PH',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Kathmandu': 'NP',
  'Asia/Colombo': 'LK',
  'Asia/Dhaka': 'BD',
  'Asia/Karachi': 'PK',
  'Indian/Maldives': 'MV',
  'Asia/Dubai': 'AE',
  'Asia/Qatar': 'QA',
  'Asia/Riyadh': 'SA',
  'Asia/Muscat': 'OM',
  'Asia/Bahrain': 'BH',
  'Asia/Kuwait': 'KW',
  'Asia/Amman': 'JO',
  'Asia/Jerusalem': 'IL',
  'Asia/Beirut': 'LB',
  'Asia/Tbilisi': 'GE',
  'Asia/Yerevan': 'AM',
  'Asia/Baku': 'AZ',
  'Asia/Almaty': 'KZ',
  'Asia/Tashkent': 'UZ',
  'Asia/Ulaanbaatar': 'MN',
  // Oceania
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Australia/Hobart': 'AU',
  'Australia/Darwin': 'AU',
  'Pacific/Auckland': 'NZ',
  'Pacific/Fiji': 'FJ',
  'Pacific/Tahiti': 'PF',
  'Pacific/Guam': 'GU',
  'Pacific/Honolulu': 'US',
  // Europe
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Lisbon': 'PT',
  'Atlantic/Madeira': 'PT',
  'Atlantic/Azores': 'PT',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'Europe/Paris': 'FR',
  'Europe/Brussels': 'BE',
  'Europe/Amsterdam': 'NL',
  'Europe/Luxembourg': 'LU',
  'Europe/Berlin': 'DE',
  'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT',
  'Europe/Rome': 'IT',
  'Europe/Malta': 'MT',
  'Europe/Monaco': 'MC',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Warsaw': 'PL',
  'Europe/Copenhagen': 'DK',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Helsinki': 'FI',
  'Atlantic/Reykjavik': 'IS',
  'Europe/Tallinn': 'EE',
  'Europe/Riga': 'LV',
  'Europe/Vilnius': 'LT',
  'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR',
  'Europe/Zagreb': 'HR',
  'Europe/Ljubljana': 'SI',
  'Europe/Belgrade': 'RS',
  'Europe/Sarajevo': 'BA',
  'Europe/Podgorica': 'ME',
  'Europe/Tirane': 'AL',
  'Europe/Skopje': 'MK',
  'Europe/Sofia': 'BG',
  'Europe/Bucharest': 'RO',
  'Europe/Bratislava': 'SK',
  'Europe/Kyiv': 'UA',
  'Europe/Kiev': 'UA',
  'Asia/Nicosia': 'CY',
  // Africa
  'Africa/Cairo': 'EG',
  'Africa/Casablanca': 'MA',
  'Africa/Tunis': 'TN',
  'Africa/Johannesburg': 'ZA',
  'Africa/Nairobi': 'KE',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kampala': 'UG',
  'Africa/Kigali': 'RW',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Dakar': 'SN',
  'Africa/Windhoek': 'NA',
  'Africa/Gaborone': 'BW',
  'Indian/Mauritius': 'MU',
  'Indian/Mahe': 'SC',
  // Americas
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Montreal': 'CA',
  'America/Edmonton': 'CA',
  'America/Halifax': 'CA',
  'America/Mexico_City': 'MX',
  'America/Cancun': 'MX',
  'America/Guatemala': 'GT',
  'America/Costa_Rica': 'CR',
  'America/Panama': 'PA',
  'America/Havana': 'CU',
  'America/Jamaica': 'JM',
  'America/Puerto_Rico': 'PR',
  'America/Santo_Domingo': 'DO',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
  'America/Guayaquil': 'EC',
  'Pacific/Galapagos': 'EC',
  'America/La_Paz': 'BO',
  'America/Santiago': 'CL',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Buenos_Aires': 'AR',
  'America/Montevideo': 'UY',
  'America/Asuncion': 'PY',
  'America/Sao_Paulo': 'BR',
  'America/Caracas': 'VE',
};

/** Country for a zone; an old zone name some phones still report ("Asia/Katmandu") maps like its current name. */
export const countryForZone = (tz: string | null | undefined): string | null =>
  tz ? (ZONE_COUNTRY[tz] ?? (LEGACY_ZONES[tz] ? ZONE_COUNTRY[LEGACY_ZONES[tz]] : undefined) ?? null) : null;

/**
 * The zone you are most likely in for an item from nextUp: mid-journey → where you are heading; otherwise the
 * place the item starts (the next flight leaves from where you are now).
 */
export function zoneForNext(next: NonNullable<ReturnType<typeof nextUp>>): string {
  const { item, state } = next;
  if (state === 'now' && item.end) return item.end.tz;
  return item.start.tz;
}

export type CountryGuess = { iso2: string; zone: string; from: 'trip' | 'phone' } | null;

/**
 * "Which country am I in?" from the current / next item of a trip that is on today, else the phone's zone.
 * Never uses location. Null when nothing maps (the UI then asks the user to pick).
 */
export function guessCountry(trips: Trip[], now: number, today: LocalDate, phoneTz?: string | null): CountryGuess {
  const items: Item[] = trips.filter((t) => tripPhase(t, today) === 'active').flatMap((t) => t.items);
  const next = nextUp(items, now);
  if (next) {
    const zone = zoneForNext(next);
    const iso2 = countryForZone(zone);
    if (iso2) return { iso2, zone, from: 'trip' };
  }
  const iso2 = countryForZone(phoneTz);
  if (phoneTz && iso2) return { iso2, zone: phoneTz, from: 'phone' };
  return null;
}

// ------------------------------------------------------------------ the user's card

/** Persisted keys (src/state/persisted.ts): the card, and the country the user picked (null = guess). */
export const EMERGENCY_KEY = 'satchel.emergency.v1';
export const COUNTRY_KEY = 'satchel.emergencyCountry.v1';

export const EMPTY_CARD: EmergencyCard = { contacts: [] };

export type CardField = 'insurer' | 'policy' | 'insurerPhone' | 'contacts' | 'medicalNotes';
export type CardStatus = { missing: CardField[]; filled: CardField[]; empty: boolean; complete: boolean };

const has = (s: string | undefined) => !!s && s.trim().length > 0;

/** Which parts of the card are filled. Medical notes are optional and never count against "complete". */
export function cardStatus(card: EmergencyCard | null | undefined): CardStatus {
  const c = card ?? EMPTY_CARD;
  const checks: [CardField, boolean][] = [
    ['insurer', has(c.insurer)],
    ['policy', has(c.policy)],
    ['insurerPhone', has(c.insurerPhone)],
    ['contacts', (c.contacts ?? []).some((x) => has(x.name) && isDialable(x.phone))],
    ['medicalNotes', has(c.medicalNotes)],
  ];
  const filled = checks.filter(([, ok]) => ok).map(([f]) => f);
  const missing = checks.filter(([f, ok]) => !ok && f !== 'medicalNotes').map(([f]) => f);
  return { missing, filled, empty: filled.length === 0, complete: missing.length === 0 };
}

export type ContactError = 'name' | 'phone';
export type CardErrors = { insurerPhone?: 'phone'; contacts: Record<string, ContactError[]> };

const blank = (c: EmergencyContact) => !has(c.name) && !has(c.phone) && !has(c.relation);

/** Errors before saving. A contact left completely blank is not an error (it is dropped by cleanCard). */
export function validateCard(card: EmergencyCard): CardErrors {
  const errors: CardErrors = { contacts: {} };
  if (has(card.insurerPhone) && !isDialable(card.insurerPhone)) errors.insurerPhone = 'phone';
  for (const c of card.contacts) {
    if (blank(c)) continue;
    const e: ContactError[] = [];
    if (!has(c.name)) e.push('name');
    if (!isDialable(c.phone)) e.push('phone');
    if (e.length) errors.contacts[c.id] = e;
  }
  return errors;
}

export const hasErrors = (e: CardErrors) => !!e.insurerPhone || Object.keys(e.contacts).length > 0;

const opt = (s: string | undefined) => (has(s) ? (s as string).trim() : undefined);

/** Trimmed copy for saving: empty strings become absent, fully blank contacts are dropped. */
export function cleanCard(card: EmergencyCard): EmergencyCard {
  const out: EmergencyCard = { contacts: [] };
  const insurer = opt(card.insurer);
  const policy = opt(card.policy);
  const insurerPhone = opt(card.insurerPhone);
  const medicalNotes = opt(card.medicalNotes);
  if (insurer) out.insurer = insurer;
  if (policy) out.policy = policy;
  if (insurerPhone) out.insurerPhone = insurerPhone;
  if (medicalNotes) out.medicalNotes = medicalNotes;
  for (const c of card.contacts) {
    if (blank(c)) continue;
    const relation = opt(c.relation);
    out.contacts.push({ id: c.id, name: c.name.trim(), phone: c.phone.trim(), ...(relation ? { relation } : {}) });
  }
  return out;
}

/** True when two cards would save the same (for "discard changes?"). */
export const sameCard = (a: EmergencyCard, b: EmergencyCard) => JSON.stringify(cleanCard(a)) === JSON.stringify(cleanCard(b));

/** Tolerant read of whatever is stored (older or partial shapes never crash the emergency tab). */
export function normaliseCard(raw: unknown): EmergencyCard {
  if (!raw || typeof raw !== 'object') return EMPTY_CARD;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const contacts: EmergencyContact[] = Array.isArray(r.contacts)
    ? r.contacts
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c, i) => ({
          id: str(c.id) ?? `contact_${i}`,
          name: str(c.name) ?? '',
          phone: str(c.phone) ?? '',
          ...(str(c.relation) ? { relation: str(c.relation) } : {}),
        }))
    : [];
  const out: EmergencyCard = { contacts };
  if (str(r.insurer)) out.insurer = str(r.insurer);
  if (str(r.policy)) out.policy = str(r.policy);
  if (str(r.insurerPhone)) out.insurerPhone = str(r.insurerPhone);
  if (str(r.medicalNotes)) out.medicalNotes = str(r.medicalNotes);
  return out;
}

/** A phone from a picked contact: prefers a mobile number, else the first one with digits. */
export function pickPhone(numbers: { number?: string | null; label?: string | null }[] | null | undefined): string | null {
  const list = (numbers ?? []).filter((n) => isDialable(n.number));
  if (!list.length) return null;
  const mobile = list.find((n) => /mobile|cell|iphone/i.test(n.label ?? ''));
  return ((mobile ?? list[0]).number ?? '').trim();
}
