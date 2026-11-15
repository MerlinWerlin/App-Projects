// Glaze 1.0.41 (owner 2026-11-15): Glaze Plus is a yearly subscription; ten premium themes are free and
// shown first; everything else needs Plus; a theme already in use keeps working after a lapse.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ART_PACK_THEMES } from './artPackThemes.ts';
import { FEATURED_FREE_IDS, FREE_THEME_IDS, freeThemesIn, isFreeTheme } from './freeThemes.ts';
import { ENTITLEMENT_SKUS, LEGACY_UNLOCK_SKU, OFFLINE_GRACE_MS, YEARLY_SKU, combineOwned, parsePlusCache, resolveSubscribed } from './plusStoreKit.ts';
import { browseHomeRows } from './themeBrowse.ts';

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

test('the free set: exactly ten, Alpine Starlight then Cloud Atelier featured first, all ten work offline', () => {
  assert.equal(FREE_THEME_IDS.length, 10);
  assert.equal(new Set(FREE_THEME_IDS).size, 10);
  assert.deepEqual([...FEATURED_FREE_IDS], ['alpine-starlight', 'cloud-atelier']);
  assert.deepEqual(FREE_THEME_IDS.slice(0, 2), ['alpine-starlight', 'cloud-atelier']);
  assert.ok(FREE_THEME_IDS.includes('aurora-haven') && !FEATURED_FREE_IDS.includes('aurora-haven'), 'Aurora Haven free, not featured');
  assert.ok(!isFreeTheme('starry-night') && isFreeTheme('deep-sea'), 'Deep Sea over Starry Night');
  // Offline on a fresh install: bundled starter packs + in-app art themes.
  const gen = read('src', 'generated', 'starterPacks.ts');
  const starters = [...gen.matchAll(/entry: \{"id":"([a-z0-9-]+)"/g)].map((m) => m[1]);
  const inApp = ART_PACK_THEMES.map((t) => t.id);
  for (const id of FREE_THEME_IDS) {
    assert.ok(starters.includes(id) || inApp.includes(id), `${id} is bundled`);
    if (starters.includes(id)) assert.ok(existsSync(join(ROOT, 'assets', 'starter-packs', id)), `${id} files`);
  }
  // Every bundled starter is free (nothing bundled sits behind the paywall).
  for (const id of starters) assert.ok(isFreeTheme(id), `${id} bundled but not free`);
  assert.deepEqual(freeThemesIn([{ id: 'deep-sea' }, { id: 'x' }, { id: 'alpine-starlight' }]).map((t) => t.id), ['alpine-starlight', 'deep-sea']);
});

test('gallery themes outside the free ten are Plus; the free ten are not', () => {
  for (const t of ART_PACK_THEMES) assert.equal(t.plus, !isFreeTheme(t.id), t.id);
  const snapshot = JSON.parse(read('scripts', 'packs', 'r2-artwork.json')) as { perTheme: Record<string, unknown> };
  const r2 = Object.keys(snapshot.perTheme);
  for (const id of FREE_THEME_IDS) assert.ok(r2.includes(id) || ART_PACK_THEMES.some((t) => t.id === id), `${id} exists`);
  assert.ok(r2.filter((id) => !isFreeTheme(id)).length >= 130, 'most themes are Plus');
});

test('entitlement: the yearly subscription or the legacy unlock; StoreKit wins; a cached yes only for 7 days offline', () => {
  assert.equal(YEARLY_SKU, 'com.jared797.glaze.yearly');
  assert.equal(LEGACY_UNLOCK_SKU, 'com.jared797.glaze.plus');
  assert.deepEqual([...ENTITLEMENT_SKUS], [YEARLY_SKU, LEGACY_UNLOCK_SKU]);
  assert.equal(combineOwned([true, false]), true);
  assert.equal(combineOwned([false, true]), true, 'the legacy unlock still counts');
  assert.equal(combineOwned([false, null]), false);
  assert.equal(combineOwned([null, null]), null, 'StoreKit could not be asked');
  const now = 10_000_000_000;
  const fresh = { plus: true, checkedAt: now - 1000 };
  const stale = { plus: true, checkedAt: now - OFFLINE_GRACE_MS - 1 };
  assert.equal(resolveSubscribed(false, fresh, now), false, 'StoreKit says expired: locked, whatever the cache says');
  assert.equal(resolveSubscribed(true, null, now), true);
  assert.equal(resolveSubscribed(null, fresh, now), true, 'offline grace');
  assert.equal(resolveSubscribed(null, stale, now), false, 'grace over');
  assert.equal(resolveSubscribed(null, null, now), false);
  assert.deepEqual(parsePlusCache('{"plus":true}'), { plus: true, checkedAt: 0 }, 'old cache counts as checked long ago');
  assert.equal(parsePlusCache('nope'), null);
});

test('the store module counts a subscription only while it is not expired or revoked', () => {
  const swift = read('modules', 'glaze-store', 'ios', 'GlazeStoreModule.swift');
  assert.match(swift, /if let expires = transaction\.expirationDate, expires <= Date\(\) \{ return false \}/);
  assert.match(swift, /"owned": GlazeStoreKit\.isActive\(transaction\)/);
  const store = read('src', 'plus', 'iapStore.ts');
  const sub = store.slice(store.indexOf('export function createSubscriptionPlusStore'), store.indexOf('export function createStoreKitPlusStore'));
  assert.match(sub, /buyPlus\(store, YEARLY_SKU\)/, 'buys the yearly subscription');
  assert.match(sub, /for \(const id of ENTITLEMENT_SKUS\) answers\.push\(await store\.isOwned\(id\)\);/);
  assert.match(sub, /store\.getProduct\(YEARLY_SKU\)/, 'price from StoreKit');
});

test('Themes tab: the Free section comes first (featured rail, then the rest) and disappears once subscribed', () => {
  const t = (id: string, category = 'Space & Night') => ({ id, name: id, browseCategory: 'space', category, tags: [], categories: [] }) as never;
  const themes = [t('a'), t('alpine-starlight'), t('cloud-atelier'), t('deep-sea')];
  const rows = browseHomeRows({ themes, columns: 3, free: freeThemesIn(themes as { id: string }[]) as never, featured: FEATURED_FREE_IDS });
  assert.deepEqual(rows.slice(0, 3).map((r) => r.key), ['head:free', 'rail:featured', 'rail:free']);
  const featured = rows[1] as { themes: { id: string }[] };
  assert.deepEqual(featured.themes.map((x) => x.id), ['alpine-starlight', 'cloud-atelier']);
  const subscribed = browseHomeRows({ themes, columns: 3 });
  assert.ok(!subscribed.some((r) => r.key.includes('free') || r.key.includes('featured')));
  const screen = read('app', '(tabs)', 'themes.tsx');
  assert.match(screen, /const subscribed = !useLocked\(true\);/);
});

test('gating: premium themes need Plus to be chosen; a theme in use keeps working; own photos stay free', () => {
  const page = read('app', 'theme', '[id].tsx');
  assert.match(page, /const locked = useLocked\(theme\.plus\);/);
  const open = page.slice(page.indexOf('const openWidgetsTab = async'), page.indexOf('const openPart = async'));
  assert.ok(open.indexOf('if (inUse)') < open.indexOf('if (checkLock && locked)'), 'a theme in use opens its widgets without Plus');
  const put = page.slice(page.indexOf('const putInUse = async'), page.indexOf('const openIconSetup = async'));
  assert.match(put, /if \(checkLock && locked\) \{\s*lockFor\.current = 'use-everything';/);
  assert.match(page, /if \(locked\) \{\s*lockFor\.current = 'icons';\s*setLockOpen\(true\);/);
  const tab = read('app', '(tabs)', 'widgets.tsx');
  assert.match(tab, /const customLocked = useLocked\(theme\.plus === true\);/);
  assert.match(read('src', 'ui', 'artworkActions.ts'), /if \(onLocked\) onLocked\(\);\s*else void addArtworkToCustom/);
  // Your own photos in Custom 1-5 (src/ui/CustomArtSlots.tsx) never check Plus.
  assert.doesNotMatch(read('src', 'ui', 'CustomArtSlots.tsx'), /useLocked|usePlus|PlusLockSheet/);
});
