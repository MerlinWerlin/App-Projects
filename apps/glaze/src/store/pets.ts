// T188 (owner-1101 #6): Island pet settings (AsyncStorage, works in Expo Go) and the sparse Live
// Activity sync. The behaviour itself is src/core/petLife.ts. The app sends a new content state
// only when petLife says the state changed (activityChanged), plus a throttled update for a tap
// reaction; between updates the extension uses the staleDate + next state it was given.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { petById, type PetStatus } from '../core/islandPets';
import {
  DEFAULT_PET_SETTINGS,
  PET_SETTINGS_KEY,
  activityChanged,
  activityStateFor,
  lifeInputFor,
  parsePetSettings,
  petDisplayName,
  petLife,
  type PetSettings,
} from '../core/petLife';
import { petsSupported, readPetStatus, startPetLife, stopPet, updatePetLife, type PetActivityPayload } from '../native/islandPets';

let cache: PetSettings = DEFAULT_PET_SETTINGS;
let loaded: Promise<PetSettings> | null = null;
const listeners = new Set<(s: PetSettings) => void>();

export function loadPetSettings(): Promise<PetSettings> {
  if (!loaded) {
    loaded = AsyncStorage.getItem(PET_SETTINGS_KEY)
      .then((raw) => { cache = parsePetSettings(raw); return cache; })
      .catch(() => cache);
  }
  return loaded;
}

export function savePetSettings(next: PetSettings): void {
  cache = next;
  for (const l of listeners) l(next);
  AsyncStorage.setItem(PET_SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
}

export function usePetSettings(): { settings: PetSettings; ready: boolean; update: (fn: (s: PetSettings) => PetSettings) => void } {
  const [settings, setSettings] = useState(cache);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    listeners.add(setSettings);
    loadPetSettings().then((s) => { if (alive) { setSettings(s); setReady(true); } });
    return () => { alive = false; listeners.delete(setSettings); };
  }, []);
  const update = useCallback((fn: (s: PetSettings) => PetSettings) => savePetSettings(fn(cache)), []);
  return { settings, ready, update };
}

/** Minutes east of UTC on this phone at `now`. */
export const localOffset = (now: number) => -new Date(now).getTimezoneOffset();

/** The Island content state for the chosen pet right now. */
export function islandPayload(settings: PetSettings, now: number): PetActivityPayload {
  const input = lifeInputFor(settings, settings.pet, now, localOffset(now));
  let life = petLife(input);
  // A sleepy stir is only shown in the app: the Island stays asleep (no pointless update).
  if (life.caption === 'lifeStir') life = petLife({ ...input, lastTapAt: null });
  return { ...activityStateFor(life), name: petDisplayName(settings, settings.pet, petById(settings.pet).name) };
}

const TAP_THROTTLE_MS = 20_000;
let sent: { session: string; payload: PetActivityPayload; at: number } | null = null;

/**
 * Brings the Live Activity in line with the settings: stop when Island is off, start or switch
 * when the pet differs, otherwise update only when the petLife state changed. Call it with a
 * freshly read status. Full iPhone build only (callers check petsSupported()).
 */
// One sync at a time (Pets screen and app-foreground sync share it), so two callers never start two activities.
let queue: Promise<unknown> = Promise.resolve();
export function syncIslandPet(settings: PetSettings, status: PetStatus): Promise<PetStatus> {
  const run = queue.then(() => syncIslandPetNow(settings, status));
  queue = run.catch(() => {});
  return run;
}

/**
 * T192: brings the Island pet up to date whenever Glaze opens or comes back to the foreground, not
 * only from the Pets screen. Reads the saved settings and the live status first. A no-op in Expo Go
 * and on builds without the Live Activity module; never throws.
 */
export async function syncIslandPetOnOpen(): Promise<void> {
  if (!petsSupported()) return;
  try {
    const settings = await loadPetSettings();
    await queue.catch(() => {});
    await syncIslandPet(settings, await readPetStatus());
  } catch {
    // Best effort: the Pets screen reconciles again when opened.
  }
}

async function syncIslandPetNow(settings: PetSettings, status: PetStatus): Promise<PetStatus> {
  if (!settings.island) {
    sent = null;
    return status.session ? stopPet() : status;
  }
  if (!status.enabled) return status;
  const now = Date.now();
  const payload = islandPayload(settings, now);
  if (!status.session || status.session.pet !== settings.pet) {
    const next = await startPetLife(settings.pet, payload);
    sent = next.session ? { session: next.session.id, payload, at: now } : null;
    return next;
  }
  const prev = sent && sent.session === status.session.id ? sent : null;
  if (prev && !activityChanged(prev.payload, payload) && prev.payload.name === payload.name) return status;
  if (prev && payload.state === 'happy' && now - prev.at < TAP_THROTTLE_MS) return status;
  const next = await updatePetLife(status.session.id, payload);
  sent = { session: status.session.id, payload, at: now };
  return next;
}
