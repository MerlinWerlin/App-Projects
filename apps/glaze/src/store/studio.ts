// Icon Studio state persisted on-device with AsyncStorage (versioned JSON).
// Parsing, defaults and ordering live in src/core/studio.ts so they are unit-tested.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from '../native/fs';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyThemeStyle,
  DEFAULT_STYLE,
  defaultStudioState,
  imagesInUse,
  migrateThemedLook,
  themeIconStyle,
  mapImageUris,
  parseStudioState,
  serializeStudioState,
  studioApps,
  studioSpecs,
  type StudioState,
} from '../core/studio';
import type { IconStyle } from '../core/iconspec';
import type { LookTheme } from '../core/iconLook';
import { getAnyTheme } from '../core/plusThemes';
import { restoreDownloadedPacks } from '../native/packs';

export { DEFAULT_STYLE, studioApps, studioSpecs };
export type { StudioState };

const KEY = 'glaze.studio';

// Reads wait for queued writes and writes run one at a time (same pattern as src/store/loops.ts).
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function iconsDir(): string | null {
  const doc = FileSystem.documentDirectory;
  return doc ? `${doc}icons/` : null;
}

/** iOS can move the app container between updates: re-point our own photo copies. */
function resolveImageUri(uri: string): string {
  const dir = iconsDir();
  const m = /\/icons\/([^/]+)$/.exec(uri);
  return dir && m && !uri.startsWith(dir) ? `${dir}${m[1]}` : uri;
}

async function read(): Promise<StudioState> {
  // Pack-only motifs must be registered first or the parser drops them from the saved style (T50).
  await restoreDownloadedPacks();
  try {
    // v1 data (overrides by app only) is migrated by the parser into the current theme's overrides.
    const s = mapImageUris(parseStudioState(await AsyncStorage.getItem(KEY)), resolveImageUri);
    // T241: a theme applied before icon looks existed moves to the textured 'themed' look.
    return migrateThemedLook(s, s.looksMigrated ? undefined : getAnyTheme(s.themeId));
  } catch {
    return defaultStudioState();
  }
}

async function write(state: StudioState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, serializeStudioState(state));
  } catch {
    // Storage full or unavailable: keep the in-memory state.
  }
}

// Every mounted useStudio (theme page, its override row, Your look panel...) hears about saved
// changes, so one screen's stale copy never overwrites another's edit (e.g. a shape choice).
type Listener = (s: StudioState) => void;
const listeners = new Set<Listener>();
function emit(s: StudioState, except?: Listener): void {
  for (const l of listeners) if (l !== except) l(s);
}

export function loadStudio(): Promise<StudioState> {
  return serial(read);
}

export function saveStudio(s: StudioState): Promise<void> {
  return serial(() => write(s));
}

/**
 * Apply a whole-set style (e.g. from a theme's Apply flow). Keeps selection, every theme's
 * overrides, shape choices and the image library; the user's chosen shape for the theme wins
 * over the theme's own; studioSpecs then shows that theme's overrides.
 */
export function setStudioStyle(
  style: IconStyle,
  themeId: string | null,
  wallpaperColour?: string | null,
): Promise<StudioState> {
  return serial(async () => {
    const s = await read();
    // The theme's style with the user's chosen shape for it (T26), so it is baked into exports.
    const next: StudioState = applyThemeStyle(s, style, themeId, wallpaperColour);
    // Round-trip through the parser so a bad colour can't be stored.
    const clean = parseStudioState(serializeStudioState(next));
    await write(clean);
    emit(clean);
    return clean;
  });
}

/**
 * T240 / T241: apply a theme's icons in the user's look for it (default 'themed', textured) and
 * chosen shape. Used by "Use this theme" and the Icons step, so the exports match the preview.
 */
export function applyThemeIcons(theme: LookTheme, wallpaperColour?: string | null): Promise<StudioState> {
  return serial(async () => {
    const s = await read();
    const next: StudioState = applyThemeStyle(s, themeIconStyle(s, theme), theme.id, wallpaperColour);
    const clean = parseStudioState(serializeStudioState(next));
    await write(clean);
    emit(clean);
    return clean;
  });
}

/**
 * T229: apply a pure change to the saved state outside a screen (e.g. auto-select after the
 * installed-apps check), save it and tell every mounted screen. Returns the state after the change.
 */
export function updateStudio(fn: (s: StudioState) => StudioState): Promise<StudioState> {
  return serial(async () => {
    const s = await read();
    const next = fn(s);
    if (next === s) return s;
    await write(next);
    emit(next);
    return next;
  });
}

/**
 * Studio state for a screen: loads on focus, `update` applies a pure change immediately
 * and persists it (writes are serialized, so rapid taps keep their order).
 */
export function useStudio(): {
  state: StudioState | null;
  update: (fn: (s: StudioState) => StudioState) => void;
  reload: () => Promise<void>;
} {
  const [state, setState] = useState<StudioState | null>(null);
  const ref = useRef<StudioState | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const s = await loadStudio();
    if (!alive.current) return;
    ref.current = s;
    setState(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const listener = useRef<Listener>((s) => {
    if (!alive.current) return;
    ref.current = s;
    setState(s);
  });
  useEffect(() => {
    const l = listener.current;
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = useCallback((fn: (s: StudioState) => StudioState) => {
    const cur = ref.current;
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    ref.current = next;
    setState(next);
    // Re-apply the (pure) change to the latest saved state, so edits made meanwhile by another
    // screen's useStudio are kept, then tell the other screens.
    serial(async () => {
      let latest: StudioState;
      try {
        latest = mapImageUris(parseStudioState(await AsyncStorage.getItem(KEY)), resolveImageUri);
      } catch {
        // Storage unreadable: save this screen's copy rather than a default state.
        await write(next);
        return;
      }
      const saved = fn(latest);
      if (saved === latest) return;
      await write(saved);
      emit(saved, listener.current);
    }).catch(() => undefined);
  }, []);

  return { state, update, reload };
}

/**
 * Copy a picked photo into the documents folder so it survives cache purges.
 * Returns the original URI if copying fails.
 */
export async function keepIconImage(uri: string, appId: string): Promise<string> {
  try {
    const dir = iconsDir();
    if (!dir) return uri;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = (/\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri)?.[1] ?? 'jpg').toLowerCase();
    const safe = appId.replace(/[^a-z0-9-]/gi, '_');
    const dest = `${dir}${safe}-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/**
 * Delete our own photo copy after the user explicitly deleted it from "My images"
 * (core deleteImage). Never deletes a file that `state` or the stored state still references
 * (any override in any theme or a library entry), and never touches files outside the icons folder.
 */
export function removeUnusedIconImage(uri: string | null | undefined, state: StudioState): Promise<void> {
  if (!uri || imagesInUse(state).has(uri)) return Promise.resolve();
  return serial(async () => {
    try {
      // Runs after queued writes, so this sees the latest saved state.
      if (imagesInUse(await read()).has(uri)) return;
      const dir = iconsDir();
      if (dir && uri.startsWith(dir)) await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // Best effort.
    }
  });
}
