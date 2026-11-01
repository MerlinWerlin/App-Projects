// owner-1101 (Jared 1 Nov 19:37): every theme must be in a category - none under More.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ART_PACK_THEMES } from './artPackThemes.ts';
import { THEMES } from './themes.ts';
import { BUILT_IN_THEME_CATEGORIES, browseCategoryOf, MORE_CATEGORY } from './themeBrowse.ts';

test('every built-in theme has a browse category (none fall under More)', () => {
  const more = [...THEMES, ...ART_PACK_THEMES].filter((t) => browseCategoryOf(t) === MORE_CATEGORY).map((t) => t.id);
  assert.deepEqual(more, []);
});

test('the built-in category map only names real themes', () => {
  const ids = new Set(THEMES.map((t) => t.id));
  for (const id of Object.keys(BUILT_IN_THEME_CATEGORIES)) assert.ok(ids.has(id), id);
});

test('a served category still wins over the built-in map', () => {
  assert.equal(browseCategoryOf({ id: 'still-water', category: 'Nature' }), 'nature');
  assert.equal(browseCategoryOf({ id: 'unknown-theme' }), MORE_CATEGORY);
});
