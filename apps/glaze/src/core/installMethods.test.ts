import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHOICE_EPOCH,
  PROFILE_TIP_IDS,
  SHORTCUT_UNDO_STEPS,
  availableMethods,
  bulkSelectable,
  effectiveChoice,
  installSummary,
  isCurrentPick,
  recommendedMethod,
  showMethodPicker,
  showShortcutsFallback,
  tipsForInstallMode,
} from './installMethods.ts';
import { PROFILE_INSTALL_ENABLED } from '../config/install.ts';
import { DEFAULT_INSTALL_METHOD, defaultInstallState } from './install.ts';
import { en } from '../i18n/locales/en.ts';
import { readFileSync } from 'node:fs';

const plan = (p: number, s: number) =>
  ({ profile: Array.from({ length: p }), shortcuts: Array.from({ length: s }) }) as never;

test('switch is a boolean exported from src/config/install.ts', () => {
  assert.equal(typeof PROFILE_INSTALL_ENABLED, 'boolean');
});

test('T202 (owner-1101d #5, supersedes T183): Install all at once is the main method; Shortcuts only a fallback link', () => {
  assert.deepEqual(availableMethods({ profileEnabled: true, profileCount: 3 }), ['bulk', 'shortcuts']);
  assert.equal(recommendedMethod({ profileEnabled: true, profileCount: 3 }), 'bulk');
  assert.equal(recommendedMethod({ profileEnabled: true, profileCount: 3, profileServer: false }), 'bulk');
  // No picker any more, just the small fallback link.
  assert.equal(showMethodPicker({ profileEnabled: true, profileCount: 3 }), false);
  assert.equal(showShortcutsFallback({ profileEnabled: true, profileCount: 3 }), true);
  assert.equal(showShortcutsFallback({ profileEnabled: true, profileCount: 0 }), false);
  assert.equal(showShortcutsFallback({ profileEnabled: false, profileCount: 3 }), false);
  assert.deepEqual(availableMethods({ profileEnabled: true, profileCount: 0 }), ['shortcuts']);
  assert.deepEqual(availableMethods({ profileEnabled: false, profileCount: 3 }), ['shortcuts']);
  assert.equal(recommendedMethod({ profileEnabled: false, profileCount: 3 }), 'shortcuts');
  assert.equal(DEFAULT_INSTALL_METHOD, 'bulk');
  assert.equal(defaultInstallState().choice, 'bulk');
});

test('bulk selectable only when enabled and some app has a link', () => {
  assert.equal(bulkSelectable({ profileEnabled: true, profileCount: 1 }), true);
  assert.equal(bulkSelectable({ profileEnabled: true, profileCount: 0 }), false);
  assert.equal(bulkSelectable({ profileEnabled: false, profileCount: 5 }), false);
});

test('effectiveChoice: the profile unless the Shortcuts fallback was explicitly taken since the T202 switch', () => {
  const on = { profileEnabled: true, profileCount: 2 };
  assert.equal(effectiveChoice('bulk', on, true), 'bulk');
  assert.equal(effectiveChoice('bulk', on, false), 'bulk');
  assert.equal(effectiveChoice('shortcuts', on, true), 'shortcuts');
  assert.equal(effectiveChoice('shortcuts', on, false), 'bulk', 'an old (T183-era) Shortcuts pick no longer wins');
  assert.equal(effectiveChoice('bulk', { profileEnabled: false, profileCount: 2 }, true), 'shortcuts');
  assert.equal(effectiveChoice('bulk', { profileEnabled: true, profileCount: 0 }, true), 'shortcuts');
  assert.equal(CHOICE_EPOCH, 3);
  // A pick saved before the switch (no or an older epoch) no longer counts.
  assert.equal(isCurrentPick({ choiceExplicit: true }), false);
  assert.equal(isCurrentPick({ choiceExplicit: true, choiceEpoch: CHOICE_EPOCH - 1 }), false);
  assert.equal(isCurrentPick({ choiceExplicit: true, choiceEpoch: CHOICE_EPOCH }), true);
  assert.equal(isCurrentPick({ choiceEpoch: CHOICE_EPOCH }), false);
});

test('summary counts every app as Shortcuts when the switch is off', () => {
  assert.deepEqual(installSummary(plan(0, 0), true), { kind: 'none', profile: 0, shortcuts: 0 });
  assert.deepEqual(installSummary(plan(4, 2), true), { kind: 'mixed', profile: 4, shortcuts: 2 });
  assert.deepEqual(installSummary(plan(4, 0), true), { kind: 'viaProfile', profile: 4, shortcuts: 0 });
  assert.deepEqual(installSummary(plan(0, 3), true), { kind: 'viaShortcuts', profile: 0, shortcuts: 3 });
  assert.deepEqual(installSummary(plan(4, 2), false), { kind: 'viaShortcuts', profile: 0, shortcuts: 6 });
  assert.deepEqual(installSummary(plan(0, 0), false), { kind: 'none', profile: 0, shortcuts: 0 });
});

test('profile-only tips are hidden when the switch is off, order kept', () => {
  const ids = ['icons-added', 'bulk-install', 'live-lock', 'install-not-verified'];
  assert.deepEqual(tipsForInstallMode(ids, true), ids);
  assert.deepEqual(tipsForInstallMode(ids, false), ['icons-added', 'live-lock']);
  assert.deepEqual([...PROFILE_TIP_IDS].sort(), ['bulk-install', 'install-not-verified']);
});

test('every Shortcuts undo step has English text', () => {
  const undo = en.install.shortcuts.undo as Record<string, string>;
  assert.ok(undo.title.trim());
  for (const id of SHORTCUT_UNDO_STEPS) assert.ok(typeof undo[id] === 'string' && undo[id].trim(), id);
});

test('install screen and tips read the switch and the method helpers', () => {
  const screen = readFileSync(new URL('../../app/install.tsx', import.meta.url), 'utf8');
  assert.match(screen, /PROFILE_INSTALL_ENABLED/);
  assert.match(screen, /effectiveChoice\(/);
  assert.match(screen, /isCurrentPick\(install\.state\)/);
  assert.match(screen, /choiceEpoch: CHOICE_EPOCH/);
  assert.match(screen, /showShortcutsFallback\(/);
  // T202: no method cards / radio group, no "Recommended" Shortcuts badge; the fallback link and
  // the computed Safari-tap line are on screen.
  assert.ok(!screen.includes('MethodCard') && !screen.includes('radiogroup'));
  assert.ok(!screen.includes("install.method.recommended"));
  assert.ok(screen.includes("t('install.method.shortcutsFallback')"));
  assert.ok(screen.includes("t('install.method.backToBulk')"));
  assert.match(screen, /safariTapCount\(plan\.profile\)/);
  assert.ok(screen.includes("t('install.method.safariTapAll'") && screen.includes("t('install.method.safariTap'"));
  // fb-1022 G1: the first-run hints moved from the Themes screen into theme detail.
  const detail = readFileSync(new URL('../../app/theme/[id].tsx', import.meta.url), 'utf8');
  assert.match(detail, /tipsForInstallMode\(/);
});
