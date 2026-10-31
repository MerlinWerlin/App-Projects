// T55 country essentials: plug types (IEC A–N), mains voltage and frequency, driving side and the international
// calling code for the Emergency tab's chosen country, plus a "Bring an adapter?" hint against the traveller's home
// country. Pure TypeScript. The table JSON (src/content/country_essentials.json) is passed in by the caller.
// Unknown values are null and the UI says "Not sure — check locally", never a blank. Always "verify locally".
import { urlHost } from './emergency.ts';

export const PLUG_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'] as const;
export type PlugLetter = (typeof PLUG_LETTERS)[number];
export type DrivingSide = 'left' | 'right';

export type EssentialsRow = {
  iso2: string;
  country: string;
  /** IEC plug / socket types in use, A–N. Null when not confidently known. */
  plugs: string[] | null;
  /** Nominal mains voltages (one, or two where both are common, like Brazil 127 / 220). */
  voltage: number[] | null;
  /** Mains frequencies in Hz (Japan has both 50 and 60). */
  frequency: number[] | null;
  driving: DrivingSide | null;
  /** "+81". */
  calling_code: string | null;
  /** https source URLs (plugs / power, driving side, calling codes). */
  sources: string[];
  /** ISO YYYY-MM-DD. */
  checked: string;
  notes?: string | null;
};

export type EssentialsTable = { version: number; checked?: string; rule: string; countries: EssentialsRow[] };

/** Where the home country choice is stored (usePersisted). Null = not chosen. */
export const HOME_COUNTRY_KEY = 'satchel.homeCountry.v1';

export const VOLTAGE_RANGE = { min: 90, max: 250 } as const;
export const FREQUENCY_RANGE = { min: 50, max: 60 } as const;
export const CALLING_CODE = /^\+\d{1,4}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isPlugLetter = (v: unknown): v is PlugLetter => typeof v === 'string' && (PLUG_LETTERS as readonly string[]).includes(v);

