// Colouring progress per scene, autosaved to the phone shortly after every change.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { type Progress, emptyProgress, restoreProgress } from '../core/progress';
import type { Scene } from '../core/scene';
import { SCENES } from '../scenes';
import { createSaveQueue } from '../core/saveQueue';

const key = (id: string) => `hollowhue.scene.${id}.v1`;
const cache = new Map<string, Progress>();
const listeners = new Set<() => void>();
const saves = createSaveQueue((k, value) => AsyncStorage.setItem(k, value));
let version = 0;

function emit() {
  version++;
  for (const l of listeners) l();
}

export async function loadAllProgress(): Promise<void> {
  try {
    const pairs = await AsyncStorage.multiGet(SCENES.map((s) => key(s.id)));
    for (const [k, raw] of pairs) {
      const scene = SCENES.find((s) => key(s.id) === k);
      if (!scene) continue;
      try {
        cache.set(scene.id, restoreProgress(scene, raw ? JSON.parse(raw) : null));
      } catch {
        cache.set(scene.id, emptyProgress(scene));
      }
    }
  } catch {
    // start fresh; nothing is lost on disk
  }
  emit();
}

export function getProgress(scene: Scene): Progress {
  let p = cache.get(scene.id);
  if (!p) {
    p = emptyProgress(scene);
    cache.set(scene.id, p);
  }
  return p;
}

export function setProgress(scene: Scene, p: Progress) {
  if (cache.get(scene.id) === p) return;
  cache.set(scene.id, p);
  emit();
  saves.put(key(scene.id), JSON.stringify(p));
}

/** Write any pending saves now (app going to the background, leaving a scene). */
export function flushProgress() {
  return saves.flush();
}

/** Re-renders when any scene's progress changes. */
export function useProgressVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}
