// App preferences persisted on-device (AsyncStorage, versioned key 'glaze.settings.v1').
// Parsing and defaults live in src/core/settings.ts. The current value is cached in memory
// so synchronous readers (e.g. haptic()) never wait on storage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  SETTINGS_KEY,
  defaultSettings,
  parseSettings,
  patchSettings,
  serializeSettings,
  type AppSettings,
} from '../core/settings';

export type { AppSettings };

let cache: AppSettings = defaultSettings();
let loaded: Promise<AppSettings> | null = null;
let hasLoaded = false;
const listeners = new Set<(s: AppSettings) => void>();

function emit(): void {
  for (const l of listeners) l(cache);
}

/** Load once from storage (later calls reuse the same promise). */
export function loadSettings(): Promise<AppSettings> {
  if (!loaded) {
    loaded = (async () => {
      try {
        cache = parseSettings(await AsyncStorage.getItem(SETTINGS_KEY));
      } catch {
        cache = defaultSettings();
      }
      hasLoaded = true;
      emit();
      return cache;
    })();
  }
  return loaded;
}

/** Current settings from memory (defaults until the first load finishes). */
export function getSettings(): AppSettings {
  return cache;
}

async function persist(): Promise<AppSettings> {
  const snapshot = cache;
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, serializeSettings(snapshot));
  } catch {
    // Storage unavailable: keep the in-memory value for this session.
  }
  return snapshot;
}

function apply(patch: Partial<AppSettings>): void {
  cache = patchSettings(cache, patch);
  emit();
}

/**
 * Apply a partial change, then persist. Once settings have loaded, memory and listeners
 * update synchronously, so getSettings()/haptic() see the new value on the same tick.
 */
export function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  if (hasLoaded) {
    apply(patch);
    return persist();
  }
  return loadSettings().then(() => {
    apply(patch);
    return persist();
  });
}

export function subscribeSettings(fn: (s: AppSettings) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Settings for a component; re-renders when any screen changes them. */
export function useSettings(): {
  settings: AppSettings;
  ready: boolean;
  update: (patch: Partial<AppSettings>) => void;
} {
  const [settings, setSettings] = useState<AppSettings>(cache);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const off = subscribeSettings((s) => {
      if (alive) setSettings(s);
    });
    loadSettings().then((s) => {
      if (!alive) return;
      setSettings(s);
      setReady(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    updateSettings(patch).catch(() => {});
  }, []);

  return { settings, ready, update };
}

// Warm the cache at import so haptic() honours the saved choice from the first tap.
loadSettings().catch(() => {});
