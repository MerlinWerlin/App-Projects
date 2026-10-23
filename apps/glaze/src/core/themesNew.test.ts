import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTIFS, isMotifId } from './artwork.ts';
import { ALL_THEMES, PLUS_PACKS, PLUS_THEMES, getAnyTheme, packOf } from './plusThemes.ts';
import { THEME_CATEGORY_IDS } from './themePack.ts';
import { THEMES } from './themes.ts';
import { AURORA_PACK_ID, NEW_FREE_THEMES, NEW_PLUS_THEMES, NEW_THEMES } from './themesNew.ts';

const FRANCHISE = /shortcake|kitty|sanrio|disney|pok[eé]mon|ghibli|totoro|barbie|marvel|peanuts|snoopy|sailor|naruto|goku|pikachu|miku|nintendo|anime girl/i;

test('T46: 12 new themes, 4 free (bundled) and 8 Plus in pack-aurora-2026', () => {
  assert.equal(NEW_FREE_THEMES.length, 4);
  assert.equal(NEW_PLUS_THEMES.length, 8);
  assert.equal(NEW_THEMES.length, 12);
  for (const t of NEW_FREE_THEMES) {
    assert.equal(t.plus, false, t.id);
    assert.equal(t.packId, undefined, `${t.id}: free themes are bundled`);
  }
  for (const t of NEW_PLUS_THEMES) {
    assert.equal(t.plus, true, t.id);
    assert.equal(t.packId, AURORA_PACK_ID, t.id);
  }
});

test('new themes are wired into the free list, the Plus packs and ALL_THEMES', () => {
  for (const t of NEW_FREE_THEMES) assert.ok(THEMES.includes(t), t.id);
  for (const t of NEW_PLUS_THEMES) {
    assert.ok(PLUS_THEMES.includes(t), t.id);
    assert.equal(packOf(t.id)?.id, AURORA_PACK_ID);
    assert.equal(getAnyTheme(t.id), t);
  }
  assert.ok(PLUS_PACKS.some((p) => p.id === AURORA_PACK_ID && p.themes.length === 8));
  assert.equal(new Set(ALL_THEMES.map((t) => t.id)).size, ALL_THEMES.length);
});

test('categories cover every browse category; tags are lower case; addedAt is today', () => {
  const seen = new Set<string>();
  for (const t of NEW_THEMES) {
    assert.ok(t.categories && t.categories.length >= 1 && t.categories.length <= 3, t.id);
    for (const c of t.categories!) {
      assert.ok(THEME_CATEGORY_IDS.includes(c), `${t.id}: ${c}`);
      seen.add(c);
    }
    assert.ok(t.tags && t.tags.length >= 3, t.id);
    for (const tag of t.tags!) assert.equal(tag, tag.toLowerCase(), `${t.id}: ${tag}`);
    assert.equal(t.addedAt, '2026-10-16');
    assert.ok(!FRANCHISE.test(`${t.id} ${t.name} ${t.tagline} ${t.tags!.join(' ')}`), t.id);
  }
  assert.deepEqual([...seen].sort(), [...THEME_CATEGORY_IDS].sort());
});

test('one seasonal collection: at least 3 themes tagged halloween, all in the seasonal category', () => {
  const halloween = NEW_THEMES.filter((t) => t.tags?.includes('halloween'));
  assert.ok(halloween.length >= 3, `${halloween.length}`);
  for (const t of halloween) assert.ok(t.categories?.includes('seasonal'), t.id);
  assert.ok(halloween.some((t) => !t.plus), 'at least one free Halloween theme');
});

test('anime-style themes use original motifs (speed lines, starry eyes, petals), never characters', () => {
  const anime = NEW_THEMES.filter((t) => t.categories?.includes('anime'));
  assert.ok(anime.length >= 2);
  const motifs = new Set(anime.flatMap((t) => t.art.motifs));
  assert.ok(motifs.has('speed-lines') && motifs.has('starry-eye'));
  for (const id of ['speed-lines', 'starry-eye', 'ghost', 'bat', 'gem', 'lightning', 'snowflake']) {
    assert.ok(isMotifId(id), id);
    assert.ok(!FRANCHISE.test(MOTIFS[id as keyof typeof MOTIFS].name), id);
  }
});
