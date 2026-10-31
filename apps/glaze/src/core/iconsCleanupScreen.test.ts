// T194 source guards: the "Clean up old icons" screen exists, is registered with a title, is linked
// from the Icons tab and the end of the install flow, gives the VPN & Device Management steps, and
// the install screen builds profiles with the per-install id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../i18n/ns/install/en.ts';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const SCREEN = 'app/icons-cleanup.tsx';

test('the cleanup screen exists and is registered with a translated title', () => {
  assert.ok(existsSync(join(ROOT, SCREEN)), SCREEN);
  assert.match(read('app/_layout.tsx'), /<Stack\.Screen\s+name="icons-cleanup"\s+options=\{\{\s*title:\s*t\('install\.cleanup\.title'\)/);
});

test('the Icons tab links to it', () => {
  const tab = read('app/(tabs)/icons.tsx');
  assert.ok(tab.includes("router.push('/icons-cleanup')"), 'push to /icons-cleanup');
  assert.ok(tab.includes("t('install.cleanup.title')"), 'row title');
});

test('the install flow links to it and shows the hide-originals tip', () => {
  const install = read('app/install.tsx');
  assert.ok(install.includes("router.push('/icons-cleanup')"));
  assert.ok(install.includes("t('install.cleanup.tipHide')"));
  assert.ok(install.includes("t('install.cleanup.removeOld'"), 'old icons note');
  assert.match(install, /buildInstallProfiles\([^)]*\{\s*installId\s*\}\)/, 'stable profile id');
});

test('the screen gives the VPN & Device Management, bookmark and App Library steps honestly', () => {
  const src = read(SCREEN);
  for (const k of ['profile1', 'profile2', 'profile3', 'hand1', 'hand2', 'hide1', 'hide2', 'intro']) {
    assert.ok(src.includes(`'install.cleanup.${k}'`), k);
  }
  const c = en.cleanup;
  assert.match(c.profile1, /Settings > General > VPN & Device Management/);
  assert.match(c.profile3, /Remove Profile/);
  assert.match(c.hand1, /Remove Bookmark/);
  assert.match(c.hand2, /jiggle/);
  assert.match(c.hide1, /Remove App.*Remove from Home Screen/);
  assert.match(c.hide2, /App Library/);
  assert.match(c.intro, /can’t delete Home Screen icons/);
  assert.match(c.tipHide, /Remove from Home Screen \(they stay in the App Library\)/);
});

test('the cleanup screen reads no Plus entitlement', () => {
  assert.ok(!/src\/plus/.test(read(SCREEN)));
});
