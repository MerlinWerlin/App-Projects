// Time-zone search for the zone picker (T24). Pure: the zone list comes from Intl.supportedValuesOf('timeZone')
// when the engine has it, merged with the bundled table in tzzones.ts (which is also the fallback list), and every
// zone is checked with Intl before it is offered. Finds a zone by city ("tokyo", "sao paulo"), country or a place
// that uses it ("japan", "kyoto", "bali"), the IANA name itself ("Asia/Tok") or a UTC offset ("UTC+9", "+5:30",
// "GMT-3"). No abbreviations (EST, CET...): they are ambiguous across countries.
import { isValidZone, offsetMinutes } from './tz.ts';
import { LEGACY_ZONES, ZONE_TABLE } from './tzzones.ts';

export type ZoneInfo = {
  tz: string;
  /** Last part of the IANA name, underscores as spaces: "Ho Chi Minh". */
  city: string;
  /** First part of the IANA name: "Asia". Empty for "UTC". */
  region: string;
  /** Country or territory from the bundled table; empty when the zone is not in it. */
  country: string;
};
export type ZoneMatch = ZoneInfo & { offset: number; offsetLabel: string };

type Row = { country: string; places: string };
const TABLE = new Map<string, Row>();
for (const line of ZONE_TABLE.split('\n')) {
  const [tz, country = '', places = ''] = line.split('|');
  if (tz && tz.trim()) TABLE.set(tz.trim(), { country: country.trim(), places: places.trim() });
}

/** Lower case, no accents, separators as single spaces: "São_Paulo" -> "sao paulo". */
export function normalize(s: string): string {
  let out = s.toLowerCase();
  try {
    out = out.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    // engine without String.prototype.normalize: accents stay, plain-letter searches still work
  }
  return out
    .replace(/[_/\-'’.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Today's name for an old zone name ("Asia/Calcutta" -> "Asia/Kolkata") when this engine knows the new one. */
export function canonicalZone(tz: string): string {
  const modern = LEGACY_ZONES[tz];
  return modern && isValidZone(modern) ? modern : tz;
}

function engineZones(): readonly string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] };
  return typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : [];
}

let cachedList: string[] | null = null;

/**
 * Every zone worth offering, sorted by name, without duplicates or old aliases. `source` stands in for
 * Intl.supportedValuesOf in tests; a source that throws or returns nothing leaves the bundled list.
 */
export function zoneList(source?: () => readonly string[]): string[] {
  if (!source && cachedList) return cachedList;
  let fromEngine: readonly string[] = [];
  try {
    fromEngine = (source ?? engineZones)() ?? [];
  } catch {
    fromEngine = [];
  }
  const seen = new Set<string>();
  // Etc/GMT+5 style names have the sign backwards (it means UTC-5); offer plain UTC and the city zones instead.
  for (const raw of [...fromEngine, ...TABLE.keys()]) {
    const tz = canonicalZone(raw);
    if (tz.startsWith('Etc/') || seen.has(tz) || !isValidZone(tz)) continue;
    seen.add(tz);
  }
  const list = [...seen].sort();
  if (!source) cachedList = list;
  return list;
}

export function zoneInfo(tz: string): ZoneInfo {
  const parts = tz.split('/');
  const row = TABLE.get(canonicalZone(tz));
  return {
    tz,
    city: (parts[parts.length - 1] ?? tz).replace(/_/g, ' '),
    region: parts.length > 1 ? parts[0].replace(/_/g, ' ') : '',
    country: row?.country ?? '',
  };
}

/** "UTC+9", "UTC+5:30", "UTC−3:30" (true minus sign, read as "minus"), "UTC+0". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** Minutes east of UTC for offset text like "UTC+9", "gmt -3:30", "+0545" or plain "UTC"; otherwise null. */
export function parseOffset(query: string): number | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  if (q === 'utc' || q === 'gmt' || q === 'z') return 0;
  const m = /^(?:utc|gmt)?([+\-−])(\d{1,2})(?:[:h]?(\d{2}))?$/.exec(q);
  if (!m) return null;
  const h = Number(m[2]);
  const mi = m[3] ? Number(m[3]) : 0;
  if (h > 14 || mi >= 60) return null;
  return (m[1] === '+' ? 1 : -1) * (h * 60 + mi);
}

function match(info: ZoneInfo, q: string, words: string[]): number {
  const city = normalize(info.city);
  const row = TABLE.get(canonicalZone(info.tz));
  const country = normalize(info.country);
  const places = row ? normalize(row.places) : '';
  const id = normalize(info.tz);
  // A word in the field starts with s ("south a" finds "south africa", "york" finds "new york").
  const startsWord = (field: string, s: string) => field.startsWith(s) || field.includes(` ${s}`);
  if (city === q) return 100;
  if (country === q) return 92;
  if (places && ` ${places} `.includes(` ${q} `)) return 90;
  if (city.startsWith(q)) return 80;
  if (startsWord(country, q)) return 72;
  if (places && startsWord(places, q)) return 70;
  if (id.startsWith(q) || startsWord(id, q)) return 60;
  if (city.includes(q) || country.includes(q)) return 40;
  // Several words in any order: "new york united", "australia queensland".
  const all = `${city} ${country} ${places} ${id}`;
  if (words.length > 1 && words.every((w) => startsWord(all, w))) return 30;
  return 0;
}

/**
 * Zones matching `query`, best first. An empty query lists every zone by UTC offset (west to east). `now` (ms)
 * sets which offset counts (daylight saving), `zones` the list to search (defaults to zoneList()).
 */
export function searchZones(query: string, opts: { now?: number; zones?: readonly string[]; limit?: number } = {}): ZoneMatch[] {
  const now = opts.now ?? Date.now();
  const zones = opts.zones ?? zoneList();
  const limit = opts.limit ?? 80;
  const withOffset = (tz: string): ZoneMatch => {
    const offset = offsetMinutes(tz, now);
    return { ...zoneInfo(tz), offset, offsetLabel: formatOffset(offset) };
  };
  const byCity = (a: ZoneMatch, b: ZoneMatch) => a.city.localeCompare(b.city);
  const known = (tz: string) => (TABLE.has(canonicalZone(tz)) ? 0 : 1);

  const raw = query.trim();
  if (!raw) return zones.map(withOffset).sort((a, b) => a.offset - b.offset || byCity(a, b));

  const offset = parseOffset(raw);
  if (offset !== null) {
    return zones
      .map(withOffset)
      .filter((z) => z.offset === offset)
      .sort((a, b) => known(a.tz) - known(b.tz) || byCity(a, b))
      .slice(0, limit);
  }

  const q = normalize(raw);
  if (!q) return [];
  const words = q.split(' ');
  const scored: Array<{ z: ZoneMatch; score: number }> = [];
  const exact = raw.includes('/') && isValidZone(raw) ? canonicalZone(raw) : null;
  if (exact && !zones.includes(exact)) scored.push({ z: withOffset(exact), score: 200 });
  for (const tz of zones) {
    const info = zoneInfo(tz);
    const score = tz === exact ? 200 : match(info, q, words);
    if (score > 0) scored.push({ z: { ...info, offset: 0, offsetLabel: '' }, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || known(a.z.tz) - known(b.z.tz) || byCity(a.z, b.z))
    .slice(0, limit)
    .map(({ z }) => (z.offsetLabel ? z : withOffset(z.tz)));
}
