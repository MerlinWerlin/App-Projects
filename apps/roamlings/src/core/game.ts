// The whole local game state and every action on it, as pure functions.
// Phase 1 is local-only; phase 2 moves hatch rolls and the pet ledger to a server.

import {
  CARE_COOLDOWN_MS,
  CARE_GAIN,
  CARE_SPARK_CAP,
  type CareAction,
  EGG_COST,
  SPARK_PER_CARE,
  SPARK_PER_FOCUS,
  addXp,
  decayedHappiness,
  grantSpark,
  sparkFromSteps,
} from './growth.ts';
import { type Pet, hatchPet, isRareOrBetter, variantKey } from './pet.ts';
import type { RegionId } from './region.ts';
import { newSeed } from './rng.ts';
import type { Branch } from './species.ts';

export const MAX_EGGS_WAITING = 3;
/** Steps per point of Swift XP. */
export const STEPS_PER_XP = 40;
export const FOCUS_MINUTES = 25;
export const FOCUS_XP = 60;
export const CARE_XP = 8;

export interface GameState {
  version: 1;
  pets: Pet[];
  buddyId: string | null;
  /** Spark toward the next egg, 0..EGG_COST-1. */
  eggSpark: number;
  eggsReady: number;
  pity: number;
  counter: number;
  /** Variant keys ever hatched or owned. */
  dex: string[];
  /** Local calendar day the daily counters belong to, YYYY-MM-DD. */
  day: string;
  sparkToday: number;
  careSparkToday: number;
  /** Steps already turned into Spark today. */
  stepsCounted: number;
  happiness: number;
  happinessAt: number;
  lastCare: Record<CareAction, number>;
  region: RegionId;
  streak: { count: number; lastDay: string | null };
  totals: { steps: number; focus: number; hatches: number; care: number };
}

export type GameEvent =
  | { kind: 'spark'; amount: number; capped: boolean }
  | { kind: 'egg'; count: number }
  | { kind: 'evolved'; petId: string }
  | { kind: 'hatched'; petId: string; newVariant: boolean }
  | { kind: 'cooldown'; action: CareAction; readyAt: number };

export interface Result {
  state: GameState;
  events: GameEvent[];
}

export function newGame(now: number, day: string, region: RegionId): GameState {
  return {
    version: 1,
    pets: [],
    buddyId: null,
    eggSpark: 0,
    eggsReady: 1, // a starter egg on first launch
    pity: 0,
    counter: 0,
    dex: [],
    day,
    sparkToday: 0,
    careSparkToday: 0,
    stepsCounted: 0,
    happiness: 80,
    happinessAt: now,
    lastCare: { feed: 0, pet: 0, play: 0 },
    region,
    streak: { count: 0, lastDay: null },
    totals: { steps: 0, focus: 0, hatches: 0, care: 0 },
  };
}

/** Local YYYY-MM-DD for a Date (phone's own time zone). */
export function localDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** Start a new day's counters if the calendar day changed. Also brings happiness up to date. */
export function tick(s: GameState, now: number, day: string): GameState {
  let next = s;
  if (s.day !== day) {
    next = { ...next, day, sparkToday: 0, careSparkToday: 0, stepsCounted: 0 };
  }
  // Bring happiness up to date at most once a minute, so frequent ticks return the same object
  // (screens re-render only when something really changed).
  if (now - next.happinessAt >= 60_000) {
    next = { ...next, happiness: decayedHappiness(next.happiness, next.happinessAt, now), happinessAt: now };
  }
  return next;
}

export function buddy(s: GameState): Pet | null {
  return s.pets.find((p) => p.id === s.buddyId) ?? null;
}

function addSpark(s: GameState, gain: number, events: GameEvent[]): GameState {
  const granted = grantSpark(s.sparkToday, gain);
  if (gain > 0) events.push({ kind: 'spark', amount: granted, capped: granted < gain });
  if (granted === 0) return s;
  let eggSpark = s.eggSpark + granted;
  let eggsReady = s.eggsReady;
  let earned = 0;
  while (eggSpark >= EGG_COST && eggsReady < MAX_EGGS_WAITING) {
    eggSpark -= EGG_COST;
    eggsReady += 1;
    earned += 1;
  }
  if (eggsReady >= MAX_EGGS_WAITING) eggSpark = Math.min(eggSpark, EGG_COST - 1);
  if (earned > 0) events.push({ kind: 'egg', count: earned });
  return { ...s, eggSpark, eggsReady, sparkToday: s.sparkToday + granted };
}

function growBuddy(s: GameState, branch: Branch, xp: number, events: GameEvent[]): GameState {
  const b = buddy(s);
  if (!b || xp <= 0) return s;
  const r = addXp(b, branch, xp, s.happiness);
  if (r.evolved) events.push({ kind: 'evolved', petId: b.id });
  return { ...s, pets: s.pets.map((p) => (p.id === b.id ? r.pet : p)) };
}

