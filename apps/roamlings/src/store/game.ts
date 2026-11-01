// App-side game store: holds the GameState, saves it to the phone, and lets screens subscribe.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import {
  type GameEvent,
  type GameState,
  care as careAction,
  completeFocus,
  hatch as hatchAction,
  localDay,
  newGame,
  renamePet,
  restore,
  setBuddy,
  setRegion,
  syncSteps,
  tick,
} from '../core/game';
import type { CareAction } from '../core/growth';
import { type RegionId, regionForCountry } from '../core/region';
import { type WidgetTap, applyTaps } from '../core/widget';

const KEY = 'roamlings.game.v1';
const SETTINGS_KEY = 'roamlings.settings.v1';

export interface Settings {
  haptics: boolean;
}

function deviceRegion(): RegionId {
  try {
    return regionForCountry(getLocales()[0]?.regionCode ?? null);
  } catch {
    return 'wilds';
  }
}

let state: GameState = newGame(Date.now(), localDay(new Date()), deviceRegion());
let settings: Settings = { haptics: true };
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, 300);
}

function set(next: GameState) {
  if (next === state) return;
  state = next;
  emit();
  scheduleSave();
}

export async function loadGame(): Promise<void> {
  if (loaded) return;
  const now = Date.now();
  const day = localDay(new Date(now));
  try {
    const [raw, rawSettings] = await Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(SETTINGS_KEY)]);
    state = tick(restore(raw ? JSON.parse(raw) : null, now, day, deviceRegion()), now, day);
    if (rawSettings) settings = { ...settings, ...(JSON.parse(rawSettings) as Partial<Settings>) };
  } catch {
    state = newGame(now, day, deviceRegion());
  }
  loaded = true;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings, () => settings);
}

export function getGame(): GameState {
  return state;
}

function nowAndDay(): [number, string] {
  const now = Date.now();
  return [now, localDay(new Date(now))];
}

export const actions = {
  refresh(): void {
    const [now, day] = nowAndDay();
    set(tick(state, now, day));
  },
  steps(stepsToday: number): GameEvent[] {
    const [now, day] = nowAndDay();
    const r = syncSteps(state, stepsToday, now, day);
    set(r.state);
    return r.events;
  },
  focus(minutes: number): GameEvent[] {
    const [now, day] = nowAndDay();
    const r = completeFocus(state, minutes, now, day);
    set(r.state);
    return r.events;
  },
  care(action: CareAction): GameEvent[] {
    const [now, day] = nowAndDay();
    const r = careAction(state, action, now, day);
    set(r.state);
    return r.events;
  },
  hatch(): GameEvent[] {
    const [now, day] = nowAndDay();
    const r = hatchAction(state, now, day, String(Math.random()));
    set(r.state);
    return r.events;
  },
  setBuddy(id: string): void {
    set(setBuddy(state, id));
  },
  rename(id: string, name: string): void {
    set(renamePet(state, id, name));
  },
  applyWidgetTaps(taps: WidgetTap[]): void {
    const [now, day] = nowAndDay();
    set(applyTaps(tick(state, now, day), taps, (ms) => localDay(new Date(ms))));
  },
  setRegion(region: RegionId): void {
    set(setRegion(state, region));
  },
  setHaptics(on: boolean): void {
    settings = { ...settings, haptics: on };
    emit();
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  },
};
