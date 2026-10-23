// Live Lock Screen projects + playlist, persisted on-device with AsyncStorage.
// Parsing/validation lives in src/core/loop.ts so it is unit-tested.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from '../native/fs';
import {
  parseLoopsState,
  removeFromPlaylist,
  serializeLoopsState,
  type LoopProject,
  type LoopsState,
} from '../core/loop';

const KEY = 'glaze.loops';

// Every read waits for queued writes, and writes run one at a time, so a save made
// while leaving the editor can't race the Live tab reloading on focus.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<LoopsState> {
  try {
    const s = parseLoopsState(await AsyncStorage.getItem(KEY));
    return { projects: s.projects.map((p) => ({ ...p, sourceUri: resolveSourceUri(p.sourceUri) })), playlist: s.playlist };
  } catch {
    return { projects: [], playlist: [] };
  }
}

async function write(state: LoopsState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, serializeLoopsState(state));
  } catch {
    // Storage full or unavailable: keep the in-memory state; nothing else to do.
  }
}

export function loadLoops(): Promise<LoopsState> {
  return serial(read);
}

export function saveLoops(state: LoopsState): Promise<void> {
  return serial(() => write(state));
}

export async function getProject(id: string): Promise<LoopProject | null> {
  const s = await loadLoops();
  return s.projects.find((p) => p.id === id) ?? null;
}

/** Insert or replace a project (by id), stamping updatedAt. */
export function upsertProject(project: LoopProject): Promise<LoopsState> {
  return serial(async () => {
    const s = await read();
    const next: LoopProject = { ...project, updatedAt: Date.now() };
    const i = s.projects.findIndex((p) => p.id === project.id);
    const projects = i >= 0 ? s.projects.map((p, j) => (j === i ? next : p)) : [next, ...s.projects];
    const state = { projects, playlist: s.playlist };
    await write(state);
    return state;
  });
}

export function deleteProject(id: string): Promise<LoopsState> {
  return serial(async () => {
    const s = await read();
    const state = { projects: s.projects.filter((p) => p.id !== id), playlist: removeFromPlaylist(s.playlist, id) };
    await write(state);
    return state;
  });
}

export function setPlaylist(ids: string[]): Promise<LoopsState> {
  return serial(async () => {
    const s = await read();
    const known = new Set(s.projects.map((p) => p.id));
    const state = { projects: s.projects, playlist: ids.filter((x, i) => known.has(x) && ids.indexOf(x) === i) };
    await write(state);
    return state;
  });
}

// ---------------------------------------------------------------------------
// Source media: the picker hands back a cache file that iOS may purge, so keep
// a private copy in the app's documents folder. Falls back to the original URI.

function loopsDir(): string | null {
  const doc = FileSystem.documentDirectory;
  return doc ? `${doc}loops/` : null;
}

/**
 * iOS can move the app container between updates, so an absolute path to our own
 * copy is re-pointed at the current documents folder.
 */
function resolveSourceUri(uri: string): string {
  const dir = loopsDir();
  const m = /\/loops\/([^/]+)$/.exec(uri);
  return dir && m && !uri.startsWith(dir) ? `${dir}${m[1]}` : uri;
}

export async function keepSourceCopy(uri: string, id: string): Promise<string> {
  try {
    const dir = loopsDir();
    if (!dir) return uri;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = (/\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri)?.[1] ?? 'mov').toLowerCase();
    const dest = `${dir}${id}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/** Delete our private copy (never touches files outside the loops folder). */
export async function removeSourceCopy(uri: string): Promise<void> {
  try {
    const dir = loopsDir();
    if (dir && uri.startsWith(dir)) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best effort.
  }
}

// ---------------------------------------------------------------------------
// Large sources. Videos are only ever copied file-to-file (copyAsync) and played by the
// native player from disk; nothing here reads video bytes into JS memory.

export const LARGE_VIDEO_BYTES = 500 * 1024 * 1024;
export const LONG_VIDEO_MS = 10 * 60 * 1000;

/** Size of the file on disk (metadata only, no read), or null if unknown. */
export async function sourceFileBytes(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && typeof info.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
}

/** Which inline warning a very large or long video needs (null when the source is fine). */
export type LargeSourceIssue = 'big' | 'long' | 'bigAndLong';

/**
 * Inline warning kind for very large or long videos, or null when the source is fine. The editor
 * shows `t(`live.editor.largeSource.${issue}`)`, so the text follows the app language.
 */
export function largeSourceIssue(bytes: number | null, durationMs: number): LargeSourceIssue | null {
  const big = bytes !== null && bytes > LARGE_VIDEO_BYTES;
  const long = durationMs > LONG_VIDEO_MS;
  if (big && long) return 'bigAndLong';
  if (big) return 'big';
  if (long) return 'long';
  return null;
}
