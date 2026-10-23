/**
 * Right-to-left switching (owner-1016 R3). React Native fixes the layout direction at bundle start,
 * so a change between Arabic and the other languages needs I18nManager.forceRTL plus an app reload.
 * Everything is guarded (D4-1): where react-native / expo-updates are missing (tests, Node) nothing
 * throws and no reload happens. The remote's physical controls opt out of mirroring via src/ui/NeverMirror.
 */
import { needsDirectionChange } from '../i18n/direction';
import { reloadApp } from './updates';
import { isRtl, type AnyLocale } from '../i18n/locales';

declare const require: (id: string) => unknown;

export interface I18nManagerLike {
  isRTL: boolean;
  allowRTL(allow: boolean): void;
  forceRTL(force: boolean): void;
  swapLeftAndRightInRTL?(swap: boolean): void;
}

export interface RtlDeps {
  i18n: I18nManagerLike | null;
  /** Restarts the JS bundle so the new direction applies. */
  reload: () => Promise<void> | void;
}

function loadI18nManager(): I18nManagerLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { I18nManager?: I18nManagerLike } | null;
    return rn?.I18nManager ?? null;
  } catch {
    return null;
  }
}

/**
 * Reload the app. src/native/updates.ts (reloadApp) is owned by another task; until it lands this is
 * a local fallback: expo-updates reloadAsync (release builds), else DevSettings.reload (development).
 */
export async function reloadAppFallback(): Promise<void> {
  try {
    if (await reloadApp()) return;
  } catch {
    // fall through to the local fallback below
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const updates = require('expo-updates') as { reloadAsync?: () => Promise<void> } | null;
    if (typeof updates?.reloadAsync === 'function') {
      await updates.reloadAsync();
      return;
    }
  } catch {
    // fall through to DevSettings
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { DevSettings?: { reload?: (reason?: string) => void } } | null;
    rn?.DevSettings?.reload?.('Layout direction changed');
  } catch {
    // nothing else we can do; the direction applies on next launch
  }
}

function defaultDeps(): RtlDeps {
  return { i18n: loadI18nManager(), reload: reloadAppFallback };
}

/** Running layout direction (false where react-native is unavailable). */
export function currentIsRtl(deps: Pick<RtlDeps, 'i18n'> = defaultDeps()): boolean {
  try {
    return !!deps.i18n?.isRTL;
  } catch {
    return false;
  }
}

/**
 * allowRTL(true), then forceRTL(wanted) + swapLeftAndRightInRTL(true). Returns true when the running
 * layout differs from the locale (a reload is needed for it to show). forceRTL is written even when
 * the running layout already matches: an earlier "Later" may have stored the opposite flag for the
 * next launch, and this puts it back.
 */
function force(locale: AnyLocale, i18n: I18nManagerLike): boolean {
  i18n.allowRTL(true);
  const differs = needsDirectionChange(locale, !!i18n.isRTL);
  i18n.forceRTL(isRtl(locale));
  i18n.swapLeftAndRightInRTL?.(true);
  return differs;
}

/**
 * Apply the locale's direction now: if it differs from the running layout, forceRTL and reload the
 * app. Resolves true when a reload was requested. Never throws.
 */
export async function applyDirection(locale: AnyLocale, deps: RtlDeps = defaultDeps()): Promise<boolean> {
  try {
    if (!deps.i18n) return false;
    if (!force(locale, deps.i18n)) return false;
    try {
      await deps.reload();
    } catch {
      // reload failed: the direction still applies on next launch
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * App start: make the stored direction match the locale WITHOUT reloading (applies on next launch).
 * Returns true when forceRTL changed. Never throws.
 */
export function syncDirectionOnStart(locale: AnyLocale, deps: Pick<RtlDeps, 'i18n'> = defaultDeps()): boolean {
  try {
    if (!deps.i18n) return false;
    return force(locale, deps.i18n);
  } catch {
    return false;
  }
}
