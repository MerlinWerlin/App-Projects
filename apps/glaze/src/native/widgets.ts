// Widgets bridge adapter (docs/WIDGETS.md, PLAN §3). The native module `GlazeWidgetBridge`
// (modules/glaze-widget-bridge) exists only in an iOS development/production build. Everywhere
// else, including Expo Go and Android, every call is a no-op returning { available: false }.
// Never throws.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { serializeWidgetTheme, type WidgetTheme } from '../core/widgetTheme';
import { syncHabitStore, type HabitSyncResult } from '../core/habitLog';
import { syncHabitStoreWithGoals, type HabitGoals } from '../core/habitGoals';
import type { HabitKind, HabitState } from '../core/habits';
import { logHabitTapInStore, logHabitUndoInStore } from '../core/habitTap';
import { migrateLocalHabitsInStore } from '../core/habitMigrate';
import { NO_WIDGET_LINK, normaliseWidgetLinkStatus, type WidgetLinkStatus } from '../core/widgetLink';
import {
  addPiece,
  clearAll,
  isValidPieceId,
  listPieces,
  migrateLibrary,
  parseLibrary,
  pinLastApplied,
  removeMany,
  removePiece,
  replaceThemeArt,
  serializeLibrary,
  WIDGET_ART_SOURCES,
  type WidgetArtIndex,
  type WidgetArtPiece,
  type WidgetArtSize,
  type WidgetArtSourceFile,
} from '../core/widgetArtLibrary';
import { commitThemeArt, type PlannedThemePiece } from '../core/themeArtSync';

export type WidgetsReason = 'expo-go' | 'android' | 'not-built' | 'failed' | null;
export type WidgetsResult = { available: boolean; ok: boolean; reason: WidgetsReason };
/** T73: trackers after folding in the taps made on the interactive habit widgets. */
export type HabitsSyncResult = WidgetsResult & {
  habits: HabitState[];
  appliedCount: number;
  /** T95: false when the App Group read threw; `habits` is then empty and must not replace a cache. */
  read?: boolean;
};

