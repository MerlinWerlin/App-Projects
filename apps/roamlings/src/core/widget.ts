// What the app shares with the home-screen widget, and how taps made on the widget are folded back
// into the game. The Swift side (targets/widget, modules/roamlings-widget-bridge) reads and writes
// the same JSON, so keep the field names and keys in sync with RoamlingsShared.swift.

import { type GameState, buddy, care } from './game.ts';
import { EGG_COST, HAPPINESS_DECAY_PER_HOUR, HAPPINESS_FLOOR } from './growth.ts';

export const WIDGET_APP_GROUP = 'group.com.jared797.roamlings';
export const WIDGET_STATE_KEY = 'roamlings.widget.state.v1';
export const WIDGET_TAPS_KEY = 'roamlings.widget.taps.v1';
/** Image files the app writes into the App Group, one per mood the widget can show. */
export const WIDGET_IMAGES = { happy: 'buddy-happy.png', joyful: 'buddy-joyful.png', sleepy: 'buddy-sleepy.png' } as const;
export type WidgetMood = keyof typeof WIDGET_IMAGES;

export interface WidgetState {
  v: 1;
  hasPet: boolean;
  name: string;
  /** Rarity id (common…mythic), for the badge colour. */
  rarity: string;
  /** Rendering key of the saved images; changes when the buddy, its stage or form changes. */
  imageKey: string;
  happiness: number;
  happinessAt: number;
  decayPerHour: number;
  floor: number;
  eggSpark: number;
  eggCost: number;
  eggsReady: number;
  sparkToday: number;
  steps: number;
  streak: number;
  /** When each care action is next allowed (epoch ms). */
  feedReadyAt: number;
  petReadyAt: number;
  /** Labels in the app's language, so the widget needs no strings of its own. */
  labels: { feed: string; pet: string; egg: string; eggsReady: string; spark: string; hatch: string };
}

export function imageKeyFor(s: GameState): string {
  const b = buddy(s);
  if (!b) return 'none';
  return `${b.id}|${b.paletteId}|${b.mod ? b.mod.value : '-'}|${b.stage}|${b.branch ?? '-'}`;
}

export function widgetState(s: GameState, name: string, labels: WidgetState['labels']): WidgetState {
  const b = buddy(s);
  return {
    v: 1,
    hasPet: !!b,
    name,
    rarity: b?.rarity ?? 'common',
    imageKey: imageKeyFor(s),
    happiness: Math.round(s.happiness * 10) / 10,
    happinessAt: s.happinessAt,
    decayPerHour: HAPPINESS_DECAY_PER_HOUR,
    floor: HAPPINESS_FLOOR,
    eggSpark: s.eggSpark,
    eggCost: EGG_COST,
    eggsReady: s.eggsReady,
    sparkToday: s.sparkToday,
    steps: s.stepsCounted,
    streak: s.streak.count,
    feedReadyAt: s.lastCare.feed + 3 * 3600_000,
    petReadyAt: s.lastCare.pet + 60_000,
    labels,
  };
}

export interface WidgetTap {
  action: 'feed' | 'pet';
  at: number;
}

/** Parse the tap log the widget writes; anything malformed is ignored. */
export function parseTaps(raw: string | null | undefined): WidgetTap[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t): t is WidgetTap => !!t && typeof t === 'object' && ((t as WidgetTap).action === 'feed' || (t as WidgetTap).action === 'pet') && Number.isFinite((t as WidgetTap).at))
      .slice(-50)
      .sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}

/**
 * Apply widget taps in time order with the normal care rules (cooldowns, caps, streak).
 * A tap is never dated earlier than the state's last update, so happiness never decays twice.
 */
export function applyTaps(s0: GameState, taps: WidgetTap[], dayOf: (ms: number) => string): GameState {
  let s = s0;
  for (const t of taps) {
    const at = Math.max(t.at, s.happinessAt);
    s = care(s, t.action, at, dayOf(at)).state;
  }
  return s;
}
