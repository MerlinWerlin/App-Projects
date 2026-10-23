import { NEW_FREE_THEMES, NEW_PLUS_THEMES } from './themesNew.ts';
import { STORYPLAY_THEMES } from './themesStoryPlay.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUES } from '../i18n/locales/index.ts';
import { en as themesEn } from '../i18n/ns/themes/en.ts';
import { lookup, translate, type CatalogueTree } from './i18n.ts';
import {
  CATEGORY_IDS,
  LAUNCH_CATALOGUE_DATE,
  THEME_CATEGORIES,
  categoryCounts,
  foldForSearch,
  isCategoryId,
  isNew,
  searchThemes,
  themesInCategory,
} from './categories.ts';
import { ALL_THEMES } from './plusThemes.ts';
import type { Theme } from './themes.ts';

const BANNED = /themify|icon themer|myscreen|screenkit|widgetsmith|intolive|loopy|lockio/i;

test('ten categories in the agreed order with label keys', () => {
  assert.deepEqual(CATEGORY_IDS, ['minimal', 'dark', 'pastel', 'nature', 'neon', 'retro', 'anime', 'cute', 'luxury', 'seasonal']);
  for (const c of THEME_CATEGORIES) assert.equal(c.labelKey, `themes.category.${c.id}`);
});

test('no category label key is missing from the strings', () => {
  const en = CATALOGUES.en;
  for (const c of THEME_CATEGORIES) {
    const label = lookup(en, c.labelKey);
    assert.ok(typeof label === 'string' && label.length > 0, c.labelKey);
  }
  assert.ok(lookup(en, 'themes.category.all'));
  assert.ok(lookup(en, 'themes.search.placeholder'));
  assert.ok(lookup(en, 'themes.badge.new'));
});

test('every theme is categorised with valid ids and lower-case tags', () => {
  for (const t of ALL_THEMES) {
    assert.ok((t.categories ?? []).length >= 1, `${t.id} has no category`);
    for (const c of t.categories ?? []) assert.ok(isCategoryId(c), `${t.id}: ${c}`);
    assert.equal(new Set(t.categories).size, t.categories!.length, `${t.id} duplicate category`);
    assert.ok((t.tags ?? []).length >= 3, `${t.id} needs tags`);
    for (const tag of t.tags ?? []) {
      assert.equal(tag, tag.toLowerCase().trim(), `${t.id} tag "${tag}"`);
      assert.ok(!BANNED.test(tag), tag);
    }
    assert.match(t.addedAt ?? '', /^\d{4}-\d{2}-\d{2}$/, `${t.id} addedAt`);
  }
});

test('every category has at least one theme', () => {
  const counts = categoryCounts(ALL_THEMES);
  for (const id of CATEGORY_IDS) assert.ok(counts[id] >= 1, id);
});

const fake = (over: Partial<Theme>): Theme =>
  ({ id: 'x', name: 'X', tagline: '', categories: [], tags: [], ...over }) as unknown as Theme;

test('themesInCategory filters and keeps order; null returns all', () => {
  const a = fake({ id: 'a', categories: ['dark', 'neon'] });
  const b = fake({ id: 'b', categories: ['pastel'] });
  const c = fake({ id: 'c', categories: ['dark'] });
  assert.deepEqual(themesInCategory([a, b, c], 'dark').map((t) => t.id), ['a', 'c']);
  assert.deepEqual(themesInCategory([a, b, c], null).map((t) => t.id), ['a', 'b', 'c']);
  assert.deepEqual(themesInCategory([a, b, c], 'luxury'), []);
  assert.ok(themesInCategory(ALL_THEMES, 'seasonal').some((t) => t.id === 'pumpkin-patch'));
});

test('searchThemes: case, accents, tags, categories, multi-word AND', () => {
  assert.equal(foldForSearch('Matcha Café'), 'matcha cafe');
  const ids = (q: string) => searchThemes(ALL_THEMES, q).map((t) => t.id);
  assert.ok(ids('CAFÉ').includes('matcha-cafe'));
  assert.ok(ids('cafe').includes('matcha-cafe'));
  assert.ok(ids('mushroom').includes('whimsy-forest')); // tag
  assert.ok(ids('neon').includes('candy-arcade')); // category id
  assert.ok(ids('gingham').includes('strawberry-dessert')); // tagline + tag
  assert.deepEqual(ids('pottery red'), ['copper-red']); // AND
  assert.ok(ids('pottery').length >= 8);
  assert.deepEqual(ids('pottery zzzz'), []);
  assert.equal(searchThemes(ALL_THEMES, '   ').length, ALL_THEMES.length);
  assert.ok(ids('ice cream').includes('retro-diner'));
});

test('isNew: inside the window, after launch only, bad input false', () => {
  const t = fake({ addedAt: '2026-11-01' });
  assert.equal(isNew(t, '2026-11-01'), true);
  assert.equal(isNew(t, '2026-11-21'), true); // day 20
  assert.equal(isNew(t, '2026-11-22'), false); // day 21
  assert.equal(isNew(t, '2026-11-08', 7), false);
  assert.equal(isNew(t, '2026-11-07', 7), true);
  assert.equal(isNew(t, new Date(2026, 10, 5)), true); // local calendar day
  assert.equal(isNew(fake({}), '2026-11-01'), false);
  assert.equal(isNew(fake({ addedAt: 'soon' }), '2026-11-01'), false);
  // The launch catalogue never shows New.
  assert.equal(isNew(fake({ addedAt: LAUNCH_CATALOGUE_DATE }), LAUNCH_CATALOGUE_DATE), false);
  // Only the 16 Oct additions (src/core/themesNew.ts) and the 22 Oct additions
  // (src/core/themesStoryPlay.ts, T104) carry the badge.
  assert.deepEqual(
    ALL_THEMES.filter((x) => isNew(x, '2026-10-22')).map((x) => x.id).sort(),
    [...NEW_FREE_THEMES, ...NEW_PLUS_THEMES, ...STORYPLAY_THEMES].map((x) => x.id).sort(),
  );
  // Three weeks after 16 Oct only the T104 themes are still new.
  assert.deepEqual(
    ALL_THEMES.filter((x) => isNew(x, '2026-11-06')).map((x) => x.id).sort(),
    STORYPLAY_THEMES.map((x) => x.id).sort(),
  );
});

test('categoryCounts counts every id, zero included, once per theme', () => {
  const counts = categoryCounts([fake({ categories: ['dark', 'dark', 'neon'] }), fake({ categories: ['dark'] })]);
  assert.equal(counts.dark, 2);
  assert.equal(counts.neon, 1);
  assert.equal(counts.luxury, 0);
  assert.equal(Object.keys(counts).length, CATEGORY_IDS.length);
});

test('browse strings (catalogue themes.*) fill placeholders and pick the singular', () => {
  const s = (key: string, params?: Record<string, string | number>) => translate(CATALOGUES, 'en', key, params);
  assert.equal(s('themes.category.a11y', { label: 'Dark', count: 3 }), 'Dark, 3 themes');
  assert.equal(s('themes.category.a11y', { label: 'Dark', count: 1 }), 'Dark, 1 theme');
  assert.equal(s('themes.badge.new'), 'New');
  assert.equal(s('nope.key'), 'nope.key');
  const texts = (n: unknown): string[] =>
    typeof n === 'string' ? [n] : n && typeof n === 'object' ? Object.values(n).flatMap(texts) : [];
  for (const v of texts(themesEn as unknown as CatalogueTree)) assert.ok(!BANNED.test(v), v);
});