export interface WidgetsAdapter {
  isAvailable(): Promise<{ available: boolean; reason: WidgetsReason }>;
  /** Write the active theme to the App Group and reload widget timelines. */
  setTheme(theme: WidgetTheme): Promise<WidgetsResult>;
  designVersion(): Promise<number>;
  /** Copy a local image (file:// URI) into the App Group for the Photo widget. */
  setPhoto(uri: string): Promise<WidgetsResult>;
  clearPhoto(): Promise<WidgetsResult>;
  /**
   * T59: write a widget-set payload (src/core/widgetStudio.ts `studioPayload`) to App Group key
   * `glaze.widgets.v2` and reload timelines. A build whose bridge predates T59 reports
   * { available: false, reason: 'not-built' }.
   */
  setWidgetSet(json: string): Promise<WidgetsResult>;
  /**
   * T73: read the habit trackers and the widget tap log from the App Group, fold new taps in
   * (src/core/habitLog.ts syncHabitStore) and write the trackers back when they changed.
   * Expo Go / Android / a build whose bridge predates T73: { available: false, habits: [] }.
   * T86: with `goals` (src/core/habitGoals.ts), every tracker's daily goal is written too, which is
   * where the widget extension reads it.
   */
  syncHabits(now?: Date, goals?: HabitGoals): Promise<HabitsSyncResult>;
  /**
   * T89: log one tap made in the app (Widgets tab habit card). Same read as syncHabits, then the
   * tap is added to the app's trackers (src/core/habitTap.ts logHabitTapInStore) and only
   * glaze.habits.v1 is written; the extension's tap log is never touched (one writer per key).
   * Expo Go / Android / older bridge: { available: false, habits: [] } and nothing is written.
   * T94: `undo` takes one step off instead (src/core/habitTap.ts logHabitUndoInStore).
   */
  logHabit(kind: HabitKind, now?: Date, goals?: HabitGoals, undo?: boolean): Promise<HabitsSyncResult>;
  /**
   * T96: copy the app-only trackers (HABITS_LOCAL_KEY JSON, src/core/habitMigrate.ts) into the App
   * Group once; never lowers a value. Expo Go / Android / older bridge: { available: false }.
   */
  migrateLocalHabits(localRaw: string | null, now?: Date, goals?: HabitGoals): Promise<HabitsSyncResult>;
  /**
   * T131: Seamless widget. The bridge crops `cropPx` (wallpaper pixels, src/core/seamlessWidget.ts
   * seamlessCrop) out of the wallpaper, draws the hero centred-fit on top, writes
   * `seamless-<size>.png` into the App Group and reloads the "GlazeSeamless" widget.
   * Expo Go / Android / a build whose bridge predates T131: { available: false } and nothing runs.
   */
  setSeamless(input: SeamlessInput): Promise<WidgetsResult>;
  /**
   * T187: theme widget art FITTED (never cropped) on a plain theme colour or a blurred copy of the
   * art, written to the same `seamless-<size>.png` the "GlazeSeamless" widget shows. A build whose
   * bridge predates T187: { available: false, reason: 'not-built' } (callers fall back to setSeamless).
   */
  setWidgetArt(input: WidgetArtInput): Promise<WidgetsResult>;
  /**
   * T146 widget link check (fb-1025 A): App Group container, stored theme and what the widget
   * extension last rendered (src/core/widgetLink.ts widgetLinkVerdict turns it into an answer).
   * Read-only. Expo Go / Android / missing module: { available: false }. A build whose bridge
   * predates T146: { available: true, supported: false } (link unknown). Never throws.
   */
  linkStatus(): Promise<WidgetLinkResult>;
  /**
   * T221 "My widget art": copy `from` (an App Group file the bridge just wrote: seamless-<size>.png
   * or widget-photo.jpg) into widget-art/<id>.jpg and add the piece to the index (deduped by id,
   * capped; src/core/widgetArtLibrary.ts). Every Glaze art widget can then pick its own piece
   * (long-press > Edit Widget). Expo Go / Android / older bridge: { available: false }, nothing runs.
   */
  addToArtLibrary(piece: Omit<WidgetArtPiece, 'file'>, from: WidgetArtSourceFile): Promise<WidgetsResult>;
  /** T221: the library, newest first, plus the file:// folder holding the images ('' when unknown). */
  artLibrary(): Promise<ArtLibraryResult>;
  /** T221: remove one piece (its file is deleted; widgets showing it fall back to the last applied image). */
  removeFromArtLibrary(id: string): Promise<WidgetsResult>;
  /** T238 Manage > Delete selected: one index write (files pruned, timelines reloaded natively). */
  removeManyFromArtLibrary(ids: readonly string[]): Promise<WidgetsResult>;
  /** T238 Manage > Clear all (own photos too). */
  clearArtLibrary(): Promise<WidgetsResult>;
  /**
   * T238: a theme was applied: keep own photos + this theme's art, remove other auto-added theme art,
   * remember it as the current theme (widget fallback). Also runs after a theme piece is added.
   */
  replaceThemeArt(themeId: string): Promise<WidgetsResult>;
  /** T238: one-time clean-up of art from older versions / other themes (no-op once done). */
  migrateArtLibrary(currentThemeId: string | null): Promise<WidgetsResult>;
  /**
   * T252: compose one theme art piece straight into widget-art/<id>.jpg (bridge
   * composeWidgetArtPiece / composeSeamlessPiece). Never touches the index, seamless-<size>.png or
   * the timelines; a piece already on disk is kept (skipIfPresent). A build whose bridge predates
   * T252: { available: false, reason: 'not-built' }. Never throws.
   */
  composeArtPiece(input: ComposeArtPieceInput): Promise<WidgetsResult>;
  /**
   * T252: the ONE index write of a theme apply (src/core/themeArtSync.ts commitThemeArt): own photos
   * kept, the theme's planned pieces that exist (`ready` = made this run) listed, other themes' auto
   * art removed, current theme recorded. The bridge writes the index, prunes unlisted files and only
   * then reloads every timeline. Serialised with every other index edit. Never throws.
   */
  commitThemeArt(themeId: string, planned: readonly PlannedThemePiece[], ready: readonly string[]): Promise<WidgetsResult>;
}

