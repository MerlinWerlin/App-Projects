// Profile server adapter (T126). The native module `GlazeProfileServer`
// (modules/glaze-profile-server) serves the icon profile to Safari from 127.0.0.1 on this iPhone.
// It only exists in iOS native builds. Everywhere else (Expo Go, Android, builds made before the
// module existed) this adapter reports "unavailable" and the install screen falls back to the
// share sheet and recommends Shortcuts. Nothing here ever throws.
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import {
  PROFILE_SERVER_MODULE,
  PROFILE_SERVER_TIMEOUT_S,
  landingPageJson,
  parseServerStart,
  type LandingPageText,
  type ServerStart,
} from '../core/profileServer';

export type ProfileServerReason = 'expo-go' | 'android' | 'not-built' | null;
export type ProfileServerAvailability = { available: boolean; reason: ProfileServerReason };

/**
 * - opened: the server is up and Safari was asked to open the landing page
 * - unavailable: no native module here (use the share sheet)
 * - failed: the server would not start or Safari would not open
 */
export type ProfileServeOutcome =
  | { kind: 'opened'; url: string; profileUrl: string }
  | { kind: 'unavailable' }
  | { kind: 'failed'; message: string };

type NativeProfileServer = {
  start(path: string, pageJson: string, timeoutSeconds: number): Promise<unknown>;
  stop(): unknown;
  isServing?(): boolean;
  fetchCount?(): number;
};

function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

let cached: NativeProfileServer | null | undefined;

function loadNative(): NativeProfileServer | null {
  if (cached !== undefined) return cached;
  let found: NativeProfileServer | null = null;
  try {
    const mod =
      typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule<NativeProfileServer>(PROFILE_SERVER_MODULE)
        : null;
    found = mod && typeof mod.start === 'function' && typeof mod.stop === 'function' ? mod : null;
  } catch {
    found = null;
  }
  cached = found;
  return found;
}

/** Synchronous, so the install screen can pick its default method on first render. */
function status(): ProfileServerAvailability {
  try {
    if (Platform.OS !== 'ios') return { available: false, reason: 'android' };
    if (isExpoGo()) return { available: false, reason: 'expo-go' };
    if (!loadNative()) return { available: false, reason: 'not-built' };
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'not-built' };
  }
}

function stop(): void {
  try {
    const mod = cached ?? null;
    if (mod) mod.stop();
  } catch {
    // Nothing to stop.
  }
}

/**
 * Serve the saved profile file and open it in the real Safari (Linking.openURL, not an in-app
 * browser: SFSafariViewController is not a documented profile install route).
 */
async function serveAndOpen(fileUri: string, page: LandingPageText): Promise<ProfileServeOutcome> {
  try {
    if (!status().available) return { kind: 'unavailable' };
    const mod = loadNative();
    if (!mod) return { kind: 'unavailable' };
    let started: ServerStart | null = null;
    try {
      started = parseServerStart(await mod.start(fileUri, landingPageJson(page), PROFILE_SERVER_TIMEOUT_S));
    } catch (e) {
      return { kind: 'failed', message: e instanceof Error ? e.message : String(e) };
    }
    if (!started) {
      stop();
      return { kind: 'failed', message: 'The profile server returned an unexpected address.' };
    }
    try {
      await Linking.openURL(started.url);
    } catch (e) {
      stop();
      return { kind: 'failed', message: e instanceof Error ? e.message : String(e) };
    }
    return { kind: 'opened', url: started.url, profileUrl: started.profileUrl };
  } catch (e) {
    return { kind: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
}

/** How often Safari fetched the profile since the last start (0 when unknown). */
function fetchCount(): number {
  try {
    const mod = cached ?? null;
    const n = mod && typeof mod.fetchCount === 'function' ? mod.fetchCount() : 0;
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export const profileServer = { status, serveAndOpen, stop, fetchCount };
