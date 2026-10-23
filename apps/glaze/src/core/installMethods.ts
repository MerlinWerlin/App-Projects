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
};

/** Methods to offer, in display order. Shortcuts is always available. */
export function availableMethods(opts: MethodOptions): InstallChoice[] {
  return opts.profileEnabled ? ['bulk', 'shortcuts'] : ['shortcuts'];
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
 */
export function effectiveChoice(saved: InstallChoice, opts: MethodOptions): InstallChoice {
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
