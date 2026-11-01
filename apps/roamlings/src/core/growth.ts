// Growth, care and Spark. Pure functions; times are epoch milliseconds.

import type { Pet, Stage } from './pet.ts';
import { BRANCHES, type Branch } from './species.ts';

// ---------- Spark (the one activity currency) ----------

/** Spark per 100 steps. */
export const SPARK_PER_100_STEPS = 1;
/** Spark per full 25-minute focus session. */
export const SPARK_PER_FOCUS = 10;
/** Spark for a care action (feed / pet / play), at most CARE_SPARK_CAP a day. */
export const SPARK_PER_CARE = 2;
export const CARE_SPARK_CAP = 12;
/** Daily Spark cap across all sources, so grinding can't flood the collection. */
export const DAILY_SPARK_CAP = 300;
/** Spark needed to fill one egg. */
export const EGG_COST = 100;

export function sparkFromSteps(steps: number): number {
  return Math.floor(Math.max(0, steps) / 100) * SPARK_PER_100_STEPS;
}

/** Clamp a Spark gain so the day's total never passes the cap. Returns the amount actually granted. */
export function grantSpark(sparkToday: number, gain: number): number {
  return Math.max(0, Math.min(gain, DAILY_SPARK_CAP - sparkToday));
}

// ---------- Growth ----------

/** Total XP needed to reach Young and Grown. About 1 week and 3 more weeks of normal use. */
export const STAGE_XP: readonly [number, number] = [400, 1600];

export function stageForXp(xp: number): Stage {
  if (xp >= STAGE_XP[1]) return 2;
  if (xp >= STAGE_XP[0]) return 1;
  return 0;
}

/** Happiness 70+ gives up to +25% growth. */
export function growthBonus(happiness: number): number {
  if (happiness >= 90) return 1.25;
  if (happiness >= 70) return 1.15;
  if (happiness >= 40) return 1;
  return 0.75; // a sleepy pet grows slower, never shrinks or leaves
}

/** The branch with the most XP; ties go to the order swift, scholarly, cozy. */
export function leadingBranch(branchXp: Record<Branch, number>): Branch {
  let best: Branch = BRANCHES[0]!;
  for (const b of BRANCHES) if (branchXp[b] > branchXp[best]) best = b;
  return best;
}

export interface GrowResult {
  pet: Pet;
  /** True when this XP pushed the pet into a new stage. */
  evolved: boolean;
}

/** Give a pet XP from an activity. Returns a new pet object. */
export function addXp(pet: Pet, branch: Branch, amount: number, happiness: number): GrowResult {
  const gained = Math.round(Math.max(0, amount) * growthBonus(happiness));
  if (gained === 0) return { pet, evolved: false };
  const branchXp = { ...pet.branchXp, [branch]: pet.branchXp[branch] + gained };
  const xp = pet.xp + gained;
  const stage = stageForXp(xp);
  const evolved = stage > pet.stage;
  const next: Pet = { ...pet, xp, branchXp, stage };
  if (stage === 2 && pet.branch === null) next.branch = leadingBranch(branchXp);
  return { pet: next, evolved };
}

/** 0..1 progress through the current stage (1 when Grown). */
export function stageProgress(pet: Pet): number {
  if (pet.stage === 2) return 1;
  const lo = pet.stage === 0 ? 0 : STAGE_XP[0];
  const hi = STAGE_XP[pet.stage];
  return Math.max(0, Math.min(1, (pet.xp - lo) / (hi - lo)));
}

// ---------- Care ----------

/** Happiness falls 4 points an hour, never below 10 (a pet only gets sleepy). */
export const HAPPINESS_DECAY_PER_HOUR = 4;
export const HAPPINESS_FLOOR = 10;
export type CareAction = 'feed' | 'pet' | 'play';
export const CARE_GAIN: Readonly<Record<CareAction, number>> = { feed: 25, pet: 10, play: 18 };
/** Minimum gap between two of the same care action. */
export const CARE_COOLDOWN_MS: Readonly<Record<CareAction, number>> = {
  feed: 3 * 3600_000,
  pet: 60_000,
  play: 30 * 60_000,
};

export function decayedHappiness(happiness: number, lastUpdated: number, now: number): number {
  const hours = Math.max(0, now - lastUpdated) / 3600_000;
  return Math.max(HAPPINESS_FLOOR, Math.min(100, happiness - hours * HAPPINESS_DECAY_PER_HOUR));
}

export type Mood = 'joyful' | 'happy' | 'okay' | 'sleepy';
export function moodFor(happiness: number): Mood {
  if (happiness >= 85) return 'joyful';
  if (happiness >= 60) return 'happy';
  if (happiness >= 35) return 'okay';
  return 'sleepy';
}
