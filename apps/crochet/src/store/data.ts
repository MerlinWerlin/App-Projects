// Projects + stash store. Local-first: every change is saved to AsyncStorage (debounced, flushed when the app
// goes to the background), no account, no network. One in-memory undo stack for counter/pattern taps.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  DATA_KEY,
  emptyData,
  mergeData,
  newProject,
  parseData,
  serializeData,
  type AppData,
  type Counter,
  type Project,
  type UndoEntry,
  type Yarn,
} from '../core/model';

let data: AppData = emptyData();
let ready = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const undo: UndoEntry[] = [];
const BACKUP_KEY = `${DATA_KEY}.prev`;

function emit() {
  for (const l of listeners) l();
}

async function persistNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    await AsyncStorage.setItem(DATA_KEY, serializeData(data));
  } catch {
    // Storage full or unavailable: keep going in memory; next change retries.
  }
}

function schedule() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistNow().catch(() => {});
  }, 250);
}

AppState.addEventListener('change', (s) => {
  if (s !== 'active') persistNow().catch(() => {});
});

export async function loadData(): Promise<void> {
  if (ready) return;
  try {
    const raw = await AsyncStorage.getItem(DATA_KEY);
    data = parseData(raw);
    // Keep the previous good copy one launch behind: a safety net against a bad write.
    if (raw && data.projects.length + data.yarns.length > 0) await AsyncStorage.setItem(BACKUP_KEY, raw);
    if (raw && data.projects.length === 0 && data.yarns.length === 0) {
      const prev = parseData(await AsyncStorage.getItem(BACKUP_KEY));
      if (prev.projects.length + prev.yarns.length > 0) data = prev;
    }
  } catch {
    data = emptyData();
  }
  ready = true;
  emit();
}

function set(next: AppData) {
  data = next;
  emit();
  schedule();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getData = () => data;
const getReady = () => ready;

export function useData(): AppData {
  return useSyncExternalStore(subscribe, getData, getData);
}

export function useDataReady(): boolean {
  return useSyncExternalStore(subscribe, getReady, getReady);
}

export function useProject(id: string | undefined): Project | undefined {
  const d = useData();
  return id ? d.projects.find((p) => p.id === id) : undefined;
}

export function getProject(id: string): Project | undefined {
  return data.projects.find((p) => p.id === id);
}

export function snapshot(): AppData {
  return data;
}

// ---------------------------------------------------------------- projects

export function addProject(name: string, patch: Partial<Project> = {}): Project {
  const p = newProject(name, Date.now(), patch);
  set({ ...data, projects: [p, ...data.projects] });
  return p;
}

export function updateProject(id: string, fn: (p: Project) => Project, touch = true): void {
  set({
    ...data,
    projects: data.projects.map((p) => (p.id === id ? { ...fn(p), updatedAt: touch ? Date.now() : p.updatedAt } : p)),
  });
}

export function deleteProject(id: string): Project | undefined {
  const p = getProject(id);
  set({ ...data, projects: data.projects.filter((x) => x.id !== id) });
  return p;
}

export function restoreProject(p: Project): void {
  if (getProject(p.id)) return;
  set({ ...data, projects: [p, ...data.projects] });
}

export function duplicateProject(id: string): Project | undefined {
  const src = getProject(id);
  if (!src) return undefined;
  return addProject(`${src.name} (copy)`, {
    hookMm: src.hookMm,
    yarnIds: src.yarnIds,
    yarnNote: src.yarnNote,
    designer: src.designer,
    patternUrl: src.patternUrl,
    files: src.files,
    pattern: src.pattern ? { ...src.pattern, step: 0, done: [] } : undefined,
    counters: src.counters.map((c) => ({ ...c, value: 0 })),
    reminders: src.reminders,
    tags: src.tags,
    status: 'planned',
  });
}

/** Change counters with an undo point. */
export function changeCounters(id: string, fn: (cs: Counter[]) => Counter[], step?: number): void {
  const p = getProject(id);
  if (!p) return;
  undo.push({ projectId: id, counters: p.counters, step: p.pattern?.step, at: Date.now() });
  if (undo.length > 100) undo.shift();
  updateProject(id, (q) => {
    const counters = fn(q.counters);
    const pattern = q.pattern && step != null ? { ...q.pattern, step } : q.pattern;
    return { ...q, counters, pattern, status: q.status === 'planned' ? 'active' : q.status };
  });
}

export function canUndo(id: string): boolean {
  return undo.some((u) => u.projectId === id);
}

export function undoLast(id: string): boolean {
  for (let i = undo.length - 1; i >= 0; i--) {
    if (undo[i].projectId === id) {
      const u = undo.splice(i, 1)[0];
      updateProject(id, (q) => ({
        ...q,
        counters: u.counters,
        pattern: q.pattern && u.step != null ? { ...q.pattern, step: u.step } : q.pattern,
      }));
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- stash

export function saveYarn(y: Yarn): void {
  const exists = data.yarns.some((x) => x.id === y.id);
  set({ ...data, yarns: exists ? data.yarns.map((x) => (x.id === y.id ? y : x)) : [y, ...data.yarns] });
}

export function deleteYarn(id: string): void {
  set({
    ...data,
    yarns: data.yarns.filter((y) => y.id !== id),
    projects: data.projects.map((p) => (p.yarnIds.includes(id) ? { ...p, yarnIds: p.yarnIds.filter((x) => x !== id) } : p)),
  });
}

// ---------------------------------------------------------------- backup

export function importData(incoming: AppData, mode: 'merge' | 'replace'): void {
  set(mode === 'replace' ? incoming : mergeData(data, incoming));
}

export async function flush(): Promise<void> {
  await persistNow();
}
