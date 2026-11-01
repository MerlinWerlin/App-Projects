// T229: "the app does it for them". After launch (T250: at most once per 24 h) and after every
// "Use this theme" / icon install, ask iOS which of the popular apps in src/core/installedProbe.ts
// are installed and tick them in Icon Studio. Apps the person removes are remembered, so the check
// never adds them back. In Expo Go / Android / builds without the Info.plist list every answer is
// false and nothing changes. Nothing leaves the phone.
// T250: it runs only as the deferred 'installedProbe' step (src/store/launchWork.ts, after the first
// screen, one step at a time) and asks PROBE_CHUNK schemes per tick, yielding the JS thread between.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { chunked } from '../core/deferredWork';
import {
  PROBE_CHUNK,
  PROBE_LAST_RUN_KEY,
  autoSelect,
  clearUnticked,
  installedIdsFrom,
  markUnticked,
  parseProbeLastRun,
  parseProbeState,
  probeDue,
  schemesToQuery,
  serializeProbeState,
  withFound,
  type ProbeReason,
  type ProbeState,
} from '../core/installedProbe';
import { probeSchemes } from '../native/installedApps';
import { yieldToUi } from './deferredWork';
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

/** T250: PROBE_CHUNK canOpenURL answers per tick, the JS thread yields between chunks. */
async function probeInChunks(): Promise<Record<string, boolean>> {
  const answers: Record<string, boolean> = {};
  const parts = chunked(schemesToQuery(), PROBE_CHUNK);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) await yieldToUi();
    Object.assign(answers, await probeSchemes(parts[i]!));
  }
  return answers;
}

/** Probe and auto-select. Never throws; concurrent calls share one run. */
export function runInstalledProbe(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const answers = await probeInChunks();
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

/**
 * T250: the deferred 'installedProbe' step. A launch ('launch') probes at most once per
 * PROBE_INTERVAL_MS (24 h); a theme apply or icon install always does. Never throws.
 */
export async function runInstalledProbeStep(reason: ProbeReason): Promise<void> {
  let last: number | null = null;
  try {
    last = parseProbeLastRun(await AsyncStorage.getItem(PROBE_LAST_RUN_KEY));
  } catch {
    last = null;
  }
  if (!probeDue(last, Date.now(), reason)) return;
  await runInstalledProbe();
  try {
    await AsyncStorage.setItem(PROBE_LAST_RUN_KEY, String(Date.now()));
  } catch {
    // Probes again next launch: harmless.
  }
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
