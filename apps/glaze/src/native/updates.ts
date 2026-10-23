// EAS Update adapter (T41, owner request R2). expo-updates is loaded lazily and only in real
// builds: Expo Go (executionEnvironment 'storeClient') and __DEV__ runs skip it entirely, so the
// trial can never crash here. Every function resolves; nothing throws to the caller.
// The only network traffic is expo-updates' own request to the EAS Update server.
import Constants from 'expo-constants';
import { updatesOffReason, type UpdateCheckOutcome, type UpdatesOffReason } from '../core/updates';

type UpdatesModule = typeof import('expo-updates');

let cached: UpdatesModule | null | undefined;

function isExpoGo(): boolean {
  return String(Constants.executionEnvironment ?? '') === 'storeClient';
}

function load(): UpdatesModule | null {
  if (cached !== undefined) return cached;
  let mod: UpdatesModule | null = null;
  if (!isExpoGo() && !__DEV__) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('expo-updates') as UpdatesModule;
    } catch {
      mod = null;
    }
  }
  cached = mod;
  return mod;
}

function configuredUrl(): string | null | undefined {
  const updates = (Constants.expoConfig as { updates?: { url?: string } } | null | undefined)?.updates;
  return updates ? (updates.url ?? null) : undefined;
}

/** Why updates are off in this run, or null when they are on. Never throws. */
export function updatesStatus(): UpdatesOffReason {
  if (isExpoGo()) return 'expo-go';
  if (__DEV__) return 'dev';
  const m = load();
  let enabled = false;
  try {
    enabled = Boolean(m?.isEnabled);
  } catch {
    enabled = false;
  }
  return updatesOffReason({
    executionEnvironment: String(Constants.executionEnvironment ?? ''),
    isDev: __DEV__,
    moduleLoaded: m !== null,
    moduleEnabled: enabled,
    updatesUrl: configuredUrl(),
  });
}

/** Ask EAS Update for a newer bundle on this build's channel and download it if there is one. */
export async function checkForUpdate(): Promise<UpdateCheckOutcome> {
  if (updatesStatus() !== null) return 'unavailable';
  const m = load();
  if (!m) return 'unavailable';
  try {
    const res = await m.checkForUpdateAsync();
    if (!res.isAvailable) return 'none';
    const fetched = await m.fetchUpdateAsync();
    return fetched.isNew ? 'downloaded' : 'none';
  } catch {
    return 'error';
  }
}

/** Restart into the newest downloaded bundle. Does nothing where updates are off. */
export async function reloadApp(): Promise<void> {
  if (updatesStatus() !== null) return;
  const m = load();
  if (!m) return;
  try {
    await m.reloadAsync();
  } catch {
    // Keep running the current bundle; the update applies on the next cold start anyway.
  }
}