/** T252: one piece for widgets.composeArtPiece (local file:// URIs; never uploaded anywhere). */
export type ComposeArtPieceInput =
  | { id: string; kind: 'art'; artUri: string; widthPx: number; heightPx: number; colour: string; skipIfPresent?: boolean; preserveArtwork?: boolean }
  | { id: string; kind: 'seamless'; wallpaperUri: string; cropPx: { x: number; y: number; w: number; h: number }; heroUri: string; skipIfPresent?: boolean };

/** T221: widgets.artLibrary() result. */
export type ArtLibraryResult = WidgetsResult & { pieces: WidgetArtPiece[]; dir: string };

/** T146: linkStatus result (normalised status + why it is unavailable). */
export type WidgetLinkResult = WidgetLinkStatus & { reason: WidgetsReason };
export type { WidgetLinkStatus };

/** T131: inputs for widgets.setSeamless (local file:// URIs; never uploaded anywhere). */
export type SeamlessInput = {
  wallpaperUri: string;
  /** Crop rectangle in wallpaper pixels (whole numbers, inside the image). */
  cropPx: { x: number; y: number; w: number; h: number };
  /** Transparent hero art drawn on top; null/empty = wallpaper crop only. */
  heroUri?: string | null;
  size: 'small' | 'medium' | 'large';
};

/** T187: inputs for widgets.setWidgetArt (local file:// URI of the art; never uploaded anywhere). */
export type WidgetArtInput = {
  preserveArtwork?: boolean;
  artUri: string;
  /** Output size in pixels (the widget's size on this phone). */
  widthPx: number;
  heightPx: number;
  background: 'theme' | 'blur';
  /** #RRGGBB behind the art (and under the blur). */
  colour: string;
  /**
   * 'fill' only when the art already has the widget's aspect (src/core/widgetOptions.ts placeArt).
   * T236: the bridge now composes full bleed for both (fullBleedArt) and decides edge to edge from
   * the real image; kept for the native signature.
   */
  fit: 'fit' | 'fill';
  size: 'small' | 'medium' | 'large';
};

/** T187: true when the input is something the bridge can act on. */
export function validWidgetArtInput(input: WidgetArtInput | null | undefined): boolean {
  if (!input || typeof input.artUri !== 'string' || input.artUri.length === 0) return false;
  if (input.size !== 'small' && input.size !== 'medium' && input.size !== 'large') return false;
  if (input.background !== 'theme' && input.background !== 'blur') return false;
  if (input.fit !== 'fit' && input.fit !== 'fill') return false;
  if (typeof input.colour !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(input.colour)) return false;
  return [input.widthPx, input.heightPx].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 1);
}

/** T131: true when the input is something the bridge can act on (checked before calling native). */
export function validSeamlessInput(input: SeamlessInput | null | undefined): boolean {
  if (!input || typeof input.wallpaperUri !== 'string' || input.wallpaperUri.length === 0) return false;
  if (input.size !== 'small' && input.size !== 'medium' && input.size !== 'large') return false;
  const c = input.cropPx;
  if (!c) return false;
  const nums = [c.x, c.y, c.w, c.h];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  return c.x >= 0 && c.y >= 0 && c.w >= 1 && c.h >= 1;
}

/** Shape exposed by modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift. */
type NativeBridge = {
  setTheme(json: string): Promise<boolean>;
  widgetDesignVersion?(): Promise<number>;
  setPhoto(uri: string): Promise<boolean>;
  clearPhoto?(): Promise<boolean>;
  setWidgetSet?(json: string): Promise<boolean>;
  getHabits?(): Promise<{ habits?: string | null; log?: string | null } | null>;
  setHabits?(json: string): Promise<boolean>;
  /** T131: crop + compose + write seamless-<family>.png, reload "GlazeSeamless". */
  setSeamless?(
    wallpaperUri: string,
    x: number,
    y: number,
    w: number,
    h: number,
    heroUri: string,
    family: string,
  ): Promise<boolean>;
  /** T187: fit the art on a colour / blurred background, write seamless-<family>.png, reload "GlazeSeamless". */
  setWidgetArt?(artUri: string, w: number, h: number, background: string, colour: string, fit: string, family: string): Promise<boolean>;
  setClockArt?(artUri: string, w: number, h: number, colour: string, family: string): Promise<boolean>;
  composeClockArtPiece?(id: string, artUri: string, w: number, h: number, colour: string, skipIfPresent: boolean): Promise<boolean>;
  /** T146: { containerOk, themeStored, lastRead, storedTheme } (read-only). */
  linkStatus?(): Promise<unknown>;
  /** T221: copy an App Group file into widget-art/<id>.jpg. */
  saveWidgetArtPiece?(id: string, from: string): Promise<boolean>;
  /** T221: { index, dir } (read-only). */
  getWidgetArtLibrary?(): Promise<{ index?: string | null; dir?: string | null } | null>;
  /** T221: write widget-art/index.json, prune unlisted files, reload all timelines. */
  setWidgetArtIndex?(json: string): Promise<boolean>;
  /** T252: compose a theme piece into widget-art/<id>.jpg (no index write, no reload). */
  composeWidgetArtPiece?(id: string, artUri: string, w: number, h: number, colour: string, skipIfPresent: boolean): Promise<boolean>;
  /** T252: the wallpaper-backed twin; crop = [x, y, w, h] in wallpaper pixels. */
  composeSeamlessPiece?(id: string, wallpaperUri: string, crop: number[], heroUri: string, skipIfPresent: boolean): Promise<boolean>;
};

