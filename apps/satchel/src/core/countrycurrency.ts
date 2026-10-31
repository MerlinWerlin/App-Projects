// Country -> currency (T96), so the arrival card can name the local currency without a saved rate.
//
// Source: ISO 4217 "List One" (current currency and funds code list, entities and their currencies), published by
// SIX Group as the ISO 4217 maintenance agency. Compiled for Satchel on 2026-10-31 from the list as it stood with
// the amendments in force by that date (Croatia EUR from 2023-01-01, Sierra Leone SLE, Zimbabwe ZWG from 2024,
// Curaçao and Sint Maarten XCG from 2025-03-31, Bulgaria EUR from 2026-01-01). Only the traveller-facing legal
// tender is kept: fund codes (BOV, CLF, COU, MXV, USN, UYI, UYW, CHE, CHW) and precious metals are left out.
//
// `code` is the currency a traveller mostly meets; `also` are further currencies ISO 4217 lists for the same
// country (e.g. Panama: PAB and USD). Rows marked `iso: false` are not in ISO 4217 List One and follow common use
// (Kosovo, XK, is a user-assigned code). `null` means ISO 4217 lists "no universal currency" for that entity, and
// the card then falls back to the traveller's own currencies. General guidance; verify locally.
// Pure TypeScript; Node runs it directly.

export type CountryCurrency = { code: string; also?: readonly string[]; iso?: false };

export const COUNTRY_CURRENCY_SOURCE = {
  name: 'ISO 4217 List One (SIX Group, ISO 4217 maintenance agency)',
  checked: '2026-10-31',
} as const;

const c = (code: string, also?: readonly string[]): CountryCurrency => (also ? { code, also } : { code });

