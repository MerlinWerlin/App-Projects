/** Country lookup: six fully guided countries, everything else gets the metric generic profile under its own name. */
import { DEFAULT_TERMS } from '../core/context';
import { AU } from './au';
import { CA, US } from './na';
import { NZ } from './nz';
import { s } from './src';
import type { Country } from './types';
import { GB, IE } from './uk-ie';

export const GUIDED: Country[] = [AU, NZ, GB, IE, US, CA];

const unverified = (label: string) => s(label, '', 'unverified');

/** Generic fallback: metric, no local catalogue claims, the rational drainage method with user-entered values. */
export function generic(code: string, name: string): Country {
  return {
    code, name, guided: false, sys: 'metric', pitchStyle: 'deg', currency: '', spelling: 'en-GB', terms: DEFAULT_TERMS,
    standards: [],
    safety: { regulator: 'your national work-safety regulator', text: 'Plan every roof job for falls: edge protection, safe access, and harnesses where needed. Check your local rules for the height they start at.', src: unverified('General guidance') },
    sheets: [], tiles: [], shingles: [], caps: [], gutters: [], downpipes: [],
    drainage: {
      mode: 'flow',
      method: 'Rational method (Q = A × I ÷ 3600) with values you enter',
      slopeFactor: () => 1,
      slopeFactorNote: 'Plan area. Your local standard may add an allowance for roof slope.',
      fallRatio: 500, fallNote: 'No local value is built in for this country; 1:500 is a common starting point. Check your local code.', fallSrc: unverified('Generic starting value'),
      designIntensityMmPerHr: null,
      intensityNote: 'Enter the design rainfall intensity for the site from your national weather service or code.',
      cities: [], maxDownpipeSpacingMm: null, src: unverified('Generic method'),
    },
    battenStockMm: [4800, 6000], trimStockMm: [3000, 6000],
    defaults: { overhangMm: 50, maxSheetMm: 12000, purlinSpacingMm: 1000, eavesSetOutMm: 320, topSetOutMm: 40, wastePct: 5, trimStockMm: 3000, trimLapMm: 100, battenStockMm: 4800, screwBox: 100 },
    fixingsNote: null,
    notes: ['Eaveline doesn’t have a local materials catalogue for this country yet. Enter profiles, tiles and stock lengths from your supplier.'],
    gaps: ['No country catalogue: every product value is entered by you.'],
  };
}

/** ISO 3166-1 alpha-2 codes with English short names (for the picker). */
export const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AD: 'Andorra', AO: 'Angola', AG: 'Antigua and Barbuda', AR: 'Argentina', AM: 'Armenia', AT: 'Austria',
  AZ: 'Azerbaijan', BS: 'Bahamas', BH: 'Bahrain', BD: 'Bangladesh', BB: 'Barbados', BY: 'Belarus', BE: 'Belgium', BZ: 'Belize', BJ: 'Benin', BT: 'Bhutan',
  BO: 'Bolivia', BA: 'Bosnia and Herzegovina', BW: 'Botswana', BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi', KH: 'Cambodia',
  CM: 'Cameroon', CV: 'Cape Verde', CF: 'Central African Republic', TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia', KM: 'Comoros', CG: 'Congo',
  CD: 'Congo (DRC)', CR: 'Costa Rica', CI: 'Côte d’Ivoire', HR: 'Croatia', CU: 'Cuba', CY: 'Cyprus', CZ: 'Czechia', DK: 'Denmark', DJ: 'Djibouti', DM: 'Dominica',
  DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador', GQ: 'Equatorial Guinea', ER: 'Eritrea', EE: 'Estonia', SZ: 'Eswatini', ET: 'Ethiopia',
  FJ: 'Fiji', FI: 'Finland', FR: 'France', GA: 'Gabon', GM: 'Gambia', GE: 'Georgia', DE: 'Germany', GH: 'Ghana', GR: 'Greece', GD: 'Grenada', GT: 'Guatemala',
  GN: 'Guinea', GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras', HK: 'Hong Kong', HU: 'Hungary', IS: 'Iceland', IN: 'India', ID: 'Indonesia',
  IR: 'Iran', IQ: 'Iraq', IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', KW: 'Kuwait',
  KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia', LB: 'Lebanon', LS: 'Lesotho', LR: 'Liberia', LY: 'Libya', LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg',
  MO: 'Macao', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia', MV: 'Maldives', ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands', MR: 'Mauritania', MU: 'Mauritius',
  MX: 'Mexico', FM: 'Micronesia', MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia',
  NR: 'Nauru', NP: 'Nepal', NL: 'Netherlands', NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', KP: 'North Korea', MK: 'North Macedonia', NO: 'Norway', OM: 'Oman',
  PK: 'Pakistan', PW: 'Palau', PS: 'Palestine', PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal',
  PR: 'Puerto Rico', QA: 'Qatar', RO: 'Romania', RU: 'Russia', RW: 'Rwanda', KN: 'Saint Kitts and Nevis', LC: 'Saint Lucia', VC: 'Saint Vincent and the Grenadines',
  WS: 'Samoa', SM: 'San Marino', ST: 'São Tomé and Príncipe', SA: 'Saudi Arabia', SN: 'Senegal', RS: 'Serbia', SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapore',
  SK: 'Slovakia', SI: 'Slovenia', SB: 'Solomon Islands', SO: 'Somalia', ZA: 'South Africa', KR: 'South Korea', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SR: 'Suriname', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand', TL: 'Timor-Leste',
  TG: 'Togo', TO: 'Tonga', TT: 'Trinidad and Tobago', TN: 'Tunisia', TR: 'Türkiye', TM: 'Turkmenistan', TV: 'Tuvalu', UG: 'Uganda', UA: 'Ukraine',
  AE: 'United Arab Emirates', UY: 'Uruguay', UZ: 'Uzbekistan', VU: 'Vanuatu', VA: 'Vatican City', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
  // Guided ones (also in GUIDED):
  AU: 'Australia', NZ: 'New Zealand', GB: 'United Kingdom', IE: 'Ireland', US: 'United States', CA: 'Canada',
};

const cache = new Map<string, Country>();

/** The profile for a country code. Unknown codes fall back to generic; "UK" is accepted for GB. */
export function countryFor(code: string | null | undefined): Country {
  const c = (code ?? '').toUpperCase() === 'UK' ? 'GB' : (code ?? '').toUpperCase();
  const g = GUIDED.find(x => x.code === c);
  if (g) return g;
  const hit = cache.get(c);
  if (hit) return hit;
  const made = generic(c || 'XX', COUNTRY_NAMES[c] ?? 'Other country');
  cache.set(c, made);
  return made;
}

export function isKnownCountry(code: string | null | undefined): boolean {
  return !!code && !!COUNTRY_NAMES[code.toUpperCase()];
}

/** Picker list: guided first (in a fixed order), then the rest A–Z. */
export function countryList(): { code: string; name: string; guided: boolean }[] {
  const g = GUIDED.map(c => ({ code: c.code, name: c.name, guided: true }));
  const rest = Object.entries(COUNTRY_NAMES)
    .filter(([code]) => !GUIDED.some(x => x.code === code))
    .map(([code, name]) => ({ code, name, guided: false }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...g, ...rest];
}

/** Regional-indicator flag emoji for a country code. */
export function flag(code: string): string {
  if (!/^[A-Z]{2}$/i.test(code)) return '🏳️';
  return String.fromCodePoint(...[...code.toUpperCase()].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export type { Country } from './types';
