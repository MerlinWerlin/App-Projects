// T229: "the app does it for them". Once per launch (after the first render, off the startup path)
// and after every "Use this theme", ask iOS which of the popular apps in src/core/installedProbe.ts
// are installed and tick them in Icon Studio. Apps the person removes are remembered, so the check
// never adds them back. In Expo Go / Android / builds without the Info.plist list every answer is
// false and nothing changes. Nothing leaves the phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  autoSelect,
  clearUnticked,
  installedIdsFrom,
  markUnticked,
  parseProbeState,
  schemesToQuery,
  serializeProbeState,
  withFound,
  type ProbeState,
} from '../core/installedProbe';
import { probeSchemes } from '../native/installedApps';
import { updateStudio } from './studio';

const KEY = 'glaze.installedProbe.v1';

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<ProbeState> {
  try {
    return parseProbeState(await AsyncStorage.getItem(KEY));
  } catch {
    return parseProbeState(null);
  }
}

async function write(s: ProbeState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, serializeProbeState(s));
  } catch {
    // Storage unavailable: keep going.
  }
}

type Listener = (s: ProbeState) => void;
const listeners = new Set<Listener>();

function change(fn: (s: ProbeState) => ProbeState): Promise<void> {
  return serial(async () => {
    const s = await read();
    const next = fn(s);
    if (next === s) return;
    await write(next);
    for (const l of listeners) l(next);
  }).catch(() => undefined);
}

/** The person removed an app from their icons: auto-select must never add it back. */
export function recordUntick(id: string): void {
  void change((s) => markUnticked(s, id));
}

/** The person ticked an app again. */
export function recordTick(id: string): void {
  void change((s) => clearUnticked(s, id));
}

let running: Promise<void> | null = null;

/** Probe and auto-select. Never throws; concurrent calls share one run. */
export function runInstalledProbe(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const answers = await probeSchemes(schemesToQuery());
      const installed = installedIdsFrom(answers);
      if (installed.length === 0) return; // Expo Go, Android or nothing found: do nothing.
      await serial(async () => {
        const probe = await read();
        const unticked = new Set(probe.unticked);
        const after = await updateStudio((st) => {
          const selected = autoSelect(st.selected, installed, unticked);
          return selected === st.selected ? st : { ...st, selected: [...selected] };
        });
        const next = withFound(probe, installed, after.selected);
        await write(next);
        for (const l of listeners) l(next);
      });
    } catch {
      // Never let the check break the app.
    } finally {
      running = null;
    }
  })();
  return running;
}

let launched = false;

/** Once per launch, delayed so it stays off startup. */
export function runInstalledProbeOnLaunch(delayMs: number = 2000): () => void {
  if (launched) return () => undefined;
  launched = true;
  const id = setTimeout(() => {
    void runInstalledProbe();
  }, delayMs);
  return () => {
    // Unmounted before it ran (dev double-mount): let the next mount schedule it.
    clearTimeout(id);
    launched = false;
  };
}

/** How many probed apps are on this iPhone and in the icon set (0 = show no note). */
export function useInstalledFound(): number {
  const [found, setFound] = useState(0);
  useEffect(() => {
    let alive = true;
    read()
      .then((s) => {
        if (alive) setFound(s.foundIds.length);
      })
      .catch(() => undefined);
    const l: Listener = (s) => setFound(s.foundIds.length);
    listeners.add(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, []);
  return found;
}
