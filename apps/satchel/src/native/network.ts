// Network adapter (expo-network) for the offline banner. The module is required lazily inside try/catch and every
// call is guarded, so a build or platform without it (Expo Go web, a native error) reads 'unknown' and nothing
// throws. One shared subscription for the whole app: a first read, the phone's change events while anything is
// listening, and a re-read whenever the app comes back to the foreground (flight mode is usually toggled outside).
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { netStatus, type NetStatus } from '../core/network.ts';

type NetworkModule = typeof import('expo-network');
type Sub = { remove: () => void } | null;

let cached: NetworkModule | null | undefined;
function loadNetwork(): NetworkModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-network') as NetworkModule;
    cached = mod && typeof mod.getNetworkStateAsync === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** One reading: 'online', 'offline', or 'unknown' wherever the phone can't say. */
export async function readNetwork(): Promise<NetStatus> {
  const mod = loadNetwork();
  if (!mod) return 'unknown';
  try {
    return netStatus(await mod.getNetworkStateAsync());
  } catch {
    return 'unknown';
  }
}

let current: NetStatus = 'unknown';
const listeners = new Set<() => void>();
let subs: Sub[] = [];
let seq = 0;

function publish(next: NetStatus) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

function refresh() {
  const mine = ++seq;
  readNetwork()
    .then((s) => {
      if (mine === seq && listeners.size) publish(s);
    })
    .catch(() => {});
}

const listen = (fn: () => Sub): Sub => {
  try {
    return fn();
  } catch {
    return null;
  }
};

function start() {
  refresh();
  const mod = loadNetwork();
  subs = [
    mod && typeof mod.addNetworkStateListener === 'function' ? listen(() => mod.addNetworkStateListener((e) => publish(netStatus(e)))) : null,
    listen(() => AppState.addEventListener('change', (s) => s === 'active' && refresh())),
  ];
}

function stop() {
  for (const s of subs) {
    try {
      s?.remove();
    } catch {
      // already gone
    }
  }
  subs = [];
  seq++;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stop();
  };
}

/** The latest connection status; 'unknown' until (or wherever) the phone can tell us. */
export function useNetworkStatus(): NetStatus {
  return useSyncExternalStore(subscribe, () => current);
}
