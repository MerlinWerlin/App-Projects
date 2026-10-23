import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_PAGE,
  BUBBLE_GLOW_OPACITY,
  BUBBLE_MAX,
  BUBBLE_MIN,
  BUBBLE_PASTEL,
  BUBBLE_FADE_MS,
  GRID_FADE_MS,
  browsePages,
  bubbleLook,
  bubbleMetrics,
  bubbleSnapOffsets,
  maxRowOffset,
  pageAfterStep,
  pageCategory,
  pageIndex,
  pageKey,
  pageTransition,
  revealOffset,
  rowContentWidth,
  showcaseCardWidth,
  showcaseColumns,
  swipeStep,
} from './categoryPaging.ts';
import { CATEGORY_IDS, categoryCounts } from './categories.ts';
import { PASTEL_NAMES } from './designV2.ts';
import { ALL_THEMES } from './plusThemes.ts';
import type { ThemeCategoryId } from './themes.ts';

const zero = (): Record<ThemeCategoryId, number> =>
  Object.fromEntries(CATEGORY_IDS.map((id) => [id, 0])) as Record<ThemeCategoryId, number>;

test('pages: all first, then categories with themes in bubble order', () => {
  const pages = browsePages(categoryCounts(ALL_THEMES));
  assert.deepEqual(pages, [ALL_PAGE, ...CATEGORY_IDS]); // every category has themes today
  const c = zero();
  c.neon = 2;
  c.dark = 1;
  assert.deepEqual(browsePages(c), ['all', 'dark', 'neon']);
  assert.deepEqual(browsePages(zero()), ['all']);
});

test('pages: the selected page survives at zero matches', () => {
  const c = zero();
  c.dark = 1;
  assert.deepEqual(browsePages(c, 'luxury'), ['all', 'dark', 'luxury']);
  assert.deepEqual(browsePages(c, 'all'), ['all', 'dark']);
});

test('page keys map to categories and back', () => {
  assert.equal(pageCategory('all'), null);
  assert.equal(pageCategory('cute'), 'cute');
  assert.equal(pageKey(null), 'all');
  assert.equal(pageKey('retro'), 'retro');
  assert.equal(pageIndex(['all', 'dark', 'neon'], 'neon'), 2);
  assert.equal(pageIndex(['all', 'dark'], 'neon'), 0);
});

test('every page has a design v2 pastel', () => {
  for (const key of [ALL_PAGE, ...CATEGORY_IDS]) assert.ok((PASTEL_NAMES as readonly string[]).includes(BUBBLE_PASTEL[key]), key);
  assert.equal(Object.keys(BUBBLE_PASTEL).length, CATEGORY_IDS.length + 1);
});

test('bubbles are big, clamped, and always over the touch target', () => {
  const m = bubbleMetrics(390);
  assert.ok(m.size >= 90 && m.size <= 110, String(m.size));
  assert.equal(bubbleMetrics(200).size, BUBBLE_MIN);
  assert.equal(bubbleMetrics(1024).size, BUBBLE_MAX);
  assert.equal(bubbleMetrics(Number.NaN).size, bubbleMetrics(375).size);
  assert.ok(BUBBLE_MIN >= 48);
  // About 3.4 visible: the fourth bubble peeks in on a phone.
  const shown = (390 - m.inset) / (m.size + m.gap);
  assert.ok(shown > 3 && shown < 4, String(shown));
});

test('row geometry: content width, max offset, snap points', () => {
  const m = { size: 100, gap: 10, inset: 16 };
  assert.equal(rowContentWidth(0, m), 32);
  assert.equal(rowContentWidth(3, m), 32 + 300 + 20);
  assert.equal(maxRowOffset(3, m, 400), 0);
  assert.equal(maxRowOffset(11, m, 390), 32 + 1100 + 100 - 390);
  const snaps = bubbleSnapOffsets(11, m, 390);
  assert.equal(snaps[0], 0);
  assert.equal(snaps[1], 110);
  assert.equal(snaps[snaps.length - 1], maxRowOffset(11, m, 390));
  for (let i = 1; i < snaps.length; i++) assert.ok(snaps[i] > snaps[i - 1]);
  assert.deepEqual(bubbleSnapOffsets(2, m, 400), [0]);
  assert.deepEqual(bubbleSnapOffsets(0, m, 400), [0]);
});

