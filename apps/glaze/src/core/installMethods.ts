// Which icon install methods /install offers (T60). The profile method sits behind ONE switch,
// PROFILE_INSTALL_ENABLED in src/config/install.ts; this file holds the pure logic so the screen
// never has to reason about it. Pure TS (no React Native / Expo).

import { type InstallChoice, type InstallPlan } from './install.ts';
import type { TipId } from './tips.ts';

export type MethodOptions = {
  /** PROFILE_INSTALL_ENABLED. */
  profileEnabled: boolean;
  /** How many apps could go in a profile (planInstall(...).profile.length). */
  profileCount: number;
  /**
   * T126: whether this build can serve the profile to Safari (src/native/profileServer.ts).
   * Omitted = true. False (Expo Go, old builds): the profile goes through the share sheet instead;
   * since T202 the profile stays the main method either way (the screen explains the share route).
   */
  profileServer?: boolean;
};

/**
 * Generation of the method choice. T183 (1 Nov 08:32) bumped it to 2 when Shortcuts became the
 * default; T202 (owner-1101d #5, 1 Nov 10:31) bumped it to 3 when "Install all at once" became the
 * main method again: an explicit pick saved before (choiceEpoch absent or lower) no longer counts,
 * so everyone lands on the profile.
 */
export const CHOICE_EPOCH = 3;

/** True when a saved state holds an explicit method pick made since the current default. */
export function isCurrentPick(s: { choiceExplicit?: true; choiceEpoch?: number }): boolean {
  return s.choiceExplicit === true && s.choiceEpoch === CHOICE_EPOCH;
}

/** Whether the profile ("Install all at once") can be used: switch on and some app has a link. */
export function bulkSelectable(opts: MethodOptions): boolean {
  return opts.profileEnabled && opts.profileCount > 0;
}

/**
 * Methods available, the main one first. T202 (owner-1101d #5, supersedes T183): "Install all at
 * once" (web clip profile) is ALWAYS the main method whenever it can be used; Shortcuts "Open App"
 * is only a fallback (a small link on the screen, not a second card) and covers the apps a profile
 * can't open.
 */
export function availableMethods(opts: MethodOptions): InstallChoice[] {
  return bulkSelectable(opts) ? ['bulk', 'shortcuts'] : ['shortcuts'];
}

/** The main method: the profile whenever it can be used, else Shortcuts. */
export function recommendedMethod(opts: MethodOptions): InstallChoice {
  return bulkSelectable(opts) ? 'bulk' : 'shortcuts';
}

/**
 * T202: no method picker any more. The profile is the main flow; switching to Shortcuts is one
 * small "Prefer Shortcuts?" link (showShortcutsFallback).
 */
export function showMethodPicker(_opts: MethodOptions): boolean {
  return false;
}

/** True when the "Prefer Shortcuts? One icon at a time" fallback link is worth showing. */
export function showShortcutsFallback(opts: MethodOptions): boolean {
  return bulkSelectable(opts);
}

/**
 * The method actually in use: the profile, unless the person explicitly took the Shortcuts
 * fallback since the T202 switch (`explicit`, see isCurrentPick) or the profile can't be used.
 */
export function effectiveChoice(saved: InstallChoice, opts: MethodOptions, explicit: boolean = true): InstallChoice {
  if (!bulkSelectable(opts)) return 'shortcuts';
  return explicit && saved === 'shortcuts' ? 'shortcuts' : 'bulk';
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
