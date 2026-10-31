// T106: Free pill + Story & Play chips.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { FREE_MARKED_IDS, STORY_GROUPS, inStoryGroup, isFreeMarked, storyChipKey } from './freeMarks.ts';
import { lookup, type CatalogueTree } from './i18n.ts';
import { ALL_THEMES, PLUS_PACKS } from './plusThemes.ts';
import { SPACE_THEMES } from './spacePack.ts';
import { STORYPLAY_FREE_THEMES, STORYPLAY_PLUS_THEMES } from './themesStoryPlay.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { en } from '../i18n/locales/en.ts';

test('Space and the six free Story & Play themes are marked Free; no Plus theme ever is', () => {
  for (const t of SPACE_THEMES) assert.ok(isFreeMarked(t.id), t.id);
  assert.equal(STORYPLAY_FREE_THEMES.length, 6);
  for (const t of STORYPLAY_FREE_THEMES) assert.ok(isFreeMarked(t.id), t.id);
  const plusIds = new Set(PLUS_PACKS.flatMap((p) => p.themes.map((t) => t.id)));
  for (const t of ALL_THEMES) if (t.plus) plusIds.add(t.id);
  for (const id of FREE_MARKED_IDS) assert.ok(!plusIds.has(id), `${id} is Plus but marked Free`);
  for (const t of STORYPLAY_PLUS_THEMES) assert.ok(!isFreeMarked(t.id));
});

test('each Story & Play chip finds its group (free and Plus), at least one free theme each', () => {
  assert.deepEqual(inStoryGroup(ALL_THEMES, null), ALL_THEMES);
  for (const g of STORY_GROUPS) {
    const found = inStoryGroup(ALL_THEMES, g);
    assert.ok(found.length >= 3, g);
    assert.ok(found.some((t) => isFreeMarked(t.id)), `${g} has a free theme`);
  }
  const total = STORY_GROUPS.reduce((n, g) => n + inStoryGroup(ALL_THEMES, g).length, 0);
  assert.equal(total, STORYPLAY_FREE_THEMES.length + STORYPLAY_PLUS_THEMES.length);
});

test('Free pill and chip strings exist in all 11 locales', () => {
  const keys = ['themes.badge.free', 'themes.badge.freeA11y', 'themes.storyChips.label', 'themes.storyChips.a11y', ...STORY_GROUPS.map(storyChipKey)];
  const locales = Object.entries(TRANSLATIONS) as [string, unknown][];
  assert.equal(locales.length, 10); // + en = 11
  for (const [loc, tree] of [['en', en] as [string, unknown], ...locales]) {
    for (const k of keys) {
      const v = lookup(tree as CatalogueTree, k);
      assert.equal(typeof v, 'string', `${loc} ${k}`);
      assert.ok((v as string).length > 0);
    }
  }
});

// T177 (owner-1031): Space, the story chips and the showcase left the Themes gallery; the showcase
// grid keeps its Free pill wiring for reuse.
test('UI wiring: the showcase grid keeps the Free pill; the Themes gallery has no story chips', () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
  const themes = read('app', '(tabs)', 'themes.tsx');
  assert.doesNotMatch(themes, /<StoryChips |inStoryGroup\(/);
  const grid = read('src', 'ui', 'ShowcaseGrid.tsx');
  assert.match(grid, /freeIds/);
});
