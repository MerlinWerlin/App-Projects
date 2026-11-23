/**
 * The user's country decides units, paper, currency, spelling, the standards named in notes, the pipe series and the
 * stocked-size catalogue (src/core/catalogue.ts). Full guidance: AU, NZ, GB, IE, US, CA. Anything else: metric,
 * A4, no currency symbol, ISO pipe sizes and generic sizes, labelled as generic.
 *
 * Pipe outside diameters:
 *  - ISO series (ISO 65 / EN 10255 / EN 10220 / AS 1074 / AS/NZS 1163 CHS): 21.3, 26.9, 33.7, 42.4, 48.3, 60.3, 76.1,
 *    88.9, 101.6, 114.3, 139.7, 165.1, 168.3, 219.1, 273.0/273.1, 323.9 mm.
 *  - ASME B36.10M (US, Canada) NPS: 0.840, 1.050, 1.315, 1.660, 1.900, 2.375, 2.875, 3.500, 4.000, 4.500, 5.563,
 *    6.625, 8.625, 10.750, 12.750 in. Sch 40 / Sch 80 walls from ASME B36.10M-2018 Table 1.
 * Standards (store pages of Standards Australia/NZ, BSI, AWS and CSA Group; scripts/country-steel-research.json):
 * AS/NZS 1554.1, AS/NZS 1163, AS 4041; BS EN 1090-2 with BS EN ISO 5817, BS EN 10219; EN 1090-2 and EN 10219 for
 * Ireland (Irish adoption names not verified, so the European names are shown); AWS D1.1, ASTM A500, ASME B31.3;
 * CSA W59, CSA G40.20/G40.21, CSA B51. Piping codes for NZ, GB and IE were not verified and are left out.
 */
import { CATALOGUES } from './catalogue.ts';
import type { PaperId } from './pdf.ts';
import type { Spelling } from './spell.ts';
import type { UnitSystem } from './units.ts';

export type CountryCode = 'AU' | 'NZ' | 'GB' | 'IE' | 'US' | 'CA' | 'OTHER';
export const COUNTRY_CODES: CountryCode[] = ['AU', 'NZ', 'GB', 'IE', 'US', 'CA', 'OTHER'];

/** od and walls in mm; walls named as the local series names them (Light/Medium/Heavy, Sch 40/80...). */
export interface PipeSize { label: string; od: number; walls?: Record<string, number> }

export interface CountryInfo {
  code: CountryCode;
  name: string;
  units: UnitSystem;
  paper: PaperId;
  currency: { code: string; symbol: string } | null;
  spelling: Spelling;
  /** Only names confirmed from standards bodies' pages; piping is null where it could not be verified. */
  standards: { welding: string; hollow: string; piping: string | null } | null;
  pipeSeries: string;
  pipes: PipeSize[];
}

const IN = 25.4;

/** ISO / EN / AS outside diameters with DN names. */
export const ISO_PIPES: PipeSize[] = [
  { label: 'DN15', od: 21.3 }, { label: 'DN20', od: 26.9 }, { label: 'DN25', od: 33.7 }, { label: 'DN32', od: 42.4 },
  { label: 'DN40', od: 48.3 }, { label: 'DN50', od: 60.3 }, { label: 'DN65', od: 76.1 }, { label: 'DN80', od: 88.9 },
  { label: 'DN90', od: 101.6 }, { label: 'DN100', od: 114.3 }, { label: 'DN125', od: 139.7 }, { label: 'DN150', od: 165.1 },
  { label: '168.3', od: 168.3 }, { label: 'DN200', od: 219.1 }, { label: 'DN250', od: 273.1 }, { label: 'DN300', od: 323.9 },
];

/** ASME B36.10M-2018, Table 1: NPS, OD (in) and Sch 40 / Sch 80 wall (in). */
const NPS_RAW: [string, number, number, number][] = [
  ['1/2', 0.84, 0.109, 0.147], ['3/4', 1.05, 0.113, 0.154], ['1', 1.315, 0.133, 0.179], ['1-1/4', 1.66, 0.14, 0.191],
  ['1-1/2', 1.9, 0.145, 0.2], ['2', 2.375, 0.154, 0.218], ['2-1/2', 2.875, 0.203, 0.276], ['3', 3.5, 0.216, 0.3],
  ['3-1/2', 4.0, 0.226, 0.318], ['4', 4.5, 0.237, 0.337], ['5', 5.563, 0.258, 0.375], ['6', 6.625, 0.28, 0.432],
  ['8', 8.625, 0.322, 0.5], ['10', 10.75, 0.365, 0.594], ['12', 12.75, 0.406, 0.688],
];
export const NPS_PIPES: PipeSize[] = NPS_RAW.map(([n, od, s40, s80]) => ({ label: `NPS ${n}`, od: od * IN, walls: { 'Sch 40': s40 * IN, 'Sch 80': s80 * IN } }));

