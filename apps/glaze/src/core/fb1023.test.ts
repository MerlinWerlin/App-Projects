// fb-1023 (owner test 23 Oct evening, made live in the owner's chat): a small calm fade when a
// search chip or sub-tab swaps the results, and All / New / Picks / Liked as a 2×2 block on the
// Wallpapers tab. Source guards, since the cloud can't mount React Native.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const SPRINGY = /\bwithSpring\b|\.springify\(|\bZoomIn\b|\bBounceIn\b|\bwithSequence\b|\bLinearTransition\b|\blayout=\{|\bscale\b/;

test('fb-1023: chips, sub-tabs and collections re-run the grid fade on Themes', () => {
  const themes = strip(read('app', '(tabs)', 'themes.tsx'));
  assert.match(themes, /fadeKey=\{`\$\{group \?\? ''\}\|\$\{tab\}\|\$\{collection \?\? ''\}`\}/);
  const grid = strip(read('src', 'ui', 'ShowcaseGrid.tsx'));
  assert.match(grid, /\[pageIndex, fadeKey, fade\]/);
  assert.match(grid, /opacity: fade\.value/);
  assert.doesNotMatch(grid, SPRINGY);
});

test('fb-1023: the Wallpapers tiles fade (opacity only) when the sub-tab or discovery tab changes', () => {
  const wp = strip(read('app', '(tabs)', 'wallpapers.tsx'));
  assert.match(wp, /useAnimatedStyle\(\(\) => \(\{ opacity: fade\.value \}\)\)/);
  assert.match(wp, /<Animated\.View style=\{\[styles\.grid, gridFade\]\}>/);
  assert.doesNotMatch(wp, SPRINGY);
});

test('fb-1023: All / New / Picks / Liked is a 2×2 block on Wallpapers', () => {
  const wp = strip(read('app', '(tabs)', 'wallpapers.tsx'));
  assert.match(wp, /<Segmented grid label=\{t\('tabs\.wallpapersTab\.discover\.label'\)\}/);
  const seg = strip(read('src', 'ui', 'Segmented.tsx'));
  assert.match(seg, /grid && styles\.grid/);
  assert.match(seg, /segGrid: \{ flexGrow: 1, flexShrink: 0, flexBasis: '45%' \}/);
  assert.match(seg, /grid: \{ flexWrap: 'wrap'/);
});