/** Feed in today's total step count from the phone. Safe to call repeatedly. */
export function syncSteps(s0: GameState, stepsToday: number, now: number, day: string): Result {
  const events: GameEvent[] = [];
  let s = tick(s0, now, day);
  const steps = Math.max(0, Math.floor(stepsToday));
  if (steps <= s.stepsCounted) return { state: s, events };
  const sparkGain = sparkFromSteps(steps) - sparkFromSteps(s.stepsCounted);
  const xpGain = Math.floor(steps / STEPS_PER_XP) - Math.floor(s.stepsCounted / STEPS_PER_XP);
  s = { ...s, stepsCounted: steps, totals: { ...s.totals, steps: s.totals.steps + (steps - s.stepsCounted) } };
  s = addSpark(s, sparkGain, events);
  s = growBuddy(s, 'swift', xpGain, events);
  return { state: s, events };
}

/** A finished focus session (minutes actually completed). */
export function completeFocus(s0: GameState, minutes: number, now: number, day: string): Result {
  const events: GameEvent[] = [];
  let s = tick(s0, now, day);
  const sessions = Math.floor(Math.max(0, minutes) / FOCUS_MINUTES);
  if (sessions === 0) return { state: s, events };
  s = { ...s, totals: { ...s.totals, focus: s.totals.focus + sessions } };
  s = addSpark(s, sessions * SPARK_PER_FOCUS, events);
  s = growBuddy(s, 'scholarly', sessions * FOCUS_XP, events);
  return { state: s, events };
}

export function careReadyAt(s: GameState, action: CareAction): number {
  return s.lastCare[action] + CARE_COOLDOWN_MS[action];
}

export function care(s0: GameState, action: CareAction, now: number, day: string): Result {
  const events: GameEvent[] = [];
  let s = tick(s0, now, day);
  if (!buddy(s)) return { state: s, events };
  const readyAt = careReadyAt(s, action);
  if (now < readyAt) {
    events.push({ kind: 'cooldown', action, readyAt });
    return { state: s, events };
  }
  s = {
    ...s,
    happiness: Math.min(100, s.happiness + CARE_GAIN[action]),
    happinessAt: now,
    lastCare: { ...s.lastCare, [action]: now },
    totals: { ...s.totals, care: s.totals.care + 1 },
  };
  // Daily care streak: counts the first care of each day.
  if (s.streak.lastDay !== day) {
    const count = s.streak.lastDay === dayBefore(day) ? s.streak.count + 1 : 1;
    s = { ...s, streak: { count, lastDay: day } };
  }
  const careSpark = Math.max(0, Math.min(SPARK_PER_CARE, CARE_SPARK_CAP - s.careSparkToday));
  if (careSpark > 0) {
    s = { ...s, careSparkToday: s.careSparkToday + careSpark };
    s = addSpark(s, careSpark, events);
  }
  s = growBuddy(s, 'cozy', CARE_XP, events);
  return { state: s, events };
}

/** Hatch one waiting egg. `salt` lets tests and callers vary the seed. */
export function hatch(s0: GameState, now: number, day: string, salt = ''): Result {
  const events: GameEvent[] = [];
  let s = tick(s0, now, day);
  if (s.eggsReady <= 0) return { state: s, events };
  const counter = s.counter + 1;
  const pet = hatchPet({
    seed: newSeed(now, counter, salt),
    region: s.region,
    pity: s.pity,
    now,
    id: `p${counter}-${now.toString(36)}`,
  });
  const key = variantKey(pet);
  const newVariant = !s.dex.includes(key);
  s = {
    ...s,
    counter,
    eggsReady: s.eggsReady - 1,
    pets: [...s.pets, pet],
    pity: isRareOrBetter(pet.rarity) ? 0 : s.pity + 1,
    dex: newVariant ? [...s.dex, key] : s.dex,
    buddyId: s.buddyId ?? pet.id,
    totals: { ...s.totals, hatches: s.totals.hatches + 1 },
  };
  // Spark that piled up while eggs were full can now become an egg.
  s = addSpark(s, 0, events);
  events.push({ kind: 'hatched', petId: pet.id, newVariant });
  return { state: s, events };
}

export function setBuddy(s: GameState, petId: string): GameState {
  return s.pets.some((p) => p.id === petId) ? { ...s, buddyId: petId } : s;
}

export function renamePet(s: GameState, petId: string, name: string): GameState {
  const clean = name.trim().slice(0, 20);
  return { ...s, pets: s.pets.map((p) => (p.id === petId ? { ...p, nickname: clean || null } : p)) };
}

export function setRegion(s: GameState, region: RegionId): GameState {
  return { ...s, region };
}

/** Accept saved data defensively: anything unreadable starts a fresh game. */
export function restore(raw: unknown, now: number, day: string, region: RegionId): GameState {
  const fresh = newGame(now, day, region);
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<GameState>;
  if (r.version !== 1 || !Array.isArray(r.pets)) return fresh;
  return { ...fresh, ...r, lastCare: { ...fresh.lastCare, ...(r.lastCare ?? {}) }, totals: { ...fresh.totals, ...(r.totals ?? {}) } };
}
