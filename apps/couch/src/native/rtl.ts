/**
 * Right-to-left switching (owner-1016 R3). React Native fixes the layout direction at bundle start,
 * so a change between Arabic and the other languages needs I18nManager.forceRTL plus an app reload.
 * Everything is guarded (D4-1): where react-native is missing (tests, Node) nothing throws and no reload
 * happens. Store builds have no OTA updates (1.0.4, Guideline 5.6), so they cannot reload the bundle: the
 * new direction applies when the person reopens Couch (see LanguagePicker). Development builds reload. The remote's physical controls opt out of mirroring via src/ui/NeverMirror.
 */
import { needsDirectionChange } from '../i18n/direction';
import { isRtl, type AnyLocale } from '../i18n/locales';

declare const require: (id: string) => unknown;
declare const __DEV__: boolean | undefined;

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

/** True only in a development build (Metro). Store builds return false. */
export function canReloadApp(): boolean {
  try {
    return typeof __DEV__ !== 'undefined' && __DEV__ === true;
  } catch {
    return false;
  }
}

/**
 * Reload the JS bundle in development builds only (react-native DevSettings.reload). Store builds
 * do nothing here: the direction set by forceRTL applies on the next launch. Never throws.
 */
export async function reloadAppFallback(): Promise<void> {
  if (!canReloadApp()) return;
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
