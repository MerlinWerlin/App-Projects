// The species catalogue. Each species is a body shape plus part slots and colourways.
// Variety comes from combinations, so new collectibles need data, not new art files.
// All designs are original (no resemblance to existing franchises).

export type Element = 'leaf' | 'tide' | 'ember' | 'stone' | 'spark' | 'dream';
export type BodyShape = 'round' | 'bean' | 'drop' | 'pear';
export type Ears = 'none' | 'pointy' | 'round' | 'long' | 'droopy' | 'leaf' | 'fin';
export type Tail = 'none' | 'fluffy' | 'curl' | 'fin' | 'flame' | 'stub';
export type Marking = 'none' | 'belly' | 'spots' | 'stripes' | 'mask' | 'stars';
export type Topper = 'none' | 'sprout' | 'antenna' | 'horn' | 'crest' | 'tuft' | 'bubble';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'shimmer' | 'mythic';
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'shimmer', 'mythic'];

/** Body, belly/marking, accent (ears, tail tips, topper), eye/line colour. Hex strings. */
export interface Palette {
  id: string;
  body: string;
  belly: string;
  accent: string;
  line: string;
}

export interface PartSet {
  ears: Ears;
  tail: Tail;
  marking: Marking;
  topper: Topper;
}

/** A "slight modification": one slot swapped for a rarer shape. */
export interface PartMod {
  slot: keyof PartSet;
  value: PartSet[keyof PartSet];
}

export type Branch = 'swift' | 'scholarly' | 'cozy';
export const BRANCHES: readonly Branch[] = ['swift', 'scholarly', 'cozy'];

export interface Species {
  id: string;
  /** i18n key prefix: species.<id>.name / species.<id>.blurb */
  element: Element;
  body: BodyShape;
  parts: PartSet;
  mods: readonly PartMod[];
  palettes: {
    common: Palette;
    uncommon: Palette;
    rare: Palette;
    shimmer: Palette;
  };
  /** Regions where this species can hatch. Empty = everywhere. */
  regions: readonly string[];
}

const p = (id: string, body: string, belly: string, accent: string, line = '#2B2233'): Palette => ({ id, body, belly, accent, line });

