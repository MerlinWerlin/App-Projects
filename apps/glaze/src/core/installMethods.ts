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
 * Methods to offer (owner 25 Oct, glaze-retest B: "this can't be the main method, no one will do
 * it, I don't even think we should make it an option"). When Bulk can be used it is the ONLY
 * method offered; the guided Shortcuts path is no longer a choice. Shortcuts only remains as the
 * fallback when Bulk can't work at all: the switch is off (App Review) or no picked app has a link
 * a profile can open. Apps without a link inside a Bulk plan are still listed on the screen (the
 * profile can't carry them), but Shortcuts is not offered as a method next to Bulk.
 */
export function availableMethods(opts: MethodOptions): InstallChoice[] {
  return bulkSelectable(opts) ? ['bulk'] : ['shortcuts'];
}

/**
 * The method to badge "Recommended": Bulk whenever it can be used (also without the Safari server:
 * the share-sheet route stays, with its warning). Kept as a function so the server flag can matter
 * again in one place.
 */
export function recommendedMethod(opts: MethodOptions): InstallChoice {
  void serverOk(opts);
  return bulkSelectable(opts) ? 'bulk' : 'shortcuts';
}

/** True when the method picker is worth showing (more than one method). */
export function showMethodPicker(opts: MethodOptions): boolean {
  return availableMethods(opts).length > 1;
}

/** True when the screen shows the Bulk card (the one method), false for the Shortcuts-only text. */
export function showBulkCard(opts: MethodOptions): boolean {
  return availableMethods(opts).includes('bulk');
}

/** Whether the Bulk card can be picked (offered and at least one app has a link). */
export function bulkSelectable(opts: MethodOptions): boolean {
  return opts.profileEnabled && opts.profileCount > 0;
}

/**
 * The method actually in use: Bulk whenever it can be used, whatever was saved before (an old
 * saved 'shortcuts' choice no longer keeps people on Shortcuts), else the Shortcuts fallback.
 * `saved` and `explicit` are kept for the callers' signature.
 */
export function effectiveChoice(saved: InstallChoice, opts: MethodOptions, explicit: boolean = true): InstallChoice {
  void saved;
  void explicit;
  return bulkSelectable(opts) ? 'bulk' : 'shortcuts';
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
