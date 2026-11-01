// T173 premium UI, Themes browse second slice (docs/PREMIUM_UI.md §3.2): the seasonal banner and the
// Live hero speak the editorial surface + eyebrow language (no hairline, surfaceRaised in dark mode,
// tokens only, Dynamic Type caps, labels kept, no bounce), and wide phones lead the starter showcase
// with one feature card whose preview is larger than a grid card's.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  FEATURE_MIN_WIDTH,
  featureArtWidth,
  showcaseCardWidth,
  showcaseColumns,
  showcaseFeature,
  showcaseRowWidth,
} from './categoryPaging.ts';
import { editorialV2, spaceV2 } from './designV2.ts';
import { lookup } from './i18n.ts';
import { CATALOGUES } from '../i18n/locales/index.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const THEMES = strip(read('app', '(tabs)', 'themes.tsx'));
const HERO = strip(read('src', 'ui', 'LiveHeroCard.tsx'));
const GRID = strip(read('src', 'ui', 'ShowcaseGrid.tsx'));

// T177 (owner-1031): the seasonal banner and the starter showcase left the Themes tab; the banner
// guard is retired, the feature-card guards stay on ShowcaseGrid (src/core/premiumGallery.test.ts
// guards the new gallery).

test('feature card: only on wide phones with two columns; its art is larger than a grid card', () => {
  assert.equal(showcaseFeature(393, 2), false, 'standard phones keep the plain grid');
  assert.equal(showcaseFeature(402, 2), false);
  assert.equal(showcaseFeature(FEATURE_MIN_WIDTH, 2), true);
  assert.equal(showcaseFeature(440, 1), false);
  assert.equal(showcaseFeature(Number.NaN, 2), false);
  for (const w of [414, 428, 430, 440]) {
    const cols = showcaseColumns(w);
    const gap = editorialV2.cardGap;
    const card = showcaseCardWidth(w, cols, spaceV2.lg, gap);
    const row = showcaseRowWidth(card, cols, gap);
    const art = featureArtWidth(row, card);
    assert.ok(row <= w - spaceV2.lg * 2, `${w}: row fits between the gutters`);
    assert.ok(art > card, `${w}: feature art ${art} > grid card ${card}`);
    assert.ok(row - art >= 140, `${w}: room for the name beside the art (${row - art})`);
  }
});

test('feature card lives inside the one showcase grid (no new list rows, same reveal, still preview)', () => {
  assert.match(GRID, /const featured = feature && themes\.length > 1 && showcaseFeature\(width, columns\)/);
  assert.match(GRID, /const FeatureCard = memo\(/);
  assert.match(GRID, /isMounted\(i, revealed, kept, theme\.id\)/);
  const card = GRID.slice(GRID.indexOf('const FeatureCard = memo('));
  assert.match(card, /\n\s*still\n/);
  assert.match(card, /accessibilityLabel=\{label\}/);
  assert.match(card, /accessibilityHint=\{t\('themeUi\.card\.hint'\)\}/);
  assert.match(card, /<HeartButton\b/);
  assert.doesNotMatch(GRID, /getItemLayout/);
  // T253 (owner-1101h, 100+ themes): the Themes tab's rails and thumbnail grid have fixed card
  // geometry, so they use getItemLayout, always through the core helpers (src/core/themeBrowse.ts).
  for (const m of THEMES.matchAll(/getItemLayout=\{(\w+)\}/g)) assert.match(m[1], /^(getItemLayout|getGridLayout)$/);
  assert.match(THEMES, /railItemLayout\(shared\.railWidth, gap, index\)/);
  assert.match(THEMES, /gridItemLayout\(geo\.rowHeight, listTop, index\)/);
});

test('Live hero: raised surface without a hairline, an eyebrow, caps on every Text, label and hint kept', () => {
  assert.match(HERO, /<SquircleCard\b/);
  assert.match(HERO, /tone=\{scheme === 'dark' \? 'raised' : 'surface'\}/);
  assert.match(HERO, /outline=\{false\}/);
  assert.match(HERO, /eyebrowCaseFor\(script\)/);
  assert.match(HERO, /t\('liveUi\.lock\.title'\)/);
  assert.match(HERO, /accessibilityLabel=\{t\('liveUi\.hero\.a11y'/);
  assert.match(HERO, /accessibilityHint=\{t\('liveUi\.hero\.hint'\)\}/);
  assert.match(HERO, /cta: \{[^}]*minHeight: sizeV2\.touch/);
  const tags = [...HERO.matchAll(/<Text\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(tags.length >= 4);
  assert.deepEqual(tags.filter((x) => !/maxFontSizeMultiplier=/.test(x)), []);
});

test('the slice adds no raw design values and no bounce', () => {
  // Same patterns as designGuard.test.ts (raw hex / rgba, numeric fontSize, numeric radius).
  const raw = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?!\w)|\brgba?\(|\bfontSize\s*[:=]\s*[{'"]?\s*\d|\bborder(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius\s*[:=]\s*\{?\s*\d/;
  for (const [name, src] of [['LiveHeroCard.tsx', HERO], ['themes.tsx', THEMES]]) assert.doesNotMatch(src, raw, name);
  for (const src of [HERO, GRID, THEMES]) {
    assert.doesNotMatch(src, /\bwithSpring\b|\.springify\(|\bBounceIn\b|\bZoomIn\b|withSequence/);
  }
});

test('the seasonal eyebrow is translated in every locale', () => {
  const locales = Object.keys(CATALOGUES);
  assert.equal(locales.length, 11);
  for (const l of locales) {
    const v = lookup(CATALOGUES[l as keyof typeof CATALOGUES], 'themes.eyebrow.season');
    assert.ok(typeof v === 'string' && v.trim().length > 0, `${l}: themes.eyebrow.season`);
  }
});