test('revealOffset keeps the previous bubble peeking and lands on a snap point', () => {
  const m = { size: 100, gap: 10, inset: 16 };
  const snaps = bubbleSnapOffsets(11, m, 390);
  assert.equal(revealOffset(0, 11, m, 390), 0);
  assert.equal(revealOffset(1, 11, m, 390), 0);
  assert.equal(revealOffset(4, 11, m, 390), 330);
  assert.equal(revealOffset(10, 11, m, 390), maxRowOffset(11, m, 390));
  assert.equal(revealOffset(99, 11, m, 390), maxRowOffset(11, m, 390));
  assert.equal(revealOffset(3, 0, m, 390), 0);
  for (let i = 0; i < 11; i++) assert.ok(snaps.includes(revealOffset(i, 11, m, 390)), `index ${i}`);
});

test('the selected bubble never changes size: tint and glow only (fb-1022c)', () => {
  assert.deepEqual(bubbleLook(0), { tint: 0, glow: 0 });
  assert.deepEqual(bubbleLook(1), { tint: 1, glow: BUBBLE_GLOW_OPACITY });
  assert.equal(bubbleLook(0.5).tint, 0.5);
  assert.deepEqual(bubbleLook(3), bubbleLook(1));
  assert.deepEqual(bubbleLook(Number.NaN), bubbleLook(0));
  assert.ok(!('scale' in bubbleLook(1)));
  assert.ok(BUBBLE_FADE_MS >= 120 && BUBBLE_FADE_MS <= 200);
});

test('swipeStep: distance or flick commits; direction follows reading order', () => {
  const w = 390;
  assert.equal(swipeStep(-80, 0, w, false), 1);
  assert.equal(swipeStep(80, 0, w, false), -1);
  assert.equal(swipeStep(-80, 0, w, true), -1);
  assert.equal(swipeStep(80, 0, w, true), 1);
  assert.equal(swipeStep(-40, -100, w, false), 0); // short and slow
  assert.equal(swipeStep(-30, -900, w, false), 1); // flick
  assert.equal(swipeStep(-10, -900, w, false), 0); // too short even for a flick
  assert.equal(swipeStep(-30, 900, w, false), 0); // flick against the drag
  assert.equal(swipeStep(Number.NaN, 0, w, false), 0);
  assert.equal(swipeStep(-80, Number.NaN, w, false), 1);
});

test('pageAfterStep clamps at both ends', () => {
  assert.equal(pageAfterStep(0, 5, -1), 0);
  assert.equal(pageAfterStep(0, 5, 1), 1);
  assert.equal(pageAfterStep(4, 5, 1), 4);
  assert.equal(pageAfterStep(2, 5, 0), 2);
  assert.equal(pageAfterStep(9, 5, 0), 4);
  assert.equal(pageAfterStep(0, 0, 1), 0);
});

test('pageTransition is a short opacity fade, never a slide (fb-1022c)', () => {
  assert.deepEqual(pageTransition(0, 2), { kind: 'fade', fromOpacity: 0, durationMs: GRID_FADE_MS });
  assert.deepEqual(pageTransition(2, 0), pageTransition(0, 2));
  assert.deepEqual(pageTransition(1, 1), { kind: 'none' });
  assert.deepEqual(pageTransition(Number.NaN, 1), { kind: 'none' });
  assert.ok(GRID_FADE_MS >= 150 && GRID_FADE_MS <= 200);
});

test('showcase grid: two tall columns on phones, one on very narrow screens', () => {
  assert.equal(showcaseColumns(390), 2);
  assert.equal(showcaseColumns(320), 1);
  assert.equal(showcaseCardWidth(390, 2), Math.floor((390 - 32 - 12) / 2));
  assert.equal(showcaseCardWidth(320, 1), 288);
  assert.ok(showcaseCardWidth(100, 2) >= 120);
});

test('the gallery uses the paging logic', () => {
  const root = process.cwd();
  const screen = readFileSync(join(root, 'app/(tabs)/themes.tsx'), 'utf8');
  assert.match(screen, /<CategoryBubbleRow/);
  assert.match(screen, /<ShowcaseGrid/);
  assert.match(screen, /browsePages\(/);
  assert.match(screen, /pageAfterStep\(/);
  const row = readFileSync(join(root, 'src/ui/CategoryBubbleRow.tsx'), 'utf8');
  assert.match(row, /bubbleSnapOffsets\(/);
  assert.match(row, /revealOffset\(/);
  assert.match(row, /bubbleLook\(/);
  const grid = readFileSync(join(root, 'src/ui/ShowcaseGrid.tsx'), 'utf8');
  assert.match(grid, /swipeStep\(/);
  assert.match(grid, /pageTransition\(/);
});
