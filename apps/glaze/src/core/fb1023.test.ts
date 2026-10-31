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

// T177 (owner-1031): the Themes tab no longer uses ShowcaseGrid (chips, sub-tabs and collections are
// gone); the grid keeps its calm fade for reuse.
test('fb-1023: the showcase grid fade is opacity only', () => {
  const grid = strip(read('src', 'ui', 'ShowcaseGrid.tsx'));
  assert.match(grid, /\[pageIndex, fadeKey, fade\]/);
  assert.match(grid, /opacity: fade\.value/);
  assert.doesNotMatch(grid, SPRINGY);
});

// T186 (owner-1101 #4 supersedes these two fb-1023 guards): the Wallpapers tab lost its sub-tabs,
// discovery block and tile grid. What still holds: no springs there, and Segmented keeps its grid.
test('fb-1023: the Wallpapers tab stays calm (no springs) after T186', () => {
  const wp = strip(read('app', '(tabs)', 'wallpapers.tsx'));
  assert.doesNotMatch(wp, SPRINGY);
});

test('fb-1023: Segmented still offers the 2×2 grid block', () => {
  const seg = strip(read('src', 'ui', 'Segmented.tsx'));
  assert.match(seg, /grid && styles\.grid/);
  assert.match(seg, /segGrid: \{ flexGrow: 1, flexShrink: 0, flexBasis: '45%' \}/);
  assert.match(seg, /grid: \{ flexWrap: 'wrap'/);
});
