// Destination themes: when the trip in focus is on now (or starts within THEME_LEAD_DAYS) and its destination is
// one of the popular travel countries below, the app takes on a light, whimsical look for that country: an accent
// hue, hero gradient hues for the Trips, Map and Wallet banners, a small header motif and a gentle ambient particle
// (petals, leaves, lanterns...) that can change with the month. Pure TS (no React Native), tested by node --test.
// The colours here are seeds and decorative paints only: src/theme/countryTheme.ts walks the accent and hero seeds
// until every pair passes the same WCAG checks as the base theme (src/theme/contrast.test.ts).
import { focusTrip, destinationZone } from './glance.ts';
import { countryForZone } from './emergency.ts';
import type { LocalDate, Trip } from './model.ts';
import { tripPhase } from './timeline.ts';
import { daysBetween } from './tz.ts';

/** An upcoming trip themes the app this many days before it starts (a trip on now always does). */
export const THEME_LEAD_DAYS = 45;

/** Header art drawn into the hero banners (src/ui/countryArt.tsx), one per country. */
export const MOTIFS = [
  'fuji', 'hanok', 'pines', 'eiffel', 'arches', 'clocktower', 'skyline', 'sails', 'fern', 'spire', 'splitgate', 'picado',
  'fan', 'dome', 'conehat', 'tram', 'gate', 'castle', 'windmill', 'peak', 'taj', 'supertree', 'palm', 'aurora', 'balloons',
] as const;
export type MotifId = (typeof MOTIFS)[number];

/** Small drawable shapes for the ambient layer (src/ui/AmbientLayer.tsx). */
export type ParticleShape = 'petal' | 'maple' | 'leaf' | 'snow' | 'star' | 'glow' | 'sprig' | 'lemon' | 'drop' | 'puff' | 'lantern' | 'flower' | 'confetti' | 'tile' | 'balloon' | 'clover';
/** fall: drifts down with a sway; rise: floats up (lanterns, balloons); twinkle: stays put and glimmers. */
export type ParticleMotion = 'fall' | 'rise' | 'twinkle';

export const PARTICLES = {
  sakura: { shapes: ['petal'], motion: 'fall', paints: ['#F9C9D8', '#F4B3C8', '#FFE1EA'] },
  maple: { shapes: ['maple'], motion: 'fall', paints: ['#E8603A', '#F2952F', '#D9432F'] },
  snow: { shapes: ['snow'], motion: 'fall', paints: ['#FFFFFF', '#EAF3FF'] },
  firefly: { shapes: ['glow'], motion: 'twinkle', paints: ['#FFF2A8', '#EAFFA0'] },
  stars: { shapes: ['star'], motion: 'twinkle', paints: ['#FFF6D6', '#FFFFFF', '#FFE9A8'] },
  lavender: { shapes: ['sprig'], motion: 'fall', paints: ['#C7B2F0', '#A991E0'] },
  lemon: { shapes: ['lemon', 'leaf'], motion: 'fall', paints: ['#FFE066', '#9BD07A'] },
  rain: { shapes: ['drop'], motion: 'fall', paints: ['#DCEBFA', '#C6DDF5'] },
  wattle: { shapes: ['puff'], motion: 'fall', paints: ['#FFD84D', '#FFE680'] },
  gumleaf: { shapes: ['leaf'], motion: 'fall', paints: ['#B7D3AE', '#9CC4A8'] },
  lantern: { shapes: ['lantern'], motion: 'rise', paints: ['#FFB45C', '#FFCF7A', '#FF9466'] },
  frangipani: { shapes: ['flower'], motion: 'fall', paints: ['#FFF8EC', '#FFE7A8'] },
  confetti: { shapes: ['confetti'], motion: 'fall', paints: ['#FF7EA0', '#FFC75F', '#5FD0F7', '#A6E77F', '#CB95EE'] },
  orangeblossom: { shapes: ['flower', 'leaf'], motion: 'fall', paints: ['#FFFFFF', '#A9D48A'] },
  olive: { shapes: ['leaf'], motion: 'fall', paints: ['#C3D6A2', '#A9C28E'] },
  tile: { shapes: ['tile'], motion: 'fall', paints: ['#8EC0F0', '#FFFFFF'] },
  balloon: { shapes: ['balloon'], motion: 'rise', paints: ['#FF9A76', '#FFD966', '#7FD3F7'] },
  shamrock: { shapes: ['clover'], motion: 'fall', paints: ['#8FD48F', '#B4E39A'] },
  tulip: { shapes: ['petal'], motion: 'fall', paints: ['#FF7A7A', '#FFB45C', '#FFE066'] },
  goldleaf: { shapes: ['leaf'], motion: 'fall', paints: ['#F6C453', '#EE9A3A'] },
  marigold: { shapes: ['flower'], motion: 'fall', paints: ['#FFB13B', '#FFD24D'] },
  orchid: { shapes: ['petal'], motion: 'fall', paints: ['#EAB2EC', '#F7CDEF'] },
  hibiscus: { shapes: ['flower'], motion: 'fall', paints: ['#FF8A98', '#FFC0C6'] },
  edelweiss: { shapes: ['flower'], motion: 'fall', paints: ['#FFFFFF', '#F2F6EA'] },
} as const satisfies Record<string, { shapes: readonly ParticleShape[]; motion: ParticleMotion; paints: readonly string[] }>;
export type ParticleKind = keyof typeof PARTICLES;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** north / south: the usual meteorological seasons for that hemisphere; tropical: one particle all year. */
export type Hemisphere = 'north' | 'south' | 'tropical';

