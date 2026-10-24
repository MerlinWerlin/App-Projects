// Which icon install methods /install offers (T60). The profile method sits behind ONE switch,
// PROFILE_INSTALL_ENABLED in src/config/install.ts; this file holds the pure logic so the screen
// never has to reason about it. Pure TS (no React Native / Expo).

import type { InstallChoice, InstallPlan } from './install.ts';
import type { TipId } from './tips.ts';

export type MethodOptions = {
  /** PROFILE_INSTALL_ENABLED. */
  profileEnabled: boolean;
  /** How many apps could go in a profile (planInstall(...).profile.length). */
  profileCount: number;
  /**
   * T126: whether this build can serve the profile to Safari (src/native/profileServer.ts).
   * Omitted = true (the original behaviour). False (Expo Go, old builds): the profile can only go
   * through the share sheet, which iOS often won't install from, so Shortcuts leads.
   */
  profileServer?: boolean;
};

const serverOk = (opts: MethodOptions) => opts.profileServer !== false;

/**
 * Methods to offer, in display order (the recommended one first). Shortcuts is always available
 * and always first (T138, owner 24 Oct: the profile never reached Settings on his iPhone, so the
 * guided Shortcuts path is the default; Bulk stays a second, optional "try it" card while
 * PROFILE_INSTALL_ENABLED is on).
 */
export function availableMethods(opts: MethodOptions): InstallChoice[] {
  if (!opts.profileEnabled) return ['shortcuts'];
  return ['shortcuts', 'bulk'];
}

/**
 * The method to badge "Recommended": always the guided Shortcuts method (T138). Kept as a function
 * (with the server flag) so a device-verified profile route can be promoted again in one place.
 */
export function recommendedMethod(opts: MethodOptions): InstallChoice {
  void serverOk(opts);
  return 'shortcuts';
}

/** True when the method picker is worth showing (more than one method). */
export function showMethodPicker(opts: MethodOptions): boolean {
  return availableMethods(opts).length > 1;
}

/** Whether the Bulk card can be picked (offered and at least one app has a link). */
export function bulkSelectable(opts: MethodOptions): boolean {
  return opts.profileEnabled && opts.profileCount > 0;
}

/**
 * The method actually in use: the saved choice when it is still possible, else Shortcuts.
 * A saved 'bulk' falls back to 'shortcuts' when the switch is off or no app has a link.
 * `explicit` is false while the saved choice is only the default (nobody tapped a card yet): then
 * the recommended method wins, so builds without the Safari server open on Shortcuts (T126).
 */
export function effectiveChoice(saved: InstallChoice, opts: MethodOptions, explicit: boolean = true): InstallChoice {
  if (!explicit) return recommendedMethod(opts);
  if (saved === 'bulk' && bulkSelectable(opts)) return 'bulk';
  return 'shortcuts';
}

export type SummaryKind = 'none' | 'viaShortcuts' | 'viaProfile' | 'mixed';

/** Which summary line to show, with the counts it needs. */
export function installSummary(
  plan: InstallPlan,
  profileEnabled: boolean,
): { kind: SummaryKind; profile: number; shortcuts: number } {
  const p = plan.profile.length;
  const s = plan.shortcuts.length;
  if (p + s === 0) return { kind: 'none', profile: 0, shortcuts: 0 };
  if (!profileEnabled || p === 0) return { kind: 'viaShortcuts', profile: 0, shortcuts: p + s };
  if (s === 0) return { kind: 'viaProfile', profile: p, shortcuts: 0 };
  return { kind: 'mixed', profile: p, shortcuts: s };
}

/** Tips that only make sense with the profile method. */
export const PROFILE_TIP_IDS: readonly TipId[] = Object.freeze(['bulk-install', 'install-not-verified'] as const);

/** Drop profile-only tips when the profile method is off (keeps order). */
export function tipsForInstallMode<T extends string>(ids: readonly T[], profileEnabled: boolean): T[] {
  if (profileEnabled) return [...ids];
  const hide = new Set<string>(PROFILE_TIP_IDS);
  return ids.filter((id) => !hide.has(id));
}

/** Ids of the "undo / remove" guide for icons made with Shortcuts (catalogue: install.shortcuts.undo.<id>). */
export const SHORTCUT_UNDO_STEPS: readonly ['removeIcon', 'deleteShortcut', 'restoreOriginal'] = Object.freeze([
  'removeIcon',
  'deleteShortcut',
  'restoreOriginal',
] as const);
