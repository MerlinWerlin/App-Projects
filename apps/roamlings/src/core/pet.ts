// A pet = species + rolled parts + colourway + traits, all derived from its seed.

import { makeRng, pick, pickWeighted } from './rng.ts';
import {
  type Branch,
  type Palette,
  type PartMod,
  type PartSet,
  type Rarity,
  getSpecies,
  speciesForRegion,
} from './species.ts';

export type Trait = 'sleepy' | 'bold' | 'curious' | 'gentle' | 'cheeky' | 'proud' | 'shy' | 'bouncy';
export const TRAITS: readonly Trait[] = ['sleepy', 'bold', 'curious', 'gentle', 'cheeky', 'proud', 'shy', 'bouncy'];

export type Stage = 0 | 1 | 2; // Baby, Young, Grown

export interface Pet {
  id: string;
  seed: number;
  speciesId: string;
  rarity: Rarity;
  paletteId: string;
  mod: PartMod | null;
  trait: Trait;
  /** Where it hatched (region id), for the journal and later the World Dex. */
  region: string;
  hatchedAt: number;
  nickname: string | null;
  stage: Stage;
  /** Total growth XP. */
  xp: number;
  /** XP by activity kind; the largest decides the Grown form. */
  branchXp: Record<Branch, number>;
  /** Set when the pet reaches Grown. */
  branch: Branch | null;
}

/** Base odds per hatch (percent). Tuned in testing. */
export const RARITY_ODDS: Readonly<Record<Rarity, number>> = {
  common: 70,
  uncommon: 22,
  rare: 6.9,
  shimmer: 1,
  mythic: 0.1,
};

/** At least a Rare is guaranteed once this many hatches in a row gave nothing Rare or better. */
export const PITY_LIMIT = 30;

export function rollRarity(rng: () => number, pity: number): Rarity {
  if (pity >= PITY_LIMIT - 1) {
    // Guaranteed Rare-or-better: renormalise over the top three tiers.
    return pickWeighted(rng, [
      { item: 'rare' as Rarity, weight: RARITY_ODDS.rare },
      { item: 'shimmer' as Rarity, weight: RARITY_ODDS.shimmer },
      { item: 'mythic' as Rarity, weight: RARITY_ODDS.mythic },
    ]);
  }
  return pickWeighted(
    rng,
    (Object.keys(RARITY_ODDS) as Rarity[]).map((r) => ({ item: r, weight: RARITY_ODDS[r] })),
  );
}

export function isRareOrBetter(r: Rarity): boolean {
  return r === 'rare' || r === 'shimmer' || r === 'mythic';
}

export interface HatchInput {
  seed: number;
  region: string;
  pity: number;
  now: number;
  id: string;
}

export function hatchPet(input: HatchInput): Pet {
  const rng = makeRng(input.seed);
  const species = pick(rng, speciesForRegion(input.region));
  const rarity = rollRarity(rng, input.pity);
  let palette: Palette;
  let mod: PartMod | null = null;
  switch (rarity) {
    case 'common':
      palette = species.palettes.common;
      break;
    case 'uncommon':
      palette = species.palettes.uncommon;
      break;
    case 'rare':
      // Rare = rare colourway, or the common colourway with one modified part.
      if (rng() < 0.5) {
        palette = species.palettes.rare;
      } else {
        palette = species.palettes.common;
        mod = pick(rng, species.mods);
      }
      break;
    case 'shimmer':
      palette = species.palettes.shimmer;
      break;
    case 'mythic':
      palette = species.palettes.shimmer;
      mod = pick(rng, species.mods);
      break;
  }
  return {
    id: input.id,
    seed: input.seed,
    speciesId: species.id,
    rarity,
    paletteId: palette.id,
    mod,
    trait: pick(rng, TRAITS),
    region: input.region,
    hatchedAt: input.now,
    nickname: null,
    stage: 0,
    xp: 0,
    branchXp: { swift: 0, scholarly: 0, cozy: 0 },
    branch: null,
  };
}

/** The parts a pet actually shows (species defaults with its mod applied). */
export function petParts(pet: Pet): PartSet {
  const base = { ...getSpecies(pet.speciesId).parts };
  if (pet.mod) (base as Record<string, string>)[pet.mod.slot] = pet.mod.value as string;
  return base;
}

export function petPalette(pet: Pet): Palette {
  const s = getSpecies(pet.speciesId);
  const all = [s.palettes.common, s.palettes.uncommon, s.palettes.rare, s.palettes.shimmer];
  return all.find((x) => x.id === pet.paletteId) ?? s.palettes.common;
}

/** Key for the Dex: one entry per species + colourway + mod combination. */
export function variantKey(pet: Pick<Pet, 'speciesId' | 'paletteId' | 'mod'>): string {
  return `${pet.speciesId}|${pet.paletteId}|${pet.mod ? `${pet.mod.slot}:${pet.mod.value}` : '-'}`;
}

/** Every variant a species can come in (for Dex completion). */
export function allVariantKeys(speciesId: string): string[] {
  const s = getSpecies(speciesId);
  const keys = [s.palettes.common, s.palettes.uncommon, s.palettes.rare, s.palettes.shimmer].map((pal) =>
    variantKey({ speciesId, paletteId: pal.id, mod: null }),
  );
  for (const m of s.mods) {
    keys.push(variantKey({ speciesId, paletteId: s.palettes.common.id, mod: m }));
    keys.push(variantKey({ speciesId, paletteId: s.palettes.shimmer.id, mod: m }));
  }
  return keys;
}
