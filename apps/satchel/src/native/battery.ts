// Battery adapter (expo-battery) for low-battery essentials mode. Reads the level, charging state and Low Power
// Mode once, then follows the phone's change events while anything is listening, plus a re-read whenever the app
// comes back to the foreground. Every call is guarded: where the battery can't be read (web, iOS simulator reports
// -1, a native error) the value is null and nothing throws, so Expo Go and simulators never crash.
// One shared subscription for the whole app, however many screens use the hook.
import * as Battery from 'expo-battery';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { normaliseLevel, UNKNOWN_READING, type BatteryReading } from '../core/battery.ts';

/** Charging (or full on the charger) -> true, unplugged -> false, unknown -> null. */
function chargingOf(state: unknown): boolean | null {
  try {
    if (state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL) return true;
    if (state === Battery.BatteryState.UNPLUGGED) return false;
  } catch {
    // enum missing: unknown
  }
  return null;
}

/** The level as a fraction 0..1, or null when it can't be read. */
export async function getBatteryLevel(): Promise<number | null> {
  try {
    return normaliseLevel(await Battery.getBatteryLevelAsync());
  } catch {
    return null;
  }
}

/** Low Power Mode / battery saver on, or null when unknown. */
export async function getLowPowerMode(): Promise<boolean | null> {
  try {
    return (await Battery.isLowPowerModeEnabledAsync()) === true;
  } catch {
    return null;
  }
}

async function available(): Promise<boolean> {
  try {
    return (await Battery.isAvailableAsync()) === true;
  } catch {
    return false;
  }
}

/** One full reading. Unknown everywhere when the battery API isn't available. */
export async function readBattery(): Promise<BatteryReading> {
  if (!(await available())) return UNKNOWN_READING;
  try {
    const p = await Battery.getPowerStateAsync();
    return { level: normaliseLevel(p?.batteryLevel), charging: chargingOf(p?.batteryState), lowPower: typeof p?.lowPowerMode === 'boolean' ? p.lowPowerMode : null };
  } catch {
    // getPowerStateAsync failed: try the single calls one by one
  }
  let charging: boolean | null = null;
  try {
    charging = chargingOf(await Battery.getBatteryStateAsync());
  } catch {
    charging = null;
  }
  return { level: await getBatteryLevel(), charging, lowPower: await getLowPowerMode() };
}

type Sub = { remove: () => void } | null;
const listen = (fn: () => Sub): Sub => {
  try {
    return fn();
  } catch {
    return null;
  }
};

let current: BatteryReading = UNKNOWN_READING;
const listeners = new Set<() => void>();
let subs: Sub[] = [];
let seq = 0;

function publish(next: BatteryReading) {
  if (next.level === current.level && next.charging === current.charging && next.lowPower === current.lowPower) return;
  current = next;
  listeners.forEach((l) => l());
}

function refresh() {
  const mine = ++seq;
  readBattery()
    .then((r) => {
      if (mine === seq && listeners.size) publish(r);
    })
    .catch(() => {});
}

function start() {
  refresh();
  subs = [
    listen(() => Battery.addBatteryLevelListener((e) => publish({ ...current, level: normaliseLevel(e?.batteryLevel) }))),
    listen(() => Battery.addBatteryStateListener((e) => publish({ ...current, charging: chargingOf(e?.batteryState) }))),
    listen(() => Battery.addLowPowerModeListener((e) => publish({ ...current, lowPower: typeof e?.lowPowerMode === 'boolean' ? e.lowPowerMode : null }))),
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

/** The latest battery reading; fields are null until (or wherever) the phone can tell us. */
export function useBattery(): BatteryReading {
  return useSyncExternalStore(subscribe, () => current);
}
