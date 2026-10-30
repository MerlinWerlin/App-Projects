// T107 (fb-1022-perf): category bubble lag. Render-count model + source guards.
// Node can't mount React Native here (no node_modules in the cloud), so the render count is
// measured at the subscription level the UI uses: each bubble re-renders only when its own key's
// listener fires (useSyncExternalStore in src/ui/useSelection.ts), and the grid re-renders only
// when commitGrid runs. The source guards keep the UI wired that way.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { BrowseKey } from './categoryPaging.ts';
import { themesInCategory } from './categories.ts';
import {
  REVEAL_FIRST,
  buildThemeIndex,
  createCategorySwitch,
  createSelectionStore,
  nextReveal,
  revealSteps,
  themesForPage,
} from './categorySwitch.ts';
import { ALL_THEMES } from './plusThemes.ts';
import { CATEGORY_IDS } from './categories.ts';

const KEYS: BrowseKey[] = ['all', ...CATEGORY_IDS];

/** A row of bubbles subscribed like the UI's: counts renders per bubble, plus grid commits. */
function harness() {
  const store = createSelectionStore<BrowseKey>('all');
  const renders = new Map<BrowseKey, number>(KEYS.map((k) => [k, 0]));
  for (const k of KEYS) store.subscribeKey(k, () => renders.set(k, (renders.get(k) ?? 0) + 1));
  const frames: (() => void)[] = [];
  const commits: BrowseKey[] = [];
  const sw = createCategorySwitch<BrowseKey>({
    store,
    schedule: (cb) => frames.push(cb),
    commitGrid: (k) => commits.push(k),
  });
  const runFrame = () => {
    const due = frames.splice(0);
    for (const f of due) f();
  };
  const rerendered = () => KEYS.filter((k) => (renders.get(k) ?? 0) > 0);
  const reset = () => {
    for (const k of KEYS) renders.set(k, 0);
    commits.length = 0;
  };
  return { store, sw, renders, commits, runFrame, rerendered, reset };
}

test('a bubble press re-renders at most the two affected bubbles and the grid once', () => {
  const h = harness();
  const changed = h.sw.press('nature');
  assert.deepEqual(changed, ['all', 'nature']);
  assert.deepEqual(h.rerendered().sort(), ['all', 'nature']);
  for (const k of h.rerendered()) assert.equal(h.renders.get(k), 1);
  // The grid waits for the next frame, so the bounce gets its first frame alone.
  assert.equal(h.commits.length, 0);
  assert.equal(h.sw.pending(), true);
  h.runFrame();
  assert.deepEqual(h.commits, ['nature']);
  assert.equal(h.sw.pending(), false);
});

test('pressing the selected bubble re-renders nothing and leaves the grid alone', () => {
  const h = harness();
  h.sw.press('dark');
  h.runFrame();
  h.reset();
  assert.deepEqual(h.sw.press('dark'), []);
  h.runFrame();
  assert.deepEqual(h.rerendered(), []);
  assert.deepEqual(h.commits, []);
});

test('quick presses coalesce into one grid commit for the last bubble', () => {
  const h = harness();
  h.sw.press('cute');
  h.sw.press('neon');
  h.sw.press('retro');
  h.runFrame();
  assert.deepEqual(h.commits, ['retro']);
  // Each press touched only its own pair.
  assert.equal(h.renders.get('minimal'), 0);
  assert.equal(h.renders.get('luxury'), 0);
});

test('unsubscribed bubbles stop receiving updates', () => {
  const store = createSelectionStore<BrowseKey>('all');
  let n = 0;
  const off = store.subscribeKey('nature', () => n++);
  store.set('nature');
  off();
  store.set('all');
  assert.equal(n, 1);
});

test('the theme index matches filtering and returns the same array every time', () => {
  const index = buildThemeIndex(ALL_THEMES);
  assert.equal(themesForPage(index, null), ALL_THEMES);
  for (const id of CATEGORY_IDS) {
    const page = themesForPage(index, id);
    assert.deepEqual(
      page.map((t) => t.id),
      themesInCategory(ALL_THEMES, id).map((t) => t.id),
      id,
    );
    assert.equal(themesForPage(index, id), page, `${id} is a stable array`);
  }
});

test('progressive reveal: two rows at once, then a few cards per frame, ending at the total', () => {
  assert.deepEqual(revealSteps(0), [0]);
  assert.deepEqual(revealSteps(3), [3]);
  assert.deepEqual(revealSteps(28), [4, 8, 12, 16, 20, 24, 28]);
  assert.equal(revealSteps(28)[0], REVEAL_FIRST);
  assert.equal(nextReveal(26, 28), 28);
  // 28 cards (the biggest category today) are all mounted within 7 frames (~117 ms at 60 Hz).
  assert.ok(revealSteps(28).length <= 7);
});


// --- Source guards for the UI wiring (the cloud can't render React Native) ---

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('bubbles: memoised, subscribed to their own key, selection fade is opacity only', () => {
  const src = strip(read('src', 'ui', 'CategoryBubbleRow.tsx'));
  assert.match(src, /const Bubble = memo\(/);
  assert.match(src, /useIsSelected\(store, page\.key\)/);
  assert.doesNotMatch(src, /selected=\{p\.key === selected\}/, 'no selected prop from the row');
  // The pressed bubble starts its fade in the press handler, before the grid work.
  assert.match(src, /animateTo\(1\);\s*onSelect\(page\.key\)/);
  // Animated styles change opacity only (no size/position animation).
  const animated = [...src.matchAll(/useAnimatedStyle\(\(\) => \{([\s\S]*?)\}, \[/g)].map((m) => m[1]);
  assert.ok(animated.length >= 2);
  for (const body of animated) assert.doesNotMatch(body, /\b(width|height|margin\w*|padding\w*|top|left|right|bottom)\s*:/);
  assert.doesNotMatch(src, /\bset[A-Z]\w*\(/, 'no React state setter in the bubble row');
});

// T177 (owner-1031): the category bubbles, the deferred grid swap and the seasonal banner left the
// Themes tab (src/core/premiumGallery.test.ts guards the new gallery); the memoised panels stay.
test('themes screen: memoised panels below the gallery', () => {
  const src = strip(read('app', '(tabs)', 'themes.tsx'));
  assert.match(src, /<LiveHeroCardM \/>/);
  assert.match(src, /<YourLookPanelM \/>/);
  assert.doesNotMatch(src, /<CategoryBubbleRow\b|const SeasonalBanner = memo\(/);
});

test('showcase grid: no per-card layout/exit/entering animation on a page change', () => {
  const src = strip(read('src', 'ui', 'ShowcaseGrid.tsx'));
  assert.doesNotMatch(src, /LinearTransition/);
  assert.doesNotMatch(src, /exiting=/);
  assert.doesNotMatch(src, /\blayout=\{/);
  assert.doesNotMatch(src, /entering=/, 'no per-card entering animation (fb-1022c: no stagger)');
  assert.match(src, /nextReveal\(/);
  assert.match(src, /const ShowcaseCard = memo\(/);
});

test('home mock: replaying the apply ripple never re-mounts the icons', () => {
  const src = strip(read('src', 'ui', 'HomeMock.tsx'));
  assert.doesNotMatch(src, /key=\{`[^`]*animateKey/);
  assert.doesNotMatch(src, /ZoomIn/);
  assert.match(src, /const PopCell = memo\(/);
});
