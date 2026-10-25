// fb-1022c (owner test 22 Oct evening): category selection on the Themes screen uses a calm,
// generic transition. No spring, no scale, no overshoot, no stagger, no layout animation: the
// selected bubble fades its tint (~150 ms ease-out), the grid cross-fades (opacity only), the row
// scrolls the bubble into view. Source guards, since the cloud can't mount React Native.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BUBBLE_FADE_MS, GRID_FADE_MS, bubbleLook, pageTransition } from './categoryPaging.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const SPRINGY = /\bwithSpring\b|\.springify\(|\bZoomIn\b|\bBounceIn\b|\bwithSequence\b|\bLinearTransition\b|\blayout=\{/;

test('fb-1022c: the bubble look has no scale and the timings are short', () => {
  for (const p of [0, 0.3, 1]) assert.deepEqual(Object.keys(bubbleLook(p)).sort(), ['glow', 'tint']);
  assert.equal(BUBBLE_FADE_MS, 150);
  assert.ok(GRID_FADE_MS >= 150 && GRID_FADE_MS <= 200);
  const tr = pageTransition(0, 3);
  assert.equal(tr.kind, 'fade');
  assert.ok(!('fromX' in tr));
});

test('fb-1022c: category bubbles use no spring or scale animation', () => {
  const src = strip(read('src', 'ui', 'CategoryBubbleRow.tsx'));
  assert.doesNotMatch(src, SPRINGY);
  assert.doesNotMatch(src, /\bscale\b/, 'no scale anywhere in the bubble row');
  assert.doesNotMatch(src, /springConfig/);
  // The selected state is a timed ease-out fade of opacity.
  assert.match(src, /withTiming\(to, \{ duration: BUBBLE_FADE_MS, easing: easeOutCurve \}\)/);
  const animated = [...src.matchAll(/useAnimatedStyle\(\(\) => \{([\s\S]*?)\}, \[/g)].map((m) => m[1]);
  assert.ok(animated.length >= 1);
  for (const body of animated) {
    assert.match(body, /opacity:/);
    assert.doesNotMatch(body, /transform/);
  }
  // Pressing a bubble dims it; it never shrinks.
  assert.match(src, /feedback="fade"/);
  // The selected bubble still scrolls into view.
  assert.match(src, /scrollTo\(\{ x, animated \}\)/);
});

test('fb-1022c: the grid cross-fades on a category change (opacity only, no stagger)', () => {
  const src = strip(read('src', 'ui', 'ShowcaseGrid.tsx'));
  assert.doesNotMatch(src, SPRINGY);
  assert.doesNotMatch(src, /entering=/);
  assert.doesNotMatch(src, /staggerDelay|translateX|transform/);
  assert.match(src, /useAnimatedStyle\(\(\) => \(\{ opacity: fade\.value \}\)\)/);
  assert.match(src, /withTiming\(1, \{ duration: tr\.durationMs, easing: easeOutCurve \}\)/);
  // T107's performance work stays: progressive reveal and memoised cards.
  assert.match(src, /nextReveal\(/);
  assert.match(src, /const ShowcaseCard = memo\(/);
});

test('fb-1022c: press feedback and selected cards never spring', () => {
  for (const f of [['src', 'ui', 'PressableScale.tsx'], ['src', 'ui', 'SquircleCard.tsx']]) {
    const src = strip(read(...f));
    assert.doesNotMatch(src, /\bwithSpring\b|springConfig/, f.join('/'));
  }
});

test('fb-1022c: the Themes screen has no stagger and no centred-card pop', () => {
  const src = strip(read('app', '(tabs)', 'themes.tsx'));
  assert.doesNotMatch(src, SPRINGY);
  assert.doesNotMatch(src, /setPopKeys|onMomentumScrollEnd|firstMount/);
  assert.match(src, /popKeys: NO_POPS/);
  assert.match(src, /const nextSlot = \(_n: number\): number \| undefined => undefined;/);
  // T107's deferred grid swap stays.
  assert.match(src, /startTransition\(\(\) => \{\s*setCategory/);
});

// Owner 25 Oct (glaze-retest C + glaze-test-latest): "the bounce transitions in this part need to
// go". The shared sheet (Live Photo guide, Save to Photos, Plus) and the Live Photo screens use
// timed ease-out or plain fades only.
test('owner 25 Oct: the sheet and the Live Photo screens never spring or bounce', () => {
  const files = [
    ['src', 'ui', 'Sheet.tsx'],
    ['src', 'ui', 'LivePhotoSheet.tsx'],
    ['src', 'ui', 'LiveSaveToPhotos.tsx'],
    ['src', 'ui', 'LivePhotoGuide.tsx'],
    ['app', '(tabs)', 'live.tsx'],
    ['app', 'live', '[id].tsx'],
  ];
  for (const f of files) {
    // `layout={layout}` in the Live editor is the crop rectangle prop, not a layout animation.
    const src = strip(read(...f)).replace(/layout=\{layout\}/g, '');
    assert.doesNotMatch(src, SPRINGY, f.join('/'));
    assert.doesNotMatch(src, /springConfig|FadeInDown|staggerIn\(/, f.join('/'));
  }
  assert.match(strip(read('src', 'ui', 'Sheet.tsx')), /SlideInDown\.duration\(durations\.base\)\.easing\(easeOutCurve\)/);
});

// Owner 25 Oct (glaze-retest A): picking a theme on the Widgets tab also re-themes the Home Screen
// widgets (it used to change the in-app previews only).
test('owner 25 Oct: the Widgets tab theme pick writes the theme to the Home Screen widgets', () => {
  const src = strip(read('app', '(tabs)', 'widgets.tsx'));
  assert.match(src, /import \{ applyWidgetTheme \} from '\.\.\/\.\.\/src\/store\/widgetTheme'/);
  const pick = /const pickTheme = \(id: string\) => \{([\s\S]*?)\n  \};/.exec(src);
  assert.ok(pick, 'pickTheme found');
  assert.match(pick[1], /setPicked\(id\)/);
  assert.match(pick[1], /applyWidgetTheme\(next\)/);
});
