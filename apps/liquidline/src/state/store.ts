// Settings and jobs, persisted on this iPhone with AsyncStorage. Module-level stores read with useSyncExternalStore
// (no Provider), like src/state/access.ts. Nothing here ever leaves the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useEffect, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { JOBS_KEY, parseJobs, upsertJob, type Job } from '../core/jobs.ts';
import { SETTINGS_KEY, countryFromRegion, defaultsFor, parseSettings, type Settings } from '../core/settings.ts';

export function deviceRegion(): string | null {
  try {
    const l = getLocales();
    return l.find((x) => x.regionCode)?.regionCode ?? null;
  } catch {
    return null;
  }
}

function makeStore<T>(initial: T) {
  let value = initial;
  const ls = new Set<() => void>();
  return {
    get: () => value,
    set: (v: T) => {
      value = v;
      ls.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      ls.add(l);
      return () => {
        ls.delete(l);
      };
    },
  };
}

const settingsStore = makeStore<Settings>(defaultsFor(countryFromRegion(deviceRegion())));
const jobsStore = makeStore<Job[]>([]);
const loadedStore = makeStore(false);
let jobsLoadFailed = false;

let loading: Promise<void> | null = null;
export function loadAll(): Promise<void> {
  loading ??= (async () => {
    const fallback = countryFromRegion(deviceRegion());
    // Read each key on its own: a failed jobs read must never look like "no jobs", or the next save would overwrite
    // every saved job with one.
    try {
      settingsStore.set(parseSettings(await AsyncStorage.getItem(SETTINGS_KEY), fallback));
    } catch {
      settingsStore.set(defaultsFor(fallback));
    }
    try {
      jobsStore.set(parseJobs(await AsyncStorage.getItem(JOBS_KEY)));
    } catch {
      jobsLoadFailed = true;
    }
    loadedStore.set(true);
  })();
  return loading;
}

export function useLoaded(): boolean {
  useEffect(() => {
    void loadAll();
  }, []);
  return useSyncExternalStore(loadedStore.subscribe, loadedStore.get, loadedStore.get);
}

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}
export function getSettings(): Settings {
  return settingsStore.get();
}
export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Settings)): void {
  const cur = settingsStore.get();
  const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
  settingsStore.set(next);
  void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
}

export function useJobs(): Job[] {
  return useSyncExternalStore(jobsStore.subscribe, jobsStore.get, jobsStore.get);
}
export function useJob(id: string | undefined): Job | undefined {
  const jobs = useJobs();
  return jobs.find((j) => j.id === id);
}
function persistJobs(next: Job[]): boolean {
  if (jobsLoadFailed) {
    Alert.alert('Jobs not saved', 'Liquidline couldn’t read your saved jobs, so it won’t write over them. Close and reopen the app, then try again.');
    return false;
  }
  jobsStore.set(next);
  AsyncStorage.setItem(JOBS_KEY, JSON.stringify(next)).catch(() => {
    Alert.alert('Couldn’t save', 'Your iPhone didn’t store the change (storage full?). Free some space and try again.');
  });
  return true;
}
export function saveJob(job: Job): boolean {
  return persistJobs(upsertJob(jobsStore.get(), job));
}
export function deleteJob(id: string): Job | undefined {
  const cur = jobsStore.get();
  const gone = cur.find((j) => j.id === id);
  persistJobs(cur.filter((j) => j.id !== id));
  return gone;
}
export function getJobs(): Job[] {
  return jobsStore.get();
}