function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

let cached: NativeBridge | null | undefined;

function loadNative(): NativeBridge | null {
  if (cached !== undefined) return cached;
  let found: NativeBridge | null = null;
  try {
    const mod =
      typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule<NativeBridge>('GlazeWidgetBridge')
        : null;
    found = mod && typeof mod.setTheme === 'function' && typeof mod.setPhoto === 'function' ? mod : null;
  } catch {
    found = null;
  }
  cached = found;
  return found;
}

async function isAvailable(): Promise<{ available: boolean; reason: WidgetsReason }> {
  try {
    if (Platform.OS !== 'ios') return { available: false, reason: 'android' };
    if (isExpoGo()) return { available: false, reason: 'expo-go' };
    if (!loadNative()) return { available: false, reason: 'not-built' };
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'not-built' };
  }
}

async function run(call: (mod: NativeBridge) => Promise<boolean> | undefined): Promise<WidgetsResult> {
  try {
    const status = await isAvailable();
    const mod = status.available ? loadNative() : null;
    if (!mod) return { available: false, ok: false, reason: status.reason };
    const ok = (await call(mod)) === true;
    return { available: true, ok, reason: ok ? null : 'failed' };
  } catch {
    return { available: true, ok: false, reason: 'failed' };
  }
}

/**
 * One read-compute-write round on the App Group habit keys. `compute` gets both raw strings and
 * returns the trackers plus the glaze.habits.v1 JSON to write (null = nothing to write).
 */
async function habitStoreRound(compute: (habitsRaw: string | null, logRaw: string | null) => HabitSyncResult): Promise<HabitsSyncResult> {
  const none = (reason: WidgetsReason, available = false): HabitsSyncResult => ({ available, ok: false, reason, habits: [], appliedCount: 0 });
  try {
    const status = await isAvailable();
    const mod = status.available ? loadNative() : null;
    if (!mod) return none(status.reason);
    if (typeof mod.getHabits !== 'function' || typeof mod.setHabits !== 'function') return none('not-built');
    const raw = await mod.getHabits();
    const habitsRaw = raw && typeof raw.habits === 'string' ? raw.habits : null;
    const logRaw = raw && typeof raw.log === 'string' ? raw.log : null;
    const result = compute(habitsRaw, logRaw);
    const ok = result.json === null ? true : (await mod.setHabits(result.json)) === true;
    return { available: true, ok, reason: ok ? null : 'failed', habits: result.habits, appliedCount: result.appliedCount };
  } catch {
    // T95: nothing trustworthy was read; callers keep what they already show.
    return { ...none('failed', true), read: false };
  }
}

function syncHabits(now: Date = new Date(), goals?: HabitGoals): Promise<HabitsSyncResult> {
  return habitStoreRound((habitsRaw, logRaw) =>
    goals ? syncHabitStoreWithGoals(habitsRaw, logRaw, goals, now) : syncHabitStore(habitsRaw, logRaw, now),
  );
}

function logHabit(kind: HabitKind, now: Date = new Date(), goals: HabitGoals = {}, undo = false): Promise<HabitsSyncResult> {
  return habitStoreRound((habitsRaw, logRaw) =>
    undo ? logHabitUndoInStore(habitsRaw, logRaw, goals, kind, now) : logHabitTapInStore(habitsRaw, logRaw, goals, kind, now),
  );
}

