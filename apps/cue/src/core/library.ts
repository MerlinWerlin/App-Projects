/**
 * Script library + prefs persistence over a tiny key-value interface. Pure TS; the AsyncStorage
 * adapter lives in src/native/kv.ts and tests use MemoryKv. Corrupt data never crashes: it is ignored.
 */
import { DEFAULT_WPM, autoTitle, clampWpm } from './script';

export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class MemoryKv implements KvStore {
  readonly data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

export interface Script {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  /** Per-script speed (each script remembers the pace you read it at). */
  wpm: number;
  pinned?: boolean;
  /** Last word reached in the prompter, to resume ("pick up where you left off"). */
  lastWord?: number;
  /** Rehearsal history: seconds each full read took (newest last, max 20). */
  takes?: number[];
}

export const LIBRARY_KEY = 'cue.library.v1';

export function newId(now = Date.now(), rnd = Math.random): string {
  return `${now.toString(36)}${Math.floor(rnd() * 1e8).toString(36)}`;
}

export function makeScript(body: string, title = '', now = Date.now()): Script {
  return { id: newId(now), title: title.trim(), body, createdAt: now, updatedAt: now, wpm: DEFAULT_WPM };
}

export function displayTitle(s: Pick<Script, 'title' | 'body'>, untitled: string): string {
  return s.title.trim() || autoTitle(s.body) || untitled;
}

function isScript(x: unknown): x is Script {
  const s = x as Script;
  return !!s && typeof s.id === 'string' && typeof s.body === 'string' && typeof s.updatedAt === 'number';
}

export function parseLibrary(raw: string | null): Script[] {
  if (!raw) return [];
  try {
    const doc = JSON.parse(raw) as { version?: number; scripts?: unknown[] };
    if (doc?.version !== 1 || !Array.isArray(doc.scripts)) return [];
    return doc.scripts.filter(isScript).map((s) => ({
      ...s,
      title: typeof s.title === 'string' ? s.title : '',
      createdAt: typeof s.createdAt === 'number' ? s.createdAt : s.updatedAt,
      wpm: clampWpm(s.wpm),
    }));
  } catch {
    return [];
  }
}

export function serializeLibrary(scripts: Script[]): string {
  return JSON.stringify({ version: 1, scripts });
}

/** Pinned first, then most recently edited. */
export function sortScripts(scripts: Script[]): Script[] {
  return [...scripts].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
}

export function searchScripts(scripts: Script[], q: string): Script[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return scripts;
  return scripts.filter((s) => s.title.toLowerCase().includes(needle) || s.body.toLowerCase().includes(needle));
}

export function upsert(scripts: Script[], s: Script): Script[] {
  const i = scripts.findIndex((x) => x.id === s.id);
  if (i < 0) return [s, ...scripts];
  const next = scripts.slice();
  next[i] = s;
  return next;
}

export function recordTake(s: Script, seconds: number): Script {
  const takes = [...(s.takes ?? []), Math.round(seconds)].slice(-20);
  return { ...s, takes };
}

export function duplicate(s: Script, copySuffix: string, now = Date.now()): Script {
  return { ...s, id: newId(now), title: `${s.title || autoTitle(s.body)} ${copySuffix}`.trim(), createdAt: now, updatedAt: now, pinned: false, takes: [], lastWord: 0 };
}

/** The starter script new users see: it teaches the markup by being read. */
export const WELCOME_BODY = `# Welcome to Cue
Read this out loud to try it. The line in the middle of the screen is your *reading line*.

[pause]

Tap anywhere to pause. Drag to scroll back. Pinch to make the text bigger.

# Little marks you can type
Wrap a word in stars to make it *stand out*. Type a cue in square brackets, like this one: [breathe]

[[Notes in double brackets are just for you. They are never read out.]]

---

# Try Voice Pace
Turn on Voice Pace and the words only move while you talk. Stop talking and they wait for you.`;