/**
 * ISO outside diameters with the local wall series merged in from the stock catalogue (AS 1074 for AU/NZ,
 * EN 10255 for GB/IE), matched by OD. Sizes the catalogue does not list keep their OD only.
 */
function withWalls(code: 'AU' | 'NZ' | 'GB' | 'IE'): PipeSize[] {
  const list = CATALOGUES[code].pipe.sizes;
  return ISO_PIPES.map(p => {
    const hit = list.find(q => Math.abs(q.od - p.od) < 0.05);
    return hit ? { ...p, walls: Object.fromEntries(Object.entries(hit.walls).map(([k, v]) => [k.replace('ExtraLight', 'Extra light'), v])) } : p;
  });
}

const intl = (code: CountryCode, name: string, paper: PaperId, currency: CountryInfo['currency'], standards: CountryInfo['standards'], pipeSeries: string): CountryInfo =>
  ({ code, name, units: 'metric', paper, currency, spelling: 'intl', standards, pipeSeries, pipes: code === 'OTHER' ? ISO_PIPES : withWalls(code as 'AU' | 'NZ' | 'GB' | 'IE') });

export const COUNTRIES: Record<CountryCode, CountryInfo> = {
  AU: intl('AU', 'Australia', 'a4', { code: 'AUD', symbol: 'A$' }, { welding: 'AS/NZS 1554.1', hollow: 'AS/NZS 1163', piping: 'AS 4041' }, 'AS 1074 / AS/NZS 1163 CHS'),
  NZ: intl('NZ', 'New Zealand', 'a4', { code: 'NZD', symbol: 'NZ$' }, { welding: 'AS/NZS 1554.1', hollow: 'AS/NZS 1163', piping: null }, 'AS 1074 / AS/NZS 1163 CHS'),
  GB: intl('GB', 'United Kingdom', 'a4', { code: 'GBP', symbol: '£' }, { welding: 'BS EN 1090-2 and BS EN ISO 5817', hollow: 'BS EN 10219', piping: null }, 'EN 10255 / EN 10220'),
  IE: intl('IE', 'Ireland', 'a4', { code: 'EUR', symbol: '€' }, { welding: 'EN 1090-2 and EN ISO 5817', hollow: 'EN 10219', piping: null }, 'EN 10255 / EN 10220'),
  US: { code: 'US', name: 'United States', units: 'imperial', paper: 'letter', currency: { code: 'USD', symbol: '$' }, spelling: 'us', standards: { welding: 'AWS D1.1', hollow: 'ASTM A500', piping: 'ASME B31.3' }, pipeSeries: 'ASME B36.10M (NPS)', pipes: NPS_PIPES },
  // Canadian merchants (Russel Metals, Sureway Metal) list HSS, pipe and bar in inches and feet: inches by default.
  CA: { code: 'CA', name: 'Canada', units: 'imperial', paper: 'letter', currency: { code: 'CAD', symbol: 'C$' }, spelling: 'intl', standards: { welding: 'CSA W59', hollow: 'CSA G40.20/G40.21', piping: 'CSA B51' }, pipeSeries: 'ASME B36.10M (NPS)', pipes: NPS_PIPES },
  OTHER: intl('OTHER', 'Somewhere else', 'a4', null, null, 'ISO sizes'),
};

/** Device region (e.g. from expo-localization) to a supported country; anything else is OTHER. */
export function countryFromRegion(region: string | null | undefined): CountryCode {
  const r = (region ?? '').toUpperCase();
  if (r === 'UK') return 'GB';
  return (['AU', 'NZ', 'GB', 'IE', 'US', 'CA'] as const).find(c => c === r) ?? 'OTHER';
}

export function parseCountry(raw: unknown): CountryCode | null {
  return typeof raw === 'string' && (COUNTRY_CODES as string[]).includes(raw) ? (raw as CountryCode) : null;
}

/** The welding-code reminder used in "verify before cutting" notes. */
export function codeNote(c: CountryInfo): string {
  return c.standards ? `For structural work follow ${c.standards.welding} and the engineer's drawings.` : 'For structural or pressure work follow your local welding code and the engineer\'s drawings.';
}

export function money(amount: number, c: CountryInfo): string {
  const v = amount.toFixed(2);
  return c.currency ? `${c.currency.symbol}${v}` : v;
}
