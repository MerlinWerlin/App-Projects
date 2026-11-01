// Country-level regions only. No precise location is ever stored.

export type RegionId = 'oceania' | 'uk-ie' | 'north-america' | 'europe' | 'japan' | 'se-asia' | 'wilds';
export const REGIONS: readonly RegionId[] = ['oceania', 'uk-ie', 'north-america', 'europe', 'japan', 'se-asia', 'wilds'];

const COUNTRY_TO_REGION: Readonly<Record<string, RegionId>> = {
  AU: 'oceania', NZ: 'oceania', FJ: 'oceania', PG: 'oceania',
  GB: 'uk-ie', IE: 'uk-ie',
  US: 'north-america', CA: 'north-america', MX: 'north-america',
  JP: 'japan',
  SG: 'se-asia', MY: 'se-asia', TH: 'se-asia', VN: 'se-asia', ID: 'se-asia', PH: 'se-asia', KH: 'se-asia', LA: 'se-asia',
  FR: 'europe', DE: 'europe', ES: 'europe', IT: 'europe', NL: 'europe', BE: 'europe', PT: 'europe', AT: 'europe',
  CH: 'europe', SE: 'europe', NO: 'europe', DK: 'europe', FI: 'europe', PL: 'europe', CZ: 'europe', GR: 'europe',
  HU: 'europe', IS: 'europe', LU: 'europe', SK: 'europe', SI: 'europe', HR: 'europe', RO: 'europe', BG: 'europe',
  EE: 'europe', LV: 'europe', LT: 'europe',
};

/** Two-letter country code (any case) to region; unknown or missing countries are "wilds". */
export function regionForCountry(code: string | null | undefined): RegionId {
  if (!code) return 'wilds';
  return COUNTRY_TO_REGION[code.trim().toUpperCase()] ?? 'wilds';
}
