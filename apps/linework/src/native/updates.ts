// Over-the-air updates (EAS Update) adapter. expo-updates is required lazily inside try/catch so
// Expo Go, dev builds and a missing module can never crash the app. Nothing here ever throws.
import { DevSettings } from 'react-native';

type UpdatesModule = {
  isEnabled?: boolean;
  checkForUpdateAsync?: () => Promise<{ isAvailable?: boolean }>;
  fetchUpdateAsync?: () => Promise<unknown>;
  reloadAsync?: () => Promise<void>;
};

function isDev(): boolean {
  try {
    return typeof __DEV__ !== 'undefined' && __DEV__ === true;
  } catch {
    return false;
  }
}

function isExpoGo(): boolean {
  try {
    const mod = require('expo-constants') as { default?: Record<string, unknown> } & Record<string, unknown>;
    const c = (mod && (mod.default ?? mod)) as { executionEnvironment?: string; appOwnership?: string | null };
    return c.executionEnvironment === 'storeClient' || c.appOwnership === 'expo';
  } catch {
    // Can't tell: assume Expo Go so we stay quiet.
    return true;
  }
}

function loadUpdates(): UpdatesModule | null {
  try {
    const mod = require('expo-updates') as UpdatesModule & { default?: UpdatesModule };
    return mod ?? null;
  } catch {
    return null;
  }
}

/** True when this is a real (TestFlight / store / preview) build with EAS Update switched on. */
export function updatesActive(): boolean {
  if (isDev() || isExpoGo()) return false;
  const U = loadUpdates();
  return !!(U && U.isEnabled === true);
}

let checking = false;

/**
 * Checks for a newer JS update and downloads it in the background. The update applies the next
 * time the app is opened; the running session is never reloaded. Resolves true when a new update
 * was downloaded, false otherwise (including Expo Go, dev mode and any error).
 */
export async function checkForUpdateQuietly(): Promise<boolean> {
  if (checking) return false;
  if (!updatesActive()) return false;
  const U = loadUpdates();
  if (!U || typeof U.checkForUpdateAsync !== 'function' || typeof U.fetchUpdateAsync !== 'function') return false;
  checking = true;
  try {
    const result = await U.checkForUpdateAsync();
    if (!result || !result.isAvailable) return false;
    await U.fetchUpdateAsync();
    return true;
  } catch {
    return false;
  } finally {
    checking = false;
  }
}

/**
 * Restarts the app's JS: Updates.reloadAsync() in a real build, DevSettings.reload() in dev.
 * Resolves false when neither was possible.
 */
export async function reloadApp(): Promise<boolean> {
  if (updatesActive()) {
    const U = loadUpdates();
    if (U && typeof U.reloadAsync === 'function') {
      try {
        await U.reloadAsync();
        return true;
      } catch {
        // fall through to the dev reload
      }
    }
  }
  if (isDev()) {
    try {
      if (DevSettings && typeof DevSettings.reload === 'function') {
        DevSettings.reload();
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}