function migrateLocalHabits(localRaw: string | null, now: Date = new Date(), goals: HabitGoals = {}): Promise<HabitsSyncResult> {
  return habitStoreRound((habitsRaw, logRaw) => migrateLocalHabitsInStore(habitsRaw, logRaw, localRaw, goals, now));
}

export const widgets: WidgetsAdapter = {
  isAvailable,
  designVersion: async () => {
    try { return (await loadNative()?.widgetDesignVersion?.()) ?? 0; } catch { return 0; }
  },
  setTheme: (theme) => run((mod) => mod.setTheme(serializeWidgetTheme(theme))),
  setPhoto: (uri) => run((mod) => mod.setPhoto(uri)),
  clearPhoto: () => run((mod) => mod.clearPhoto?.()),
  setWidgetSet: async (json) => {
    const mod = (await isAvailable()).available ? loadNative() : null;
    if (mod && typeof mod.setWidgetSet !== 'function') return { available: false, ok: false, reason: 'not-built' };
    return run((m) => m.setWidgetSet?.(json));
  },
  syncHabits,
  logHabit,
  migrateLocalHabits,
  setSeamless,
  setWidgetArt,
  linkStatus,
  addToArtLibrary,
  artLibrary,
  removeFromArtLibrary,
  removeManyFromArtLibrary: (ids) => editArtIndex((lib) => removeMany(lib, ids).lib),
  clearArtLibrary: () => editArtIndex((lib) => clearAll(lib).lib),
  replaceThemeArt: (themeId) => editArtIndex((lib) => replaceThemeArt(lib, themeId).lib),
  migrateArtLibrary: (currentThemeId) =>
    editArtIndex((lib) => {
      const r = migrateLibrary(lib, currentThemeId);
      return r.ran ? r.lib : null;
    }),
  composeArtPiece,
  commitThemeArt: (themeId, planned, ready) => editArtIndex((lib) => commitThemeArt(lib, themeId, planned, ready, Date.now()).lib),
};

/**
 * T252: every read-change-write of index.json runs one at a time (a theme apply's commit, "Use on
 * my widget", Manage), so two edits can never overwrite each other's index.
 */