/** A real calendar date in YYYY-MM-DD. */
export function isIsoDate(s: unknown): boolean {
  const m = ISO_DATE.exec(typeof s === 'string' ? s : '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const numsIn = (v: unknown, min: number, max: number) =>
  Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);

/** Everything wrong with a row; empty means the row may be shown. Used by the tests and any future import. */
export function rowProblems(row: EssentialsRow): string[] {
  const out: string[] = [];
  if (!/^[A-Z]{2}$/.test(String(row.iso2))) out.push('iso2');
  if (row.plugs !== null && !(Array.isArray(row.plugs) && row.plugs.length > 0 && row.plugs.every(isPlugLetter))) out.push('plugs');
  if (Array.isArray(row.plugs) && new Set(row.plugs).size !== row.plugs.length) out.push('plugs-duplicate');
  if (row.voltage !== null && !numsIn(row.voltage, VOLTAGE_RANGE.min, VOLTAGE_RANGE.max)) out.push('voltage');
  if (row.frequency !== null && !numsIn(row.frequency, FREQUENCY_RANGE.min, FREQUENCY_RANGE.max)) out.push('frequency');
  if (row.driving !== null && row.driving !== 'left' && row.driving !== 'right') out.push('driving');
  if (row.calling_code !== null && !(typeof row.calling_code === 'string' && CALLING_CODE.test(row.calling_code))) out.push('calling_code');
  if (!Array.isArray(row.sources) || row.sources.length === 0 || !row.sources.every((u) => urlHost(u) !== null)) out.push('sources');
  if (!isIsoDate(row.checked)) out.push('checked');
  return out;
}

export function findEssentials(table: EssentialsTable, iso2: string | null | undefined): EssentialsRow | null {
  if (!iso2) return null;
  const code = iso2.trim().toUpperCase();
  return table.countries.find((r) => r.iso2 === code) ?? null;
}

// ------------------------------------------------------------------ display model

export type EssentialsDisplay = {
  iso2: string;
  country: string;
  /** "A, B" or null (UI: "Not sure — check locally"). */
  plugs: string | null;
  /** "127 / 220 V" or null. */
  voltage: string | null;
  /** "50 / 60 Hz" or null. */
  frequency: string | null;
  driving: DrivingSide | null;
  callingCode: string | null;
  /** Distinct source hosts ("iec.ch"), in table order. */
  sourceHosts: string[];
  /** The checked date, or null when the row's date is unusable. */
  checked: string | null;
  notes: string | null;
  /** How many of the five facts are unknown. */
  unknownCount: number;
  /** Always true: bundled facts are never presented as guaranteed current. */
  verifyLocally: true;
};

const joinNums = (v: number[] | null, unit: string) => (v && v.length ? `${[...new Set(v)].join(' / ')} ${unit}` : null);

/** A row ready to draw. Anything that fails validation shows as unknown rather than as a wrong-looking value. */
export function displayEssentials(row: EssentialsRow): EssentialsDisplay {
  const problems = new Set(rowProblems(row));
  const plugs = !problems.has('plugs') && !problems.has('plugs-duplicate') && row.plugs ? row.plugs.join(', ') : null;
  const voltage = problems.has('voltage') ? null : joinNums(row.voltage, 'V');
  const frequency = problems.has('frequency') ? null : joinNums(row.frequency, 'Hz');
  const driving = problems.has('driving') ? null : row.driving;
  const callingCode = problems.has('calling_code') ? null : row.calling_code;
  const hosts: string[] = [];
  for (const u of Array.isArray(row.sources) ? row.sources : []) {
    const h = urlHost(u);
    if (h && !hosts.includes(h)) hosts.push(h);
  }
  const unknownCount = [plugs, voltage, frequency, driving, callingCode].filter((x) => x === null).length;
  return {
    iso2: row.iso2,
    country: row.country,
    plugs,
    voltage,
    frequency,
    driving,
    callingCode,
    sourceHosts: hosts,
    checked: isIsoDate(row.checked) ? row.checked : null,
    notes: typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim() : null,
    unknownCount,
    verifyLocally: true,
  };
}

// ------------------------------------------------------------------ adapter hint

/**
 * Well-known one-way fits: a plug of the key type goes into sockets of the listed types. Type A (two flat pins)
 * fits type B sockets; the type C Europlug fits E, F, J, K, L and N sockets. Everything else counts only as itself.
 */
export const PLUG_FITS: Partial<Record<PlugLetter, readonly PlugLetter[]>> = {
  A: ['A', 'B'],
  C: ['C', 'E', 'F', 'J', 'K', 'L', 'N'],
};

const fitsInto = (plug: string, sockets: readonly string[]) => (isPlugLetter(plug) ? (PLUG_FITS[plug] ?? [plug]) : [plug]).some((s) => sockets.includes(s));

/**
 * - same: the home country is the destination
 * - unknown: either side's plugs are not known
 * - fits: every home plug type fits a destination socket type
 * - some: some home plug types fit, others don't (bring one to be safe)
 * - adapter: none of the home plug types fit
 */
export type AdapterVerdict = 'same' | 'unknown' | 'fits' | 'some' | 'adapter';

export type AdapterHint = {
  verdict: AdapterVerdict;
  /** Home and destination voltages are in different bands (100–127 V vs 220–240 V): check chargers say 100–240 V. */
  voltageDiffers: boolean;
  /** Home plug types that fit at the destination, for the detail line. */
  fitting: string[];
};

const band = (v: number) => (v < 160 ? 'low' : 'high');

/** Whether the home and destination voltages fall in different bands. False when either is unknown. */
export function voltageBandsDiffer(home: number[] | null, dest: number[] | null): boolean {
  if (!home?.length || !dest?.length) return false;
  const h = new Set(home.map(band));
  const d = new Set(dest.map(band));
  return ![...h].some((b) => d.has(b));
}

export function adapterHint(dest: EssentialsRow, home: EssentialsRow): AdapterHint {
  const voltageDiffers = voltageBandsDiffer(home.voltage, dest.voltage);
  if (dest.iso2 === home.iso2) return { verdict: 'same', voltageDiffers: false, fitting: [] };
  const hp = displayEssentials(home).plugs ? home.plugs ?? [] : [];
  const dp = displayEssentials(dest).plugs ? dest.plugs ?? [] : [];
  if (!hp.length || !dp.length) return { verdict: 'unknown', voltageDiffers, fitting: [] };
  const fitting = hp.filter((p) => fitsInto(p, dp));
  const verdict: AdapterVerdict = fitting.length === hp.length ? 'fits' : fitting.length > 0 ? 'some' : 'adapter';
  return { verdict, voltageDiffers, fitting };
}

/** A stored home-country value as an ISO code the table knows, or null. */
export function normaliseHome(table: EssentialsTable, raw: unknown): string | null {
  return typeof raw === 'string' ? findEssentials(table, raw)?.iso2 ?? null : null;
}