export type CountryThemeSpec = {
  /** ISO 3166-1 alpha-2, capitals. */
  iso2: string;
  /** Accent hue (0-360) and saturation (0-1); the lightness is walked per theme for contrast. */
  accent: { h: number; s: number };
  /** Hue pairs [deep stop, bright stop] for the themed hero tones (lightness walked per theme). */
  hero: { trips: readonly [number, number]; map: readonly [number, number]; wallet: readonly [number, number]; s: number };
  motif: MotifId;
  /** Two decorative paints for the motif (a highlight and a soft second colour), drawn at low opacity. */
  paints: readonly [string, string];
  hemisphere: Hemisphere;
  /** The particle for each season; `all` covers any season not listed. */
  particles: Partial<Record<Season, ParticleKind>> & { all: ParticleKind };
};

const spec = (
  iso2: string,
  accent: [number, number],
  hero: [[number, number], [number, number], [number, number], number],
  motif: MotifId,
  paints: [string, string],
  hemisphere: Hemisphere,
  particles: CountryThemeSpec['particles'],
): CountryThemeSpec => ({ iso2, accent: { h: accent[0], s: accent[1] }, hero: { trips: hero[0], map: hero[1], wallet: hero[2], s: hero[3] }, motif, paints, hemisphere, particles });

