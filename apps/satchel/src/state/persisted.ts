// Keyed, persisted state shared across screens without a Provider (so features can add stores without touching
// app/_layout.tsx). Values load from AsyncStorage once per key and save on every change; failures stay in memory.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

type Entry = { value: unknown; loaded: boolean; loading?: Promise<void>; listeners: Set<() => void> };
const entries = new Map<string, Entry>();

function entry(key: string, fallback: unknown): Entry {
  let e = entries.get(key);
  if (!e) {
    e = { value: fallback, loaded: false, listeners: new Set() };
    entries.set(key, e);
  }
  return e;
}

function load(key: string, fallback: unknown): Promise<void> {
  const e = entry(key, fallback);
  if (e.loaded) return Promise.resolve();
  if (!e.loading) {
    e.loading = AsyncStorage.getItem(key)
      .then((raw) => {
        if (raw != null) e.value = JSON.parse(raw);
      })
      .catch(() => {})
      .finally(() => {
        e.loaded = true;
        e.listeners.forEach((l) => l());
      });
  }
  return e.loading;
}

export function setPersisted<T>(key: string, next: T | ((old: T) => T), fallback: T): void {
  const e = entry(key, fallback);
  e.value = typeof next === 'function' ? (next as (old: T) => T)(e.value as T) : next;
  e.listeners.forEach((l) => l());
  AsyncStorage.setItem(key, JSON.stringify(e.value)).catch(() => {});
}

/**
 * Like setPersisted, but waits for the write: true once stored; on a failed write the in-memory value goes back
 * to what it was and the result is false (T45: an import that can't save its packing list rolls back).
 */
export async function setPersistedChecked<T>(key: string, next: T | ((old: T) => T), fallback: T): Promise<boolean> {
  await load(key, fallback);
  const e = entry(key, fallback);
  const before = e.value;
  e.value = typeof next === 'function' ? (next as (old: T) => T)(e.value as T) : next;
  e.listeners.forEach((l) => l());
  try {
    await AsyncStorage.setItem(key, JSON.stringify(e.value));
    return true;
  } catch {
    e.value = before;
    e.listeners.forEach((l) => l());
    return false;
  }
}

/** [value, set, loaded]. `fallback` must be a stable value (a module-level constant). */
export function usePersisted<T>(key: string, fallback: T): [T, (next: T | ((old: T) => T)) => void, boolean] {
  const e = entry(key, fallback);
  const value = useSyncExternalStore(
    (cb) => {
      e.listeners.add(cb);
      return () => e.listeners.delete(cb);
    },
    () => e.value as T,
  );
  useEffect(() => {
    load(key, fallback);
  }, [key, fallback]);
  return [value, (next) => setPersisted(key, next, fallback), e.loaded];
}

/** Read outside React (e.g. the essentials screen assembling data). Loads first if needed. */
export async function readPersisted<T>(key: string, fallback: T): Promise<T> {
  await load(key, fallback);
  return entry(key, fallback).value as T;
}
