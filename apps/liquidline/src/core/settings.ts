// App settings: country, units, gauge vs absolute, local altitude. Defaults come from the country profile; the person
// can change any of them in Settings. Pure TypeScript (settings.test.ts).
import { COUNTRIES, profileFor, type CountryCode } from './countries.ts';
import { atmAtAltitude, type LengthUnit, type MassUnit, type PressureUnit, type TempUnit, type VacuumUnit } from './units.ts';

export type Units = { pressure: PressureUnit; temp: TempUnit; length: LengthUnit; mass: MassUnit; vacuum: VacuumUnit };
export type Settings = {
  version: 1;
  country: CountryCode;
  units: Units;
  /** Pressures typed and shown are gauge readings (true) or absolute (false). */
  gauge: boolean;
  /** Site altitude above sea level, metres: sets the atmosphere added to gauge readings. */
  altitudeM: number;
  onboarded: boolean;
  /** The person confirmed they understand the app is an aid for licensed technicians. */
  acknowledged: boolean;
  refrigerant: string;
};

export const SETTINGS_KEY = 'liquidline.settings.v1';

export function defaultsFor(country: CountryCode): Settings {
  const c = profileFor(country);
  return { version: 1, country: c.code, units: { ...c.units }, gauge: true, altitudeM: 0, onboarded: false, acknowledged: false, refrigerant: c.refrigerants[0] };
}

/** The device region (ISO 3166 alpha-2, e.g. from expo-localization) mapped to a profile code. */
export function countryFromRegion(region: string | null | undefined): CountryCode {
  const r = (region ?? '').toUpperCase();
  if (r === 'UK') return 'GB';
  return (COUNTRIES.find((c) => c.code === r)?.code ?? 'OTHER') as CountryCode;
}

const PRESSURES: PressureUnit[] = ['kPa', 'bar', 'psi', 'MPa'];
const TEMPS: TempUnit[] = ['C', 'F'];
const LENGTHS: LengthUnit[] = ['m', 'ft'];
const MASSES: MassUnit[] = ['g', 'oz'];
const VACUUMS: VacuumUnit[] = ['micron', 'Pa', 'mbar', 'Torr'];
const pick = <T,>(v: unknown, list: T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

export function parseSettings(raw: string | null | undefined, fallbackCountry: CountryCode): Settings {
  const d = defaultsFor(fallbackCountry);
  if (!raw) return d;
  try {
    const v = JSON.parse(raw) as Partial<Settings> | null;
    if (!v || typeof v !== 'object') return d;
    const country = (COUNTRIES.some((c) => c.code === v.country) ? v.country : fallbackCountry) as CountryCode;
    const base = defaultsFor(country);
    const u = (v.units ?? {}) as Partial<Units>;
    return {
      version: 1,
      country,
      units: {
        pressure: pick(u.pressure, PRESSURES, base.units.pressure),
        temp: pick(u.temp, TEMPS, base.units.temp),
        length: pick(u.length, LENGTHS, base.units.length),
        mass: pick(u.mass, MASSES, base.units.mass),
        vacuum: pick(u.vacuum, VACUUMS, base.units.vacuum),
      },
      gauge: typeof v.gauge === 'boolean' ? v.gauge : true,
      altitudeM: typeof v.altitudeM === 'number' && Number.isFinite(v.altitudeM) ? Math.max(-500, Math.min(6000, v.altitudeM)) : 0,
      onboarded: v.onboarded === true,
      acknowledged: v.acknowledged === true,
      refrigerant: typeof v.refrigerant === 'string' && v.refrigerant ? v.refrigerant : base.refrigerant,
    };
  } catch {
    return d;
  }
}

/** Changing country resets the units and refrigerant to that country's defaults (the person can change them again). */
export function withCountry(s: Settings, country: CountryCode): Settings {
  const c = profileFor(country);
  const common = c.refrigerants.slice(0, c.commonCount);
  return { ...s, country: c.code, units: { ...c.units }, refrigerant: common.includes(s.refrigerant) ? s.refrigerant : c.refrigerants[0] };
}

export function atmKpa(s: Settings): number {
  return atmAtAltitude(s.altitudeM);
}
