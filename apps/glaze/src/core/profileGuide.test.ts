// T262 (owner-1101i): the in-app profile install guide matches iOS 27 on the owner's iPhone
// (1 Nov 2026): Safari "Profile Downloaded" -> Close; Settings, "More for Your iPhone" under the
// Apple Account card; the "Profile Downloaded" card -> View Profile; the Install Profile sheet ->
// Install, passcode, Install. It keeps the older-iOS fallback (VPN & Device Management), draws
// each step as an original illustration, and never ships the owner's reference screenshots
// (docs/owner_screens_1101 show his name, photo and Wi-Fi).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GUIDE_ART_ILLUSTRATIONS, isGuideArt, profileStepCards } from './install.ts';
import { installGuide } from './mobileconfig.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test('the English install strings walk through More for Your iPhone and View Profile', () => {
  const en = read('src', 'i18n', 'ns', 'install', 'en.ts');
  assert.ok(en.includes('More for Your iPhone'));
  assert.ok(en.includes('View Profile'));
  assert.ok(en.includes('Apple Account'));
  assert.ok(en.includes('Install Profile'));
  assert.ok(en.includes('tap Close'));
  // Older iOS fallback stays.
  assert.ok(en.includes('Not there? Look for “Profile Downloaded” near the top of Settings, or General > VPN & Device Management'));
  assert.match(en, /VPN & Device Management > Downloaded Profile/);
  // The old "near the top (or VPN...)" wording is gone from the step copy.
  assert.ok(!en.includes('“Profile Downloaded” near the top (or General > VPN & Device Management)'));
});

test('the Safari route has one step per iOS 27 screen, each with a redrawn illustration', () => {
  const cards = profileStepCards(1, 'safari');
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  assert.equal(byId.allow.illustration, 'profile-downloaded');
  assert.equal(byId.more.illustration, 'settings-more');
  assert.equal(byId.view.illustration, 'more-view-profile');
  assert.equal(byId.settings.illustration, 'install-profile-sheet');
  assert.match(byId.more.body, /More for Your iPhone/);
  assert.match(byId.view.body, /View Profile/);
  assert.match(byId.settings.body, /Install \(top right\)/);
  for (const k of GUIDE_ART_ILLUSTRATIONS) assert.ok(isGuideArt(k), k);
  assert.equal(isGuideArt('safari-page'), false);
  // The share route's Settings card and the plain-text guide say the same.
  const share = profileStepCards(1, 'share').find((c) => c.id === 'install');
  assert.ok(share);
  assert.match(share.body, /More for Your iPhone/);
  assert.match(share.body, /View Profile/);
  assert.match(share.body, /VPN & Device Management/);
  assert.match(installGuide().join(' '), /More for Your iPhone.*View Profile.*VPN & Device Management/);
});

test('every locale has the new step and illustration keys', () => {
  const dir = join(root, 'src', 'i18n', 'ns', 'install');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts') && n !== 'index.ts')) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const key of ['      more: { title:', '      view: { title:', '  guideArt: {', 'settingsA11y:', 'viewProfile:']) {
      assert.ok(src.includes(key), `${f} lacks ${key.trim()}`);
    }
  }
});

test('the screen renders the illustrations with labels, in tokens, with placeholder content', () => {
  const screen = read('app', 'install.tsx');
  assert.match(screen, /<ProfileGuideArt kind=\{illustration\} \/>/);
  assert.ok(screen.includes('install.safari.cards.more.title'));
  assert.ok(screen.includes('install.safari.cards.view.title'));
  const art = read('src', 'ui', 'ProfileGuideArt.tsx');
  assert.match(art, /accessibilityLabel=\{label\}/);
  assert.match(art, /accessibilityRole="image"/);
  for (const k of ['downloadedA11y', 'settingsA11y', 'moreA11y', 'sheetA11y']) assert.ok(art.includes(`install.guideArt.${k}`), k);
  assert.ok(art.includes('install.guideArt.yourName'), 'placeholder name');
  assert.ok(!/<Image\b/.test(art), 'drawn, not a picture');
  assert.ok(!/require\(/.test(art), 'no bundled assets');
});

test('nothing under app/ or src/ references the owner reference screenshots', () => {
  const self = 'src/core/profileGuide.test.ts';
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))]
    .map((f) => relative(root, f).replace(/\\/g, '/'))
    .filter((f) => f !== self);
  for (const f of files) {
    if (/\.(png|jpe?g|heic|webp)$/i.test(f)) {
      assert.ok(!/(settings-top|more-for-your-iphone|install-profile|safari-profile-downloaded)/.test(f), `${f} looks like a copied screenshot`);
      continue;
    }
    if (!/\.(tsx?|js|json|mjs)$/.test(f)) continue;
    const src = readFileSync(join(root, f), 'utf8');
    assert.ok(!src.includes('owner_screens_1101'), `${f} references docs/owner_screens_1101`);
  }
});