// Accent hues keep at least 28 degrees from the map's plan (violet, ~267) and way-back (magenta, ~330) pins, so a
// themed accent never blurs into those layers (src/theme/contrast.test.ts checks the gap).
export const COUNTRY_THEMES: Readonly<Record<string, CountryThemeSpec>> = {
  // Japan: vermilion torii accent, plum-to-sakura banner; blossoms in spring, fireflies in summer, maple in autumn, snow in winter.
  JP: spec('JP', [8, 0.7], [[318, 342], [232, 196], [352, 14], 0.5], 'fuji', ['#F9C9D8', '#FFFFFF'], 'north', { spring: 'sakura', summer: 'firefly', autumn: 'maple', winter: 'snow', all: 'sakura' }),
  KR: spec('KR', [182, 0.55], [[226, 200], [190, 168], [350, 20], 0.5], 'hanok', ['#F7C6D6', '#CFE8E2'], 'north', { spring: 'sakura', summer: 'firefly', autumn: 'maple', winter: 'snow', all: 'sakura' }),
  CA: spec('CA', [0, 0.68], [[214, 196], [200, 160], [356, 12], 0.5], 'pines', ['#F2643C', '#FFFFFF'], 'north', { winter: 'snow', all: 'maple' }),
  FR: spec('FR', [232, 0.55], [[246, 270], [226, 200], [262, 300], 0.42], 'eiffel', ['#CDB8F2', '#FFFFFF'], 'north', { all: 'lavender' }),
  IT: spec('IT', [140, 0.5], [[200, 168], [196, 150], [24, 44], 0.5], 'arches', ['#FFE066', '#F3D9B5'], 'north', { all: 'lemon' }),
  GB: spec('GB', [150, 0.55], [[222, 206], [210, 168], [356, 10], 0.45], 'clocktower', ['#DCEBFA', '#FFFFFF'], 'north', { all: 'rain' }),
  US: spec('US', [218, 0.6], [[226, 210], [210, 186], [356, 12], 0.55], 'skyline', ['#FFE9A8', '#FFFFFF'], 'north', { all: 'stars' }),
  AU: spec('AU', [36, 0.65], [[204, 190], [188, 160], [28, 44], 0.55], 'sails', ['#FFD84D', '#FFFFFF'], 'south', { spring: 'wattle', all: 'gumleaf' }),
  NZ: spec('NZ', [160, 0.55], [[222, 190], [190, 160], [150, 120], 0.5], 'fern', ['#B8E3B0', '#FFF6D6'], 'south', { all: 'stars' }),
  TH: spec('TH', [48, 0.7], [[256, 300], [210, 180], [30, 46], 0.5], 'spire', ['#FFCF7A', '#FFFFFF'], 'tropical', { all: 'lantern' }),
  ID: spec('ID', [150, 0.55], [[190, 160], [180, 150], [20, 36], 0.55], 'splitgate', ['#FFF1C9', '#FFFFFF'], 'tropical', { all: 'frangipani' }),
  MX: spec('MX', [190, 0.6], [[318, 340], [190, 168], [14, 34], 0.55], 'picado', ['#FF7EA0', '#FFC75F'], 'tropical', { all: 'confetti' }),
  ES: spec('ES', [4, 0.66], [[350, 14], [204, 190], [24, 40], 0.55], 'fan', ['#FFB347', '#FFFFFF'], 'north', { all: 'orangeblossom' }),
  GR: spec('GR', [205, 0.65], [[214, 200], [200, 180], [96, 60], 0.5], 'dome', ['#7FB8F0', '#FFFFFF'], 'north', { all: 'olive' }),
  VN: spec('VN', [140, 0.5], [[352, 10], [170, 140], [36, 48], 0.5], 'conehat', ['#FFCF7A', '#F3E2B8'], 'tropical', { all: 'lantern' }),
  PT: spec('PT', [212, 0.6], [[216, 200], [200, 184], [40, 30], 0.55], 'tram', ['#FFD24D', '#8EC0F0'], 'north', { all: 'tile' }),
  DE: spec('DE', [45, 0.7], [[220, 200], [180, 150], [8, 32], 0.4], 'gate', ['#F6C453', '#FFFFFF'], 'north', { winter: 'snow', all: 'goldleaf' }),
  IE: spec('IE', [135, 0.5], [[160, 130], [190, 150], [30, 44], 0.5], 'castle', ['#B4E39A', '#FFFFFF'], 'north', { all: 'shamrock' }),
  NL: spec('NL', [26, 0.75], [[214, 200], [196, 170], [12, 30], 0.55], 'windmill', ['#FF9F5C', '#FFFFFF'], 'north', { all: 'tulip' }),
  CH: spec('CH', [0, 0.68], [[214, 200], [190, 160], [356, 12], 0.5], 'peak', ['#FFFFFF', '#F2F6EA'], 'north', { winter: 'snow', all: 'edelweiss' }),
  IN: spec('IN', [30, 0.75], [[330, 350], [200, 176], [22, 40], 0.5], 'taj', ['#FFB13B', '#FFFFFF'], 'tropical', { all: 'marigold' }),
  SG: spec('SG', [170, 0.6], [[226, 200], [190, 160], [300, 330], 0.5], 'supertree', ['#EAB2EC', '#B8F0D8'], 'tropical', { all: 'orchid' }),
  FJ: spec('FJ', [188, 0.65], [[204, 186], [186, 168], [10, 30], 0.6], 'palm', ['#FF8A98', '#FFF1C9'], 'tropical', { all: 'hibiscus' }),
  IS: spec('IS', [195, 0.55], [[232, 200], [180, 150], [216, 190], 0.5], 'aurora', ['#9EF2C8', '#C7B2F0'], 'north', { all: 'stars' }),
  TR: spec('TR', [182, 0.6], [[226, 204], [190, 172], [16, 32], 0.55], 'balloons', ['#FF9A76', '#FFD966'], 'north', { all: 'balloon' }),
};

