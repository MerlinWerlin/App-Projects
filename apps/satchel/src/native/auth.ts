// Device authentication for the document vault (Face ID / Touch ID with the device passcode as fallback).
// Every call is guarded: nothing here throws, and in Expo Go (where the Face ID usage string or the native module
// may be missing) any throw becomes reason 'unavailable', which the UI handles without crashing.
import * as LocalAuthentication from 'expo-local-authentication';
import { authState, type PermissionState } from '../core/permissions.ts';

export type AuthFailure = 'cancelled' | 'not-enrolled' | 'no-hardware' | 'unavailable' | 'error';
/** `permission` is the Face ID state for PermissionNotice ('unavailable' = the phone cannot lock; 'ask' = try again). */
export type AuthResult = { ok: true } | { ok: false; reason: AuthFailure; permission: PermissionState };
const fail = (reason: AuthFailure): AuthResult => ({ ok: false, reason, permission: authState(reason) });
/** What the unlock button can honestly promise. */
export type AuthMethod = 'face' | 'fingerprint' | 'passcode' | 'none';

/** Reasons where the device cannot lock the vault at all, so the UI may offer "Open without lock this time". */
export const CANNOT_LOCK: readonly AuthFailure[] = ['no-hardware', 'not-enrolled', 'unavailable'];

async function settle<T>(p: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await p();
  } catch {
    return fallback;
  }
}

/** Best available method, for the button label. Never throws. */
export async function authMethod(): Promise<AuthMethod> {
  const level = await settle(() => LocalAuthentication.getEnrolledLevelAsync(), null);
  if (level === LocalAuthentication.SecurityLevel.NONE) return 'none';
  const enrolled = await settle(() => LocalAuthentication.isEnrolledAsync(), false);
  if (enrolled) {
    const types = await settle(() => LocalAuthentication.supportedAuthenticationTypesAsync(), []);
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  }
  return level == null ? 'none' : 'passcode';
}

/** Why the device cannot authenticate, or null when it can (biometrics or at least a passcode). */
async function blocker(): Promise<AuthFailure | null> {
  const level = await settle<LocalAuthentication.SecurityLevel | 'threw'>(() => LocalAuthentication.getEnrolledLevelAsync(), 'threw');
  if (level !== 'threw') {
    if (level !== LocalAuthentication.SecurityLevel.NONE) return null; // a passcode or biometrics are set up
    const hw = await settle(() => LocalAuthentication.hasHardwareAsync(), false);
    return hw ? 'not-enrolled' : 'no-hardware';
  }
  // Older native module without getEnrolledLevelAsync: fall back to the two basic checks.
  const hw = await settle<boolean | 'threw'>(() => LocalAuthentication.hasHardwareAsync(), 'threw');
  if (hw === 'threw') return 'unavailable';
  if (!hw) return 'no-hardware';
  const enrolled = await settle<boolean | 'threw'>(() => LocalAuthentication.isEnrolledAsync(), 'threw');
  if (enrolled === 'threw') return 'unavailable';
  return enrolled ? null : 'not-enrolled';
}

function mapError(e: LocalAuthentication.LocalAuthenticationError | string): AuthFailure {
  switch (e) {
    case 'user_cancel':
    case 'app_cancel':
    case 'system_cancel':
    case 'user_fallback':
      return 'cancelled';
    case 'not_enrolled':
    case 'passcode_not_set':
      return 'not-enrolled';
    case 'not_available':
    case 'invalid_context':
      return 'unavailable';
    default:
      return 'error';
  }
}

let inFlight: Promise<AuthResult> | null = null;

/**
 * Asks the system to authenticate. `promptMessage` and the labels must already be translated.
 * Device passcode fallback stays on (disableDeviceFallback: false). Concurrent calls share one prompt.
 */
export function authenticate(promptMessage: string, cancelLabel?: string, fallbackLabel?: string): Promise<AuthResult> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<AuthResult> => {
    try {
      const block = await blocker();
      if (block) return fail(block);
      const res = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, fallbackLabel, disableDeviceFallback: false });
      if (res.success) return { ok: true };
      return fail(mapError(res.error));
    } catch {
      return fail('unavailable');
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
