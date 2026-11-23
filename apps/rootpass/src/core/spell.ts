/**
 * Spelling and trade words by country. The app's copy is written in Australian/British English; US users get US
 * spelling and US trade terms. Canadian English keeps -re/-our spellings (Canadian Oxford Dictionary: "metre",
 * "centre", "colour") and is treated like AU/NZ/UK/IE here.
 * Sources: Merriam-Webster (US: meter, center, miter, aluminum, color); Macquarie Dictionary (AU: metre, centre,
 * mitre, aluminium, colour); AISC / ASTM A500 use "HSS" for hollow structural sections in the US.
 */
export type Spelling = 'intl' | 'us';

type Rep = string | ((m: string) => string);
const US: [RegExp, Rep][] = [
  [/\bmillimetres\b/g, 'millimeters'], [/\bMillimetres\b/g, 'Millimeters'],
  [/\bcentimetres\b/g, 'centimeters'],
  [/\bmetres\b/g, 'meters'], [/\bMetres\b/g, 'Meters'], [/\bmetre\b/g, 'meter'], [/\bMetre\b/g, 'Meter'],
  [/\bcentrelines?\b/g, (m: string) => m.replace('centre', 'center')], [/\bCentrelines?\b/g, (m: string) => m.replace('Centre', 'Center')],
  [/\bcentres\b/g, 'centers'], [/\bcentre\b/g, 'center'], [/\bCentre\b/g, 'Center'], [/\bCENTRE\b/g, 'CENTER'],
  [/\bmitres\b/g, 'miters'], [/\bMitres\b/g, 'Miters'], [/\bmitre\b/g, 'miter'], [/\bMitre\b/g, 'Miter'], [/\bMITRE\b/g, 'MITER'],
  [/\bmitred\b/g, 'mitered'],
  [/\baluminium\b/g, 'aluminum'], [/\bAluminium\b/g, 'Aluminum'],
  [/\bcolours?\b/g, (m: string) => m.replace('colour', 'color')],
  [/\bcatalogue\b/g, 'catalog'],
  [/\boptimis/g, 'optimiz'],
];

export function spell(s: string, spelling: Spelling): string {
  if (spelling !== 'us' || !s) return s;
  let out = s;
  for (const [re, rep] of US) out = typeof rep === 'string' ? out.replace(re, rep) : out.replace(re, rep);
  return out;
}
