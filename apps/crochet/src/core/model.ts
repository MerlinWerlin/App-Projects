// Data model + pure updates for projects, counters, yarn stash. Pure TS: persisted as JSON by src/store.

import type { Terms } from './terms.ts';

export type ProjectStatus = 'planned' | 'active' | 'finished' | 'frogged';

export interface Counter {
  id: string;
  label: string;
  value: number;
  /** Optional goal (e.g. 20 rows). */
  target?: number;
  /**
   * Repeat counter: counts 1..every then wraps to 1 and bumps `parentId` (e.g. a 4-row stripe repeat that
   * advances the "repeats" counter). Undefined = plain counter.
   */
  every?: number;
  parentId?: string;
  /** Linked to the pattern: moving this counter moves the pattern step. One per project. */
  drivesPattern?: boolean;
}

export interface Reminder {
  id: string;
  /** Fires when the main counter value v satisfies v >= from && (v - from) % every === 0. */
  from: number;
  every: number;
  /** Stop after this row (inclusive); undefined = forever. */
  until?: number;
  text: string;
}

export interface PatternFile {
  id: string;
  uri: string;
  name: string;
  kind: 'image' | 'pdf';
  /** Highlighter bar position, 0..1 of the page height, and height. */
  barY?: number;
  barH?: number;
  /** Last zoom/scroll, best effort. */
  page?: number;
}

export interface ProjectPhoto {
  uri: string;
  at: number;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  cover?: string;
  photos: ProjectPhoto[];
  hookMm?: number;
  yarnIds: string[];
  /** Free text: yarn not in the stash, where the pattern came from. */
  yarnNote?: string;
  patternUrl?: string;
  designer?: string;
  notes: string;
  counters: Counter[];
  reminders: Reminder[];
  pattern?: {
    text: string;
    terms: Terms;
    /** Index into parsed steps. */
    step: number;
    /** Steps the user ticked off. */
    done: number[];
  };
  files: PatternFile[];
  /** Time worked, ms, plus a running start time when the timer is on. */
  timeMs: number;
  timerStart?: number;
  tags: string[];
  /** Accent colour key for the card. */
  colour: string;
  pinned?: boolean;
}

export interface Yarn {
  id: string;
  brand: string;
  name: string;
  colour: string;
  /** A hex swatch the user picked. */
  swatch?: string;
  cyc?: number;
  fibre?: string;
  metresPerBall?: number;
  gramsPerBall?: number;
  balls: number;
  photo?: string;
  notes?: string;
  createdAt: number;
}

export interface UndoEntry {
  projectId: string;
  counters: Counter[];
  step?: number;
  at: number;
}

export const CARD_COLOURS = ['rose', 'sage', 'butter', 'sky', 'lilac', 'peach', 'mint', 'clay'] as const;
export type CardColour = (typeof CARD_COLOURS)[number];

let seq = 0;
export function newId(prefix = 'id'): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function newCounter(label = 'Row', patch: Partial<Counter> = {}): Counter {
  return { id: newId('c'), label, value: 0, ...patch };
}

export function newProject(name: string, now = Date.now(), patch: Partial<Project> = {}): Project {
  const colour = CARD_COLOURS[Math.abs(hash(name + now)) % CARD_COLOURS.length];
  return {
    id: newId('p'),
    name: name.trim() || 'New project',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    photos: [],
    yarnIds: [],
    notes: '',
    counters: [newCounter('Row', { drivesPattern: true })],
    reminders: [],
    files: [],
    timeMs: 0,
    tags: [],
    colour,
    ...patch,
  };
}

export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// ---------------------------------------------------------------------------------------------------------
// Counters

/** Add `delta` to a counter, handling repeat wrap and parent bump. Never goes below 0. Returns new array. */
export function bump(counters: Counter[], id: string, delta: 1 | -1): Counter[] {
  const list = counters.map((c) => ({ ...c }));
  const c = list.find((x) => x.id === id);
  if (!c) return counters;
  const parent = c.parentId ? list.find((x) => x.id === c.parentId) : undefined;
  const every = c.every && c.every > 0 ? c.every : 0;
  if (delta > 0) {
    // Repeat counters run 1..every; finishing a repeat (reaching `every`) bumps the parent.
    c.value = every && c.value >= every ? 1 : c.value + 1;
    if (every && c.value === every && parent) parent.value += 1;
  } else if (every && c.value === every) {
    c.value -= 1;
    if (parent && parent.value > 0) parent.value -= 1;
  } else if (every && c.value <= 1 && parent && parent.value > 0) {
    // Step back into the previous (completed) repeat: show its last row; the parent already counted it.
    c.value = every;
  } else if (c.value > 0) {
    c.value -= 1;
  }
  return list;
}

