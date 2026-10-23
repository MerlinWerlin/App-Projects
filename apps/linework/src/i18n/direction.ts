// Layout direction (right-to-left for Arabic; owner request 16 Oct, R3, docs/I18N.md "Right-to-left").
// React Native only switches the native layout direction after a reload, so changing between an LTR and an RTL
// language sets I18nManager.allowRTL/forceRTL and reloads the JS bundle (expo-updates when available, the dev
// reload in Expo Go / development) or asks the user to restart.
import { DevSettings, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocaleInfo } from './store.ts';

/** True when the current native layout is right-to-left. */
export function isRTL(): boolean {
  return I18nManager.isRTL;
}

/** True when the current language is written right-to-left (may differ from isRTL() until the reload). */
export function wantsRTL(): boolean {
  return getLocaleInfo().dir === 'rtl';
}

/** Picks the value for the current layout direction: swapIfRTL('left', 'right'), swapIfRTL(1, -1). */
export function swapIfRTL<T>(ltrValue: T, rtlValue: T): T {
  return I18nManager.isRTL ? rtlValue : ltrValue;
}

/**
 * Style for views that must never mirror: the camera preview, the traced image / outline overlay and its
 * transform maths, the compare view and the drawing canvas. Children inside lay out left-to-right even in Arabic,
 * so physical left/right/translateX there stay true to the photo. Mark the region `// rtl-physical-ok`.
 */
export const NEVER_MIRROR = { direction: 'ltr' } as const;

/** Feather icon name for a "forward / go deeper" chevron (points right in LTR, left in RTL). */
export function forwardChevron(): 'chevron-right' | 'chevron-left' {
  return I18nManager.isRTL ? 'chevron-left' : 'chevron-right';
}

/** Feather icon name for a "back" chevron / arrow (points left in LTR, right in RTL). */
export function backChevron(): 'chevron-left' | 'chevron-right' {
  return I18nManager.isRTL ? 'chevron-right' : 'chevron-left';
}

/** Feather icon name for a "back" arrow (arrow-left in LTR, arrow-right in RTL). */
export function backArrow(): 'arrow-left' | 'arrow-right' {
  return I18nManager.isRTL ? 'arrow-right' : 'arrow-left';
}

/** Feather icon name for a "forward" arrow (arrow-right in LTR, arrow-left in RTL). */
export function forwardArrow(): 'arrow-right' | 'arrow-left' {
  return I18nManager.isRTL ? 'arrow-left' : 'arrow-right';
}

export type DirectionResult = 'unchanged' | 'reloading' | 'restart-needed';

/** Remembers a reload we triggered so a direction that refuses to stick never loops reloads at launch. */
const ATTEMPT_KEY = 'linework.directionReload.v1';
const ATTEMPT_WINDOW_MS = 60_000;

type UpdatesModule = { isEnabled?: boolean; reloadAsync?: () => Promise<void> };

/** Reloads the JS bundle so the new native direction applies. Returns false when it cannot. */
async function reload(): Promise<boolean> {
  try {
    // Required lazily: expo-updates may be missing in Node tests or an older Expo Go, and must never crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as UpdatesModule;
    if (Updates.isEnabled && typeof Updates.reloadAsync === 'function') {
      await Updates.reloadAsync();
      return true;
    }
  } catch {
    // fall through to the development reload
  }
  try {
    if (__DEV__ && typeof DevSettings.reload === 'function') {
      DevSettings.reload('Switching layout direction');
      return true;
    }
  } catch {
    // no reload available
  }
  return false;
}

async function recentAttempt(wantRTL: boolean): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ATTEMPT_KEY);
    if (!raw) return false;
    const v = JSON.parse(raw) as { rtl?: boolean; at?: number };
    return v.rtl === wantRTL && typeof v.at === 'number' && Date.now() - v.at < ATTEMPT_WINDOW_MS;
  } catch {
    return false;
  }
}

async function rememberAttempt(wantRTL: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify({ rtl: wantRTL, at: Date.now() }));
  } catch {
    // best effort
  }
}

/**
 * Makes the native layout direction match the current language. Direction only changes after a reload, so this
 * sets allowRTL/forceRTL and then reloads the app when it can ('reloading'), otherwise returns 'restart-needed'
 * so the caller can tell the user to close and reopen Linework. Call it after setLanguage() in Settings.
 */
export async function applyLayoutDirection(): Promise<DirectionResult> {
  const want = wantsRTL();
  if (I18nManager.isRTL === want) return 'unchanged';
  try {
    I18nManager.allowRTL(want);
    I18nManager.forceRTL(want);
  } catch {
    return 'restart-needed';
  }
  // If we already reloaded for this direction a moment ago and it still did not apply, do not loop.
  if (await recentAttempt(want)) return 'restart-needed';
  await rememberAttempt(want);
  return (await reload()) ? 'reloading' : 'restart-needed';
}

/**
 * Launch check for the integrator: call once right after `await initI18n()` in the root layout. On the first launch
 * on an Arabic phone (or after the language changed while the app was closed) the native direction does not match
 * yet, so this flips it and reloads. Returns the same result as applyLayoutDirection(); on 'restart-needed' the
 * app keeps running in the old direction (text is still translated) and a later restart fixes it.
 */
export async function startupDirectionCheck(): Promise<DirectionResult> {
  try {
    return await applyLayoutDirection();
  } catch {
    return 'restart-needed';
  }
}
