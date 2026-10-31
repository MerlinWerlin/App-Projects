// Which icon install methods /install offers (T60). The profile method sits behind ONE switch,
// PROFILE_INSTALL_ENABLED in src/config/install.ts; this file holds the pure logic so the screen
// never has to reason about it. Pure TS (no React Native / Expo).

import { DEFAULT_INSTALL_METHOD, type InstallChoice, type InstallPlan } from './install.ts';
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
 * T183: generation of the method choice. Bumped on 1 Nov 2026 when Shortcuts / Open App became
 * the default: an explicit pick saved before (choiceEpoch absent or lower) no longer counts.
 */
export const CHOICE_EPOCH = 2;

/** True when a saved state holds an explicit method pick made since the current default. */
export function isCurrentPick(s: { choiceExplicit?: true; choiceEpoch?: number }): boolean {
  return s.choiceExplicit === true && s.choiceEpoch === CHOICE_EPOCH;
}

/**
 * Methods to offer, the recommended one first. T183 (owner 1 Nov, supersedes owner 25 Oct "Bulk
 * is the only method"): the guided Shortcuts method with the "Open App" action is the default for
 * every app, because it opens apps directly with no Safari hop and no "Open in <app>?" prompt.
 * Bulk (web clip profile) is an optional second method only while PROFILE_INSTALL_ENABLED is true
 * and some picked app has a link a profile can open; the screen warns that its icons open through
 * Safari and ask every time.
 */
export function availableMethods(opts: MethodOptions): InstallChoice[] {
  return bulkSelectable(opts) ? ['shortcuts', 'bulk'] : ['shortcuts'];
}

/** The method to badge "Recommended": always Shortcuts / Open App (T183). */
export function recommendedMethod(opts: MethodOptions): InstallChoice {
  void serverOk(opts);
  return DEFAULT_INSTALL_METHOD;
}

/** True when the method picker is worth showing (more than one method). */
export function showMethodPicker(opts: MethodOptions): boolean {
  return availableMethods(opts).length > 1;
}

/** True when the Bulk card is offered (as the optional second method). */
export function showBulkCard(opts: MethodOptions): boolean {
  return availableMethods(opts).includes('bulk');
}

/** Whether the Bulk card can be picked (offered and at least one app has a link). */
export function bulkSelectable(opts: MethodOptions): boolean {
  return opts.profileEnabled && opts.profileCount > 0;
}

/**
 * The method actually in use. Shortcuts / Open App unless the person explicitly picked Bulk since
 * the 1 Nov switch (`explicit`, see isCurrentPick) and Bulk can still be used.
 */
export function effectiveChoice(saved: InstallChoice, opts: MethodOptions, explicit: boolean = true): InstallChoice {
  return explicit && saved === 'bulk' && bulkSelectable(opts) ? 'bulk' : DEFAULT_INSTALL_METHOD;
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