export function setValue(counters: Counter[], id: string, value: number): Counter[] {
  const v = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return counters.map((c) => (c.id === id ? { ...c, value: c.every ? Math.min(v, c.every) : v } : c));
}

export function resetCounter(counters: Counter[], id: string): Counter[] {
  return counters.map((c) => (c.id === id ? { ...c, value: 0 } : c));
}

export function mainCounter(p: Project): Counter | undefined {
  return p.counters.find((c) => c.drivesPattern) ?? p.counters[0];
}

/** Reminders due on row/round `v` of the main counter. */
export function dueReminders(reminders: Reminder[], v: number): Reminder[] {
  return reminders.filter(
    (r) => r.every > 0 && v >= r.from && (r.until == null || v <= r.until) && (v - r.from) % r.every === 0,
  );
}

/** Progress 0..1 toward the counter target, or undefined. */
export function progress(c: Counter): number | undefined {
  if (!c.target || c.target <= 0) return undefined;
  return Math.min(1, c.value / c.target);
}

// ---------------------------------------------------------------------------------------------------------
// Timer

export function timeWorked(p: Project, now = Date.now()): number {
  return p.timeMs + (p.timerStart ? Math.max(0, now - p.timerStart) : 0);
}

export function startTimer(p: Project, now = Date.now()): Project {
  if (p.timerStart) return p;
  return { ...p, timerStart: now };
}