let artQueue: Promise<unknown> = Promise.resolve();
function serialArt<T>(job: () => Promise<T>): Promise<T> {
  const next = artQueue.then(job, job);
  artQueue = next.catch(() => undefined);
  return next;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

async function composeArtPiece(input: ComposeArtPieceInput): Promise<WidgetsResult> {
  try {
    const { mod, reason } = await artBridge();
    if (!mod) return { available: false, ok: false, reason };
    if (typeof mod.composeWidgetArtPiece !== 'function' || typeof mod.composeSeamlessPiece !== 'function') {
      return { available: false, ok: false, reason: 'not-built' };
    }
    if (!input || !isValidPieceId(input.id)) return { available: true, ok: false, reason: 'failed' };
    const skip = input.skipIfPresent !== false;
    let ok = false;
    if (input.kind === 'art') {
      if (typeof input.artUri !== 'string' || !input.artUri || !/^#[0-9A-Fa-f]{6}$/.test(input.colour)) return { available: true, ok: false, reason: 'failed' };
      if (!finite(input.widthPx) || !finite(input.heightPx) || input.widthPx < 1 || input.heightPx < 1) return { available: true, ok: false, reason: 'failed' };
      if (input.preserveArtwork && typeof mod.composeClockArtPiece !== 'function') return { available: false, ok: false, reason: 'not-built' };
      const compose = input.preserveArtwork ? mod.composeClockArtPiece : mod.composeWidgetArtPiece;
      ok = (await compose?.(input.id, input.artUri, Math.round(input.widthPx), Math.round(input.heightPx), input.colour, skip)) === true;
    } else {
      const c = input.cropPx;
      if (typeof input.wallpaperUri !== 'string' || !input.wallpaperUri || !c || ![c.x, c.y, c.w, c.h].every(finite) || c.w < 1 || c.h < 1) {
        return { available: true, ok: false, reason: 'failed' };
      }
      const crop = [Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h)];
      ok = (await mod.composeSeamlessPiece(input.id, input.wallpaperUri, crop, input.heroUri ?? '', skip)) === true;
    }
    return { available: true, ok, reason: ok ? null : 'failed' };
  } catch {
    return { available: true, ok: false, reason: 'failed' };
  }
}

/**
 * T238: read index.json, change it in JS, write it back in one atomic write (setWidgetArtIndex also
 * deletes the files the index no longer lists and reloads all timelines). `edit` returning null =
 * nothing to write. Expo Go / Android / older bridge: { available: false }. Never throws.
 */
function editArtIndex(edit: (lib: WidgetArtIndex) => WidgetArtIndex | null): Promise<WidgetsResult> {
  return serialArt(() => editArtIndexNow(edit));
}

async function editArtIndexNow(edit: (lib: WidgetArtIndex) => WidgetArtIndex | null): Promise<WidgetsResult> {
  try {
    const { mod, reason } = await artBridge();
    if (!mod) return { available: false, ok: false, reason };
    const { lib } = await readArtIndex(mod);
    const next = edit(lib);
    if (!next) return { available: true, ok: true, reason: null };
    const ok = (await mod.setWidgetArtIndex?.(serializeLibrary(next))) === true;
    return { available: true, ok, reason: ok ? null : 'failed' };
  } catch {
    return { available: true, ok: false, reason: 'failed' };
  }
}

/** T259: 'seamless-medium.png' → 'medium'; anything else (the photo file) → null. */
function seamlessFileSize(from: string): WidgetArtSize | null {
  const m = /^seamless-(small|medium|large)\.png$/.exec(from);
  return m ? (m[1] as WidgetArtSize) : null;
}

/**
 * T259: the app just wrote seamless-<size>.png itself, so widgets with no chosen piece show it again
 * (drops `size` from index.json `unpinned`; no write when it is not there, e.g. no swap since). Best
 * effort: never throws, never fails the write that called it.
 */
async function showLastApplied(size: WidgetArtSize): Promise<void> {
  try {
    await editArtIndex((lib) => pinLastApplied(lib, size));
  } catch {
    // The image is written; at worst unpinned widgets keep following the theme's own piece.
  }
}

/** T221: the bridge with the library functions, or why not. */
async function artBridge(): Promise<{ mod: NativeBridge | null; reason: WidgetsReason }> {
  const status = await isAvailable();
  const mod = status.available ? loadNative() : null;
  if (!mod) return { mod: null, reason: status.reason };
  if (typeof mod.saveWidgetArtPiece !== 'function' || typeof mod.getWidgetArtLibrary !== 'function' || typeof mod.setWidgetArtIndex !== 'function') {
    return { mod: null, reason: 'not-built' };
  }
  return { mod, reason: null };
}

async function readArtIndex(mod: NativeBridge): Promise<{ lib: WidgetArtIndex; dir: string }> {
  const raw = await mod.getWidgetArtLibrary?.();
  const index = raw && typeof raw.index === 'string' ? raw.index : null;
  const dir = raw && typeof raw.dir === 'string' ? raw.dir : '';
  return { lib: parseLibrary(index), dir };
}

function addToArtLibrary(piece: Omit<WidgetArtPiece, 'file'>, from: WidgetArtSourceFile): Promise<WidgetsResult> {
  return serialArt(() => addToArtLibraryNow(piece, from));
}

async function addToArtLibraryNow(piece: Omit<WidgetArtPiece, 'file'>, from: WidgetArtSourceFile): Promise<WidgetsResult> {
  try {
    const { mod, reason } = await artBridge();
    if (!mod) return { available: false, ok: false, reason };
    if (!isValidPieceId(piece.id) || !(WIDGET_ART_SOURCES as readonly string[]).includes(from)) return { available: true, ok: false, reason: 'failed' };
    if ((await mod.saveWidgetArtPiece?.(piece.id, from)) !== true) return { available: true, ok: false, reason: 'failed' };
    const { lib } = await readArtIndex(mod);
    let next = addPiece(lib, piece);
    // T238: adding a theme's art replaces the previous theme's auto-added art.
    if (piece.source !== 'photo' && piece.themeId) next = { ...next, lib: replaceThemeArt(next.lib, piece.themeId).lib };
    // T259: the piece came from the seamless-<size>.png just written: unpinned widgets show it.
    const size = seamlessFileSize(from);
    const pinned = size ? pinLastApplied(next.lib, size) : null;
    const ok = (await mod.setWidgetArtIndex?.(serializeLibrary(pinned ?? next.lib))) === true;
    return { available: true, ok, reason: ok ? null : 'failed' };
  } catch {
    return { available: true, ok: false, reason: 'failed' };
  }
}

async function artLibrary(): Promise<ArtLibraryResult> {
  try {
    const { mod, reason } = await artBridge();
    if (!mod) return { available: false, ok: false, reason, pieces: [], dir: '' };
    const { lib, dir } = await readArtIndex(mod);
    return { available: true, ok: true, reason: null, pieces: listPieces(lib), dir };
  } catch {
    return { available: true, ok: false, reason: 'failed', pieces: [], dir: '' };
  }
}

function removeFromArtLibrary(id: string): Promise<WidgetsResult> {
  return serialArt(() => removeFromArtLibraryNow(id));
}

async function removeFromArtLibraryNow(id: string): Promise<WidgetsResult> {
  try {
    const { mod, reason } = await artBridge();
    if (!mod) return { available: false, ok: false, reason };
    const { lib } = await readArtIndex(mod);
    const ok = (await mod.setWidgetArtIndex?.(serializeLibrary(removePiece(lib, id)))) === true;
    return { available: true, ok, reason: ok ? null : 'failed' };
  } catch {
    return { available: true, ok: false, reason: 'failed' };
  }
}

async function setWidgetArt(input: WidgetArtInput): Promise<WidgetsResult> {
  try {
    const status = await isAvailable();
    const mod = status.available ? loadNative() : null;
    if (!mod) return { available: false, ok: false, reason: status.reason };
    if (typeof mod.setWidgetArt !== 'function') return { available: false, ok: false, reason: 'not-built' };
    if (input.preserveArtwork && typeof mod.setClockArt !== 'function') return { available: false, ok: false, reason: 'not-built' };
    if (!validWidgetArtInput(input)) return { available: true, ok: false, reason: 'failed' };
    const res = await run((m) => input.preserveArtwork
      ? m.setClockArt?.(input.artUri, Math.round(input.widthPx), Math.round(input.heightPx), input.colour, input.size)
      : m.setWidgetArt?.(input.artUri, Math.round(input.widthPx), Math.round(input.heightPx), input.background, input.colour, input.fit, input.size));
    if (res.ok) await showLastApplied(input.size);
    return res;
  } catch {
    return { available: true, ok: false, reason: 'failed' };
  }
}

async function linkStatus(): Promise<WidgetLinkResult> {
  const none = (reason: WidgetsReason, available = false): WidgetLinkResult => ({ ...NO_WIDGET_LINK, available, reason });
  try {
    const status = await isAvailable();
    const mod = status.available ? loadNative() : null;
    if (!mod) return none(status.reason);
    // Older bridge (built before T146): the link can't be checked, which is not the same as broken.
    if (typeof mod.linkStatus !== 'function') return none('not-built', true);
    const raw = await mod.linkStatus();
    return { ...normaliseWidgetLinkStatus(raw), reason: null };
  } catch {
    // Unknown, not broken: supported stays false so nothing is shown.
    return none('failed', true);
  }
}

async function setSeamless(input: SeamlessInput): Promise<WidgetsResult> {
  try {
    const status = await isAvailable();
    const mod = status.available ? loadNative() : null;
    if (!mod) return { available: false, ok: false, reason: status.reason };
    if (typeof mod.setSeamless !== 'function') return { available: false, ok: false, reason: 'not-built' };
    if (!validSeamlessInput(input)) return { available: true, ok: false, reason: 'failed' };
    const c = input.cropPx;
    const res = await run((m) =>
      m.setSeamless?.(
        input.wallpaperUri,
        Math.round(c.x),
        Math.round(c.y),
        Math.round(c.w),
        Math.round(c.h),
        input.heroUri ?? '',
        input.size,
      ),
    );
    if (res.ok) await showLastApplied(input.size);
    return res;
  } catch {
    return { available: true, ok: false, reason: 'failed' };
  }
}
