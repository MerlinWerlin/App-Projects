// Design review 1.0.32: number-free live art in the widget art menu shows a sample of its live value (the
// widget draws the real one), so the empty calendar frame / focus ring no longer looks broken. Source checks
// (React can't be rendered here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const r = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

test('the art menu draws a live sample on number-free live art, in the theme ink', () => {
  const menu = r('src', 'ui', 'WidgetArtMenu.tsx');
  assert.match(menu, /<LiveArtSample option=\{option\} art=\{place\.rect\} ink=\{option\.liveFrame\?\.ink \?\? themeInk\} \/>/);
  assert.match(r('src', 'ui', 'ThemeWidgetArt.tsx'), /themeInk=\{theme\.palette\.ink\}/);
});

test('the sample never makes up a number: date, focus start and digital time only', () => {
  const s = r('src', 'ui', 'LiveArtSample.tsx');
  assert.match(s, /option\.numberFree === true && f \? liveArtKindOf\(option\.kind\)/);
  assert.match(s, /kind === 'date'/);
  assert.match(s, /kind === 'focus'/);
  assert.match(s, /kind === 'clock' && f\.clockStyle && f\.clockStyle !== 'analog'/);
  assert.doesNotMatch(s, /kind === 'battery'|kind === 'countdown'/);
  // Decorative: the card's own label names the piece.
  assert.match(s, /accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/);
});