/** The theme for a country, or null for the default look. Accepts any case. */
export const countryThemeSpec = (iso2: string | null | undefined): CountryThemeSpec | null => (iso2 ? (COUNTRY_THEMES[iso2.toUpperCase()] ?? null) : null);

/** The season of a month (1-12) in a hemisphere; tropical places have no seasons here (null). */
export function seasonOf(month: number, hemisphere: Hemisphere): Season | null {
  if (hemisphere === 'tropical') return null;
  const m = ((((Math.round(month) - 1) % 12) + 12) % 12) + 1;
  const shifted = hemisphere === 'south' ? ((m + 5) % 12) + 1 : m;
  if (shifted >= 3 && shifted <= 5) return 'spring';
  if (shifted >= 6 && shifted <= 8) return 'summer';
  if (shifted >= 9 && shifted <= 11) return 'autumn';
  return 'winter';
}

/** Which particle drifts for a country in a month (1-12). */
export function particleFor(spec: CountryThemeSpec, month: number): ParticleKind {
  const season = seasonOf(month, spec.hemisphere);
  return (season && spec.particles[season]) || spec.particles.all;
}

/** The trip that themes the app: the focus trip, if it is on now or starts within THEME_LEAD_DAYS. */
function themingTrip(trips: Trip[], today: LocalDate): Trip | null {
  const trip = focusTrip(trips, today);
  if (!trip) return null;
  const phase = tripPhase(trip, today);
  if (phase === 'past') return null;
  if (phase === 'upcoming' && daysBetween(today, trip.startDate) > THEME_LEAD_DAYS) return null;
  return trip;
}

/** The ISO country a trip is mostly in (its destination zone), whatever its dates; null when none or unknown. */
export const tripCountry = (trip: Trip): string | null => countryForZone(destinationZone(trip));

/**
 * The country that themes the app today: the destination of focusTrip(trips, today) when that trip is on now or
 * starts within THEME_LEAD_DAYS days, and only if the country has a theme. Else null (the default look).
 */
export function themeCountry(trips: Trip[], today: LocalDate): string | null {
  const trip = themingTrip(trips, today);
  const iso2 = trip ? tripCountry(trip) : null;
  return iso2 && COUNTRY_THEMES[iso2] ? iso2 : null;
}

export type CountryPick = { spec: CountryThemeSpec; particle: ParticleKind; month: number };

const monthOf = (d: LocalDate) => Number(d.slice(5, 7));

/**
 * The full pick for today: the country's spec and the particle for the month you'll be there (today's month during
 * the trip, the start month before it).
 */
export function themePick(trips: Trip[], today: LocalDate): CountryPick | null {
  const trip = themingTrip(trips, today);
  const spec = trip ? countryThemeSpec(tripCountry(trip)) : null;
  if (!trip || !spec) return null;
  const month = monthOf(tripPhase(trip, today) === 'active' ? today : trip.startDate);
  return { spec, particle: particleFor(spec, month), month };
}

/** The pick for one trip's own screens (trip detail), whatever its dates: its country and the month it starts. */
export function tripPick(trip: Trip): CountryPick | null {
  const spec = countryThemeSpec(tripCountry(trip));
  if (!spec) return null;
  const month = monthOf(trip.startDate);
  return { spec, particle: particleFor(spec, month), month };
}
