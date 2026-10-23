// Install checklist (done steps per profile, ticked Shortcuts apps, last method) persisted
// with AsyncStorage. Parsing and toggles live in src/core/install.ts so they are unit-tested.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultInstallState,
  parseInstallState,
  serializeInstallState,
  type InstallState,
} from '../core/install';

export type { InstallState };

const KEY = 'glaze.install.v1';

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export function loadInstallState(): Promise<InstallState> {
  return serial(async () => {
    try {
      return parseInstallState(await AsyncStorage.getItem(KEY));
    } catch {
      return defaultInstallState();
    }
  });
}

export function saveInstallState(s: InstallState): Promise<void> {
  return serial(async () => {
    try {
      await AsyncStorage.setItem(KEY, serializeInstallState(s));
    } catch {
      // Storage unavailable: the checklist just resets next time.
    }
  });
}

/** Checklist state for the install screen; `update` applies a pure change and persists it. */
export function useInstallState(): {
  state: InstallState;
  loaded: boolean;
  update: (fn: (s: InstallState) => InstallState) => void;
} {
  const [state, setState] = useState<InstallState>(defaultInstallState);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<InstallState>(state);

  useEffect(() => {
    let alive = true;
    loadInstallState().then((s) => {
      if (!alive) return;
      ref.current = s;
      setState(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((fn: (s: InstallState) => InstallState) => {
    const next = fn(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    setState(next);
    saveInstallState(next);
  }, []);

  return { state, loaded, update };
}