export const COUNTRY_CURRENCY: Readonly<Record<string, CountryCurrency | null>> = {
  AD: c('EUR'), AE: c('AED'), AF: c('AFN'), AG: c('XCD'), AI: c('XCD'), AL: c('ALL'), AM: c('AMD'), AO: c('AOA'),
  AR: c('ARS'), AS: c('USD'), AT: c('EUR'), AU: c('AUD'), AW: c('AWG'), AX: c('EUR'), AZ: c('AZN'),
  BA: c('BAM'), BB: c('BBD'), BD: c('BDT'), BE: c('EUR'), BF: c('XOF'), BG: c('EUR'), BH: c('BHD'), BI: c('BIF'),
  BJ: c('XOF'), BL: c('EUR'), BM: c('BMD'), BN: c('BND'), BO: c('BOB'), BQ: c('USD'), BR: c('BRL'), BS: c('BSD'),
  BT: c('BTN', ['INR']), BV: c('NOK'), BW: c('BWP'), BY: c('BYN'), BZ: c('BZD'),
  CA: c('CAD'), CC: c('AUD'), CD: c('CDF'), CF: c('XAF'), CG: c('XAF'), CH: c('CHF'), CI: c('XOF'), CK: c('NZD'),
  CL: c('CLP'), CM: c('XAF'), CN: c('CNY'), CO: c('COP'), CR: c('CRC'), CU: c('CUP'), CV: c('CVE'), CW: c('XCG'),
  CX: c('AUD'), CY: c('EUR'), CZ: c('CZK'),
  DE: c('EUR'), DJ: c('DJF'), DK: c('DKK'), DM: c('XCD'), DO: c('DOP'), DZ: c('DZD'),
  EC: c('USD'), EE: c('EUR'), EG: c('EGP'), EH: c('MAD'), ER: c('ERN'), ES: c('EUR'), ET: c('ETB'),
  FI: c('EUR'), FJ: c('FJD'), FK: c('FKP'), FM: c('USD'), FO: c('DKK'), FR: c('EUR'),
  GA: c('XAF'), GB: c('GBP'), GD: c('XCD'), GE: c('GEL'), GF: c('EUR'), GG: c('GBP'), GH: c('GHS'), GI: c('GIP'),
  GL: c('DKK'), GM: c('GMD'), GN: c('GNF'), GP: c('EUR'), GQ: c('XAF'), GR: c('EUR'), GS: null, GT: c('GTQ'),
  GU: c('USD'), GW: c('XOF'), GY: c('GYD'),
  HK: c('HKD'), HM: c('AUD'), HN: c('HNL'), HR: c('EUR'), HT: c('HTG', ['USD']), HU: c('HUF'),
  ID: c('IDR'), IE: c('EUR'), IL: c('ILS'), IM: c('GBP'), IN: c('INR'), IO: c('USD'), IQ: c('IQD'), IR: c('IRR'),
  IS: c('ISK'), IT: c('EUR'),
  JE: c('GBP'), JM: c('JMD'), JO: c('JOD'), JP: c('JPY'),
  KE: c('KES'), KG: c('KGS'), KH: c('KHR'), KI: c('AUD'), KM: c('KMF'), KN: c('XCD'), KP: c('KPW'), KR: c('KRW'),
  KW: c('KWD'), KY: c('KYD'), KZ: c('KZT'),
  LA: c('LAK'), LB: c('LBP'), LC: c('XCD'), LI: c('CHF'), LK: c('LKR'), LR: c('LRD'), LS: c('LSL', ['ZAR']),
  LT: c('EUR'), LU: c('EUR'), LV: c('EUR'), LY: c('LYD'),
  MA: c('MAD'), MC: c('EUR'), MD: c('MDL'), ME: c('EUR'), MF: c('EUR'), MG: c('MGA'), MH: c('USD'), MK: c('MKD'),
  ML: c('XOF'), MM: c('MMK'), MN: c('MNT'), MO: c('MOP'), MP: c('USD'), MQ: c('EUR'), MR: c('MRU'), MS: c('XCD'),
  MT: c('EUR'), MU: c('MUR'), MV: c('MVR'), MW: c('MWK'), MX: c('MXN'), MY: c('MYR'), MZ: c('MZN'),
  NA: c('NAD', ['ZAR']), NC: c('XPF'), NE: c('XOF'), NF: c('AUD'), NG: c('NGN'), NI: c('NIO'), NL: c('EUR'),
  NO: c('NOK'), NP: c('NPR'), NR: c('AUD'), NU: c('NZD'), NZ: c('NZD'),
  OM: c('OMR'),
  // Panama: ISO lists the balboa first; US dollar notes are what circulate, so both are kept.
  PA: c('PAB', ['USD']), PE: c('PEN'), PF: c('XPF'), PG: c('PGK'), PH: c('PHP'), PK: c('PKR'), PL: c('PLN'),
  PM: c('EUR'), PN: c('NZD'), PR: c('USD'), PS: null, PT: c('EUR'), PW: c('USD'), PY: c('PYG'),
  QA: c('QAR'),
  RE: c('EUR'), RO: c('RON'), RS: c('RSD'), RU: c('RUB'), RW: c('RWF'),
  SA: c('SAR'), SB: c('SBD'), SC: c('SCR'), SD: c('SDG'), SE: c('SEK'), SG: c('SGD'), SH: c('SHP'), SI: c('EUR'),
  SJ: c('NOK'), SK: c('EUR'), SL: c('SLE'), SM: c('EUR'), SN: c('XOF'), SO: c('SOS'), SR: c('SRD'), SS: c('SSP'),
  ST: c('STN'), SV: c('USD'), SX: c('XCG'), SY: c('SYP'), SZ: c('SZL'),
  TC: c('USD'), TD: c('XAF'), TF: c('EUR'), TG: c('XOF'), TH: c('THB'), TJ: c('TJS'), TK: c('NZD'), TL: c('USD'),
  TM: c('TMT'), TN: c('TND'), TO: c('TOP'), TR: c('TRY'), TT: c('TTD'), TV: c('AUD'), TW: c('TWD'), TZ: c('TZS'),
  UA: c('UAH'), UG: c('UGX'), UM: c('USD'), US: c('USD'), UY: c('UYU'), UZ: c('UZS'),
  VA: c('EUR'), VC: c('XCD'), VE: c('VES'), VG: c('USD'), VI: c('USD'), VN: c('VND'), VU: c('VUV'),
  WF: c('XPF'), WS: c('WST'),
  // Kosovo: not in ISO 3166 or ISO 4217 List One; the euro is used.
  XK: { code: 'EUR', iso: false },
  YE: c('YER'), YT: c('EUR'),
  ZA: c('ZAR'), ZM: c('ZMW'), ZW: c('ZWG'),
};

/** The country's currency row, or null for an unknown code or an entity with no universal currency. */
export function currencyForCountry(iso2: string | null | undefined): CountryCurrency | null {
  const code = typeof iso2 === 'string' ? iso2.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return Object.prototype.hasOwnProperty.call(COUNTRY_CURRENCY, code) ? (COUNTRY_CURRENCY[code] ?? null) : null;
}

/** Every currency the country uses, the main one first. */
export const currenciesOf = (row: CountryCurrency): string[] => [row.code, ...(row.also ?? [])];

/**
 * A currency's name in the app's language (Intl.DisplayNames, type currency), or null when the engine has no
 * DisplayNames, doesn't know the code, or only echoes the code back. Formatters are cached per language.
 */
const currencyNames = new Map<string, { of(code: string): string | undefined } | null>();
export function currencyName(code: string, lang: string): string | null {
  if (!/^[A-Z]{3}$/.test(code)) return null;
  let names = currencyNames.get(lang);
  if (names === undefined) {
    try {
      const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: 'currency'; fallback: 'none' }) => { of(code: string): string | undefined } }).DisplayNames;
      names = typeof DN === 'function' ? new DN([lang], { type: 'currency', fallback: 'none' }) : null;
    } catch {
      names = null;
    }
    currencyNames.set(lang, names);
  }
  if (!names) return null;
  try {
    const n = names.of(code);
    return typeof n === 'string' && n.trim() !== '' && n.trim().toUpperCase() !== code ? n.trim() : null;
  } catch {
    return null;
  }
}

/** Test hook: forget cached formatters (after swapping Intl.DisplayNames). */
export const resetCurrencyNames = () => currencyNames.clear();