export function stopTimer(p: Project, now = Date.now()): Project {
  if (!p.timerStart) return p;
  return { ...p, timeMs: timeWorked(p, now), timerStart: undefined };
}

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, '0')} min`;
}

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// ---------------------------------------------------------------------------------------------------------
// Lists

const STATUS_ORDER: Record<ProjectStatus, number> = { active: 0, planned: 1, finished: 2, frogged: 3 };

export function sortProjects(ps: Project[]): Project[] {
  return ps.slice().sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return b.updatedAt - a.updatedAt;
  });
}

export interface Stats {
  active: number;
  finished: number;
  totalMs: number;
  rows: number;
  thisYearFinished: number;
}

export function stats(ps: Project[], now = Date.now()): Stats {
  const year = new Date(now).getFullYear();
  let rows = 0;
  let totalMs = 0;
  for (const p of ps) {
    totalMs += timeWorked(p, now);
    const m = mainCounter(p);
    if (m) rows += m.value;
  }
  return {
    active: ps.filter((p) => p.status === 'active').length,
    finished: ps.filter((p) => p.status === 'finished').length,
    thisYearFinished: ps.filter((p) => p.status === 'finished' && p.finishedAt && new Date(p.finishedAt).getFullYear() === year)
      .length,
    totalMs,
    rows,
  };
}

export function yarnMetres(y: Yarn): number | undefined {
  return y.metresPerBall ? Math.round(y.metresPerBall * y.balls) : undefined;
}

// ---------------------------------------------------------------------------------------------------------
// Persistence (versioned, tolerant)

export interface AppData {
  v: 1;
  projects: Project[];
  yarns: Yarn[];
}

export const DATA_KEY = 'crochet.data.v1';

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function str(x: unknown, d = ''): string {
  return typeof x === 'string' ? x : d;
}
function num(x: unknown, d = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : d;
}
function optNum(x: unknown): number | undefined {
  return typeof x === 'number' && Number.isFinite(x) ? x : undefined;
}
function optStr(x: unknown): string | undefined {
  return typeof x === 'string' && x ? x : undefined;
}

function parseCounter(x: unknown): Counter | null {
  if (!isObj(x)) return null;
  return {
    id: str(x.id) || newId('c'),
    label: str(x.label, 'Row'),
    value: Math.max(0, Math.floor(num(x.value))),
    target: optNum(x.target),
    every: optNum(x.every),
    parentId: optStr(x.parentId),
    drivesPattern: x.drivesPattern === true ? true : undefined,
  };
}

function parseProject(x: unknown): Project | null {
  if (!isObj(x) || typeof x.id !== 'string') return null;
  const now = Date.now();
  const status = (['planned', 'active', 'finished', 'frogged'] as const).find((s) => s === x.status) ?? 'active';
  const counters = Array.isArray(x.counters) ? (x.counters.map(parseCounter).filter(Boolean) as Counter[]) : [];
  const pattern = isObj(x.pattern)
    ? {
        text: str(x.pattern.text),
        terms: (x.pattern.terms === 'UK' ? 'UK' : 'US') as Terms,
        step: Math.max(0, Math.floor(num(x.pattern.step))),
        done: Array.isArray(x.pattern.done) ? x.pattern.done.filter((n): n is number => typeof n === 'number') : [],
      }
    : undefined;
  return {
    id: x.id,
    name: str(x.name, 'Project'),
    status,
    createdAt: num(x.createdAt, now),
    updatedAt: num(x.updatedAt, now),
    finishedAt: optNum(x.finishedAt),
    cover: optStr(x.cover),
    photos: Array.isArray(x.photos)
      ? (x.photos.filter((p) => isObj(p) && typeof p.uri === 'string') as ProjectPhoto[])
      : [],
    hookMm: optNum(x.hookMm),
    yarnIds: Array.isArray(x.yarnIds) ? x.yarnIds.filter((s): s is string => typeof s === 'string') : [],
    yarnNote: optStr(x.yarnNote),
    patternUrl: optStr(x.patternUrl),
    designer: optStr(x.designer),
    notes: str(x.notes),
    counters: counters.length ? counters : [newCounter('Row', { drivesPattern: true })],
    reminders: Array.isArray(x.reminders)
      ? (x.reminders.filter((r) => isObj(r) && typeof r.text === 'string' && typeof r.every === 'number') as Reminder[])
      : [],
    pattern,
    files: Array.isArray(x.files)
      ? (x.files.filter((f) => isObj(f) && typeof f.uri === 'string') as PatternFile[])
      : [],
    timeMs: num(x.timeMs),
    timerStart: optNum(x.timerStart),
    tags: Array.isArray(x.tags) ? x.tags.filter((s): s is string => typeof s === 'string') : [],
    colour: str(x.colour, 'rose'),
    pinned: x.pinned === true ? true : undefined,
  };
}

function parseYarn(x: unknown): Yarn | null {
  if (!isObj(x) || typeof x.id !== 'string') return null;
  return {
    id: x.id,
    brand: str(x.brand),
    name: str(x.name),
    colour: str(x.colour),
    swatch: optStr(x.swatch),
    cyc: optNum(x.cyc),
    fibre: optStr(x.fibre),
    metresPerBall: optNum(x.metresPerBall),
    gramsPerBall: optNum(x.gramsPerBall),
    balls: Math.max(0, num(x.balls, 1)),
    photo: optStr(x.photo),
    notes: optStr(x.notes),
    createdAt: num(x.createdAt, Date.now()),
  };
}

export function emptyData(): AppData {
  return { v: 1, projects: [], yarns: [] };
}

export function parseData(raw: string | null | undefined): AppData {
  if (!raw) return emptyData();
  try {
    const x: unknown = JSON.parse(raw);
    if (!isObj(x)) return emptyData();
    return {
      v: 1,
      projects: Array.isArray(x.projects) ? (x.projects.map(parseProject).filter(Boolean) as Project[]) : [],
      yarns: Array.isArray(x.yarns) ? (x.yarns.map(parseYarn).filter(Boolean) as Yarn[]) : [],
    };
  } catch {
    return emptyData();
  }
}

export function serializeData(d: AppData): string {
  return JSON.stringify(d);
}

/** Backup file (export/import). Same shape with a marker so we never import random JSON. */
export function toBackup(d: AppData, now = Date.now()): string {
  return JSON.stringify({ app: 'crochet-companion', exportedAt: now, data: d }, null, 1);
}

export function fromBackup(raw: string): AppData | null {
  try {
    const x: unknown = JSON.parse(raw);
    if (!isObj(x) || x.app !== 'crochet-companion' || !isObj(x.data)) return null;
    return parseData(JSON.stringify(x.data));
  } catch {
    return null;
  }
}

/** Merge a backup into existing data: items with the same id are replaced by the newer updatedAt. */
export function mergeData(a: AppData, b: AppData): AppData {
  const projects = new Map(a.projects.map((p) => [p.id, p]));
  for (const p of b.projects) {
    const cur = projects.get(p.id);
    if (!cur || p.updatedAt >= cur.updatedAt) projects.set(p.id, p);
  }
  const yarns = new Map(a.yarns.map((y) => [y.id, y]));
  for (const y of b.yarns) yarns.set(y.id, y);
  return { v: 1, projects: [...projects.values()], yarns: [...yarns.values()] };
}
