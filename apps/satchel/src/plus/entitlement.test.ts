// T16 entitlement test: src/core never reads the Plus entitlement, only src/plus/ and the screens listed here do,
// the free core is never gated, every Plus feature is unlocked while purchases are stubbed, and the paywall promises
// only what this build has.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { cityDownloadGate, freeCityAllowance, PLUS_FEATURES, plusUnlocked } from './entitlement.ts';

const root = new URL('../../', import.meta.url).pathname;
/** The only files outside src/plus/ allowed to read the entitlement. */
export const PLUS_SCREENS = ['app/settings.tsx', 'app/(tabs)/map.tsx'];

const walk = (d: string, out: string[] = []): string[] => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(relative(root, p));
  }
  return out;
};
const READS = /src\/plus\/|['"]\.\.?\/plus\/|['"](\.\.\/)+plus\/|\busePlus\b|\buseCityGate\b|\bplusUnlocked\b|\bcityDownloadGate\b|satchel\.plus\.v1|PLUS_KEY|require\(['"]expo-iap|from ['"]expo-iap/;

test('src/core never reads the entitlement', () => {
  const hits = walk(join(root, 'src/core')).filter((f) => READS.test(readFileSync(join(root, f), 'utf8')));
  assert.deepEqual(hits, []);
});

test('only src/plus/ and the listed screens read the entitlement', () => {
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))].filter((f) => !f.startsWith('src/plus/'));
  const readers = files.filter((f) => READS.test(readFileSync(join(root, f), 'utf8')));
  assert.deepEqual(readers.sort(), [...PLUS_SCREENS].sort());
});

test('free features are never gated: their screens do not touch Plus', () => {
  // tickets, emergency card, documents/vault, packing, low-battery mode, toilets, covers, backup
  const free = ['app/(tabs)/wallet.tsx', 'app/(tabs)/emergency.tsx', 'app/(tabs)/toilets.tsx', 'app/(tabs)/index.tsx', 'app/vault.tsx', 'app/essentials.tsx', 'app/emergency-edit.tsx', 'app/doc-edit.tsx', 'app/trip-edit.tsx'];
  for (const f of free) assert.equal(READS.test(readFileSync(join(root, f), 'utf8')), false, f);
  for (const dir of ['app/ticket', 'app/doc', 'app/packing', 'app/trip']) {
    for (const f of walk(join(root, dir))) assert.equal(READS.test(readFileSync(join(root, f), 'utf8')), false, f);
  }
});

test('the map gates only the download of a city beyond the free allowance', () => {
  const map = readFileSync(join(root, 'app/(tabs)/map.tsx'), 'utf8');
  assert.equal((map.match(/gate === 'locked'/g) ?? []).length, 2, 'start() guard and the Download row only');
  assert.match(map, /useCityGate\(installed\.length, tripCount\)/);
});

test('the first offline city per trip is always free; installed cities are never gated', () => {
  for (const unlocked of [false, true]) {
    assert.equal(cityDownloadGate({ unlocked, installedCount: 0, tripCount: 0 }), 'free');
    assert.equal(cityDownloadGate({ unlocked, installedCount: 0, tripCount: 1 }), 'free');
    assert.equal(cityDownloadGate({ unlocked, installedCount: 2, tripCount: 3 }), 'free');
    assert.equal(cityDownloadGate({ unlocked, installedCount: 9, tripCount: 1, alreadyInstalled: true }), 'free');
  }
  assert.equal(cityDownloadGate({ unlocked: false, installedCount: 1, tripCount: 1 }), 'locked');
  assert.equal(cityDownloadGate({ unlocked: true, installedCount: 1, tripCount: 1 }), 'plus');
  assert.equal(cityDownloadGate({ unlocked: false, installedCount: 3, tripCount: 3 }), 'locked');
  assert.equal(freeCityAllowance(0), 1);
  assert.equal(freeCityAllowance(4), 4);
  assert.equal(freeCityAllowance(Number.NaN), 1);
});

test('every Plus feature is unlocked while purchases are stubbed', () => {
  assert.equal(plusUnlocked({ availability: 'stub', owned: false }), true);
  assert.equal(plusUnlocked({ availability: 'store', owned: false }), false);
  assert.equal(plusUnlocked({ availability: 'store', owned: true }), true);
  assert.equal(cityDownloadGate({ unlocked: plusUnlocked({ availability: 'stub', owned: false }), installedCount: 5, tripCount: 1 }), 'plus');
});

test('the paywall promises only features in this build, with no test-build text, countdowns or nags', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('plus.'));
  assert.deepEqual(keys.filter((k) => k.startsWith('plus.feature.')).map((k) => k.slice('plus.feature.'.length)), [...PLUS_FEATURES]);
  for (const k of keys) {
    const v = (en as Record<string, string>)[k];
    assert.doesNotMatch(v, /test (build|mode|unlock)|sandbox|not available yet|purchases aren.t available|widget|icloud|theme|share trips|limited time|hurry|left|countdown|today only/i, k);
  }
  const fail = (en as Record<string, string>)['plus.failBody'];
  assert.match(fail, /Nothing was charged/);
  assert.match(fail, /\{codes\}/);
  assert.match((en as Record<string, string>)['plus.unavailableBody'], /Nothing was charged.*\{codes\}/);
});

test('Unlock and Restore purchases sit on the same screen', () => {
  const s = readFileSync(join(root, 'src/plus/PlusSection.tsx'), 'utf8');
  assert.match(s, /buyPlus\(\)/);
  assert.match(s, /restorePlus\(\)/);
  assert.match(readFileSync(join(root, 'app/settings.tsx'), 'utf8'), /<PlusSection \/>/);
});