export const SPECIES: readonly Species[] = [
  {
    id: 'mossbun', element: 'leaf', body: 'round',
    parts: { ears: 'long', tail: 'fluffy', marking: 'belly', topper: 'sprout' },
    mods: [{ slot: 'topper', value: 'crest' }, { slot: 'ears', value: 'leaf' }],
    palettes: {
      common: p('mossbun-c', '#8CC47A', '#E8F3D6', '#4F8F3E'),
      uncommon: p('mossbun-u', '#C9D86A', '#F6F4D8', '#7E8F2C'),
      rare: p('mossbun-r', '#E7A6C1', '#FBE9F1', '#B4577E'),
      shimmer: p('mossbun-s', '#F2E3A0', '#FFFBEA', '#D4A21E'),
    },
    regions: [],
  },
  {
    id: 'tidepip', element: 'tide', body: 'drop',
    parts: { ears: 'fin', tail: 'fin', marking: 'spots', topper: 'none' },
    mods: [{ slot: 'topper', value: 'bubble' }, { slot: 'marking', value: 'stripes' }],
    palettes: {
      common: p('tidepip-c', '#6EC3E0', '#DDF3FA', '#2F86A8'),
      uncommon: p('tidepip-u', '#7ED9C2', '#E3F8F2', '#2E9C83'),
      rare: p('tidepip-r', '#B39CE8', '#EEE8FB', '#6E52C2'),
      shimmer: p('tidepip-s', '#F4C4D8', '#FFF1F6', '#E07AA6'),
    },
    regions: [],
  },
  {
    id: 'embercub', element: 'ember', body: 'round',
    parts: { ears: 'pointy', tail: 'flame', marking: 'belly', topper: 'tuft' },
    mods: [{ slot: 'topper', value: 'horn' }, { slot: 'marking', value: 'mask' }],
    palettes: {
      common: p('embercub-c', '#F29A5B', '#FCE6D2', '#D4552A'),
      uncommon: p('embercub-u', '#F2C14E', '#FDF1CF', '#C9861A'),
      rare: p('embercub-r', '#5B6BD9', '#E0E4FA', '#2E3BA8'),
      shimmer: p('embercub-s', '#F5F5F5', '#FFFFFF', '#E8513A'),
    },
    regions: [],
  },
  {
    id: 'pebblet', element: 'stone', body: 'bean',
    parts: { ears: 'round', tail: 'stub', marking: 'spots', topper: 'none' },
    mods: [{ slot: 'topper', value: 'horn' }, { slot: 'marking', value: 'stripes' }],
    palettes: {
      common: p('pebblet-c', '#A9A39A', '#E9E5DE', '#6E675D'),
      uncommon: p('pebblet-u', '#C2A58A', '#F1E7DC', '#8A6A4E'),
      rare: p('pebblet-r', '#7FB5A6', '#E2F1EC', '#3F7E6D'),
      shimmer: p('pebblet-s', '#D9C7F0', '#F7F1FF', '#8F6CC9'),
    },
    regions: [],
  },
  {
    id: 'zapling', element: 'spark', body: 'pear',
    parts: { ears: 'pointy', tail: 'curl', marking: 'stripes', topper: 'antenna' },
    mods: [{ slot: 'ears', value: 'long' }, { slot: 'topper', value: 'crest' }],
    palettes: {
      common: p('zapling-c', '#F6D85A', '#FFF6CF', '#C99A12'),
      uncommon: p('zapling-u', '#9ED36A', '#EDF8DD', '#5E9A2A'),
      rare: p('zapling-r', '#F08AB0', '#FDE8F0', '#C2416F'),
      shimmer: p('zapling-s', '#8FE3F0', '#E9FBFE', '#2BA9C2'),
    },
    regions: [],
  },
  {
    id: 'snoozle', element: 'dream', body: 'round',
    parts: { ears: 'droopy', tail: 'fluffy', marking: 'mask', topper: 'none' },
    mods: [{ slot: 'marking', value: 'stars' }, { slot: 'topper', value: 'tuft' }],
    palettes: {
      common: p('snoozle-c', '#A8A3E3', '#ECEAFB', '#6A63C2'),
      uncommon: p('snoozle-u', '#E3B3D8', '#FAEDF6', '#B06AA0'),
      rare: p('snoozle-r', '#7CC8C0', '#E4F6F3', '#3A8F86'),
      shimmer: p('snoozle-s', '#2F3561', '#5B638F', '#F2D46B', '#F7F3E3'),
    },
    regions: [],
  },
  {
    id: 'fernkit', element: 'leaf', body: 'pear',
    parts: { ears: 'pointy', tail: 'curl', marking: 'belly', topper: 'crest' },
    mods: [{ slot: 'ears', value: 'leaf' }, { slot: 'marking', value: 'spots' }],
    palettes: {
      common: p('fernkit-c', '#5FAF7E', '#DDF0E3', '#2E7A4C'),
      uncommon: p('fernkit-u', '#D9A55B', '#F7EBD8', '#9A6A22'),
      rare: p('fernkit-r', '#6F8FD8', '#E3EAFA', '#3555A8'),
      shimmer: p('fernkit-s', '#F3EFE6', '#FFFFFF', '#5FAF7E'),
    },
    regions: [],
  },
  {
    id: 'bubbloo', element: 'tide', body: 'round',
    parts: { ears: 'none', tail: 'fin', marking: 'belly', topper: 'bubble' },
    mods: [{ slot: 'ears', value: 'fin' }, { slot: 'marking', value: 'spots' }],
    palettes: {
      common: p('bubbloo-c', '#8FB8F0', '#E6EFFC', '#4A79C2'),
      uncommon: p('bubbloo-u', '#F0A58F', '#FCEAE4', '#C2614A'),
      rare: p('bubbloo-r', '#9CE0A6', '#E8F8EA', '#3E9A4E'),
      shimmer: p('bubbloo-s', '#F7E07A', '#FFF8DA', '#3E7FC9'),
    },
    regions: [],
  },
  {
    id: 'cinderwing', element: 'ember', body: 'bean',
    parts: { ears: 'leaf', tail: 'flame', marking: 'stripes', topper: 'antenna' },
    mods: [{ slot: 'topper', value: 'crest' }, { slot: 'tail', value: 'fluffy' }],
    palettes: {
      common: p('cinderwing-c', '#E0745A', '#F9DFD7', '#9E3B27'),
      uncommon: p('cinderwing-u', '#C98AD9', '#F3E5F7', '#8A4A9A'),
      rare: p('cinderwing-r', '#5FC1B0', '#E0F5F1', '#2A8576'),
      shimmer: p('cinderwing-s', '#FFE3A3', '#FFF7E2', '#F0703A'),
    },
    regions: [],
  },
  {
    id: 'crumblet', element: 'stone', body: 'round',
    parts: { ears: 'round', tail: 'stub', marking: 'mask', topper: 'horn' },
    mods: [{ slot: 'topper', value: 'sprout' }, { slot: 'marking', value: 'spots' }],
    palettes: {
      common: p('crumblet-c', '#B9876A', '#F2E2D8', '#7A5038'),
      uncommon: p('crumblet-u', '#8E9AA8', '#E5E9EE', '#55616F'),
      rare: p('crumblet-r', '#E6B85C', '#FBF0D6', '#A97C1A'),
      shimmer: p('crumblet-s', '#BFE3F7', '#F0FAFF', '#4A95C2'),
    },
    regions: [],
  },
  {
    id: 'glimmouse', element: 'spark', body: 'bean',
    parts: { ears: 'round', tail: 'curl', marking: 'belly', topper: 'tuft' },
    mods: [{ slot: 'topper', value: 'antenna' }, { slot: 'marking', value: 'stars' }],
    palettes: {
      common: p('glimmouse-c', '#F3C9A2', '#FDF1E6', '#C98A55'),
      uncommon: p('glimmouse-u', '#B6D6F2', '#EEF6FD', '#5A8FC2'),
      rare: p('glimmouse-r', '#F2A2A2', '#FDE8E8', '#C24A4A'),
      shimmer: p('glimmouse-s', '#3B3B4F', '#6A6A85', '#FFD84D', '#F5F2E8'),
    },
    regions: [],
  },
  {
    id: 'dozeling', element: 'dream', body: 'drop',
    parts: { ears: 'long', tail: 'fluffy', marking: 'stars', topper: 'crest' },
    mods: [{ slot: 'ears', value: 'droopy' }, { slot: 'topper', value: 'bubble' }],
    palettes: {
      common: p('dozeling-c', '#7A8FD9', '#E3E8FA', '#3B4FA8'),
      uncommon: p('dozeling-u', '#D98FB8', '#F8E6F0', '#A04A78'),
      rare: p('dozeling-r', '#E8D27A', '#FBF5DD', '#A8901F'),
      shimmer: p('dozeling-s', '#1F2A44', '#3D4B70', '#9FE7F5', '#EAF6FA'),
    },
    regions: [],
  },
];

export const SPECIES_BY_ID: Readonly<Record<string, Species>> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): Species {
  const s = SPECIES_BY_ID[id];
  if (!s) throw new Error(`unknown species ${id}`);
  return s;
}

/** Species that can hatch in a region (global ones always can). */
export function speciesForRegion(region: string): Species[] {
  return SPECIES.filter((s) => s.regions.length === 0 || s.regions.includes(region));
}
