// fb-1017 (owner test, 17 Oct): icon shape choices must never truncate or wrap names like
// "Squircle" / "Rounded" across lines. Static UI-check over the source files that render them:
// - Segmented supports `vertical`, and the shape pickers in Settings and Icon Studio pass it;
// - ShapePicker is a vertical list (no horizontal ScrollView) and its labels have no numberOfLines limit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Tests run from the repo root (npm test / node --test).
const root = process.cwd();
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

/** The <Segmented ...> element whose `label` prop uses the given catalogue key. */
function segmentedWith(src: string, labelKey: string): string {
  const parts = src.split('<Segmented').slice(1).map((p) => p.slice(0, p.indexOf('/>')));
  const hit = parts.find((p) => p.includes(`label={t('${labelKey}')}`));
  assert.ok(hit, `no <Segmented> with label ${labelKey}`);
  return hit;
}

test('Segmented has an optional vertical prop that stacks full-width rows', () => {
  const s = read('src/ui/Segmented.tsx');
  assert.match(s, /vertical\?: boolean/);
  assert.match(s, /vertical = false/);
  assert.match(s, /flexDirection: 'column'/);
  assert.match(s, /textAlign: 'auto', flex: 1/);
  assert.doesNotMatch(s, /numberOfLines/);
});

test('shape choices in Settings and Icon Studio are vertical', () => {
  assert.match(segmentedWith(read('app/(tabs)/settings.tsx'), 'settings.style.shapeGroup'), /\bvertical\b/);
  assert.match(segmentedWith(read('app/(tabs)/icons.tsx'), 'icons.shapeLabel'), /\bvertical\b/);
});

test('ShapePicker is a vertical list whose shape labels have no numberOfLines limit', () => {
  const s = read('src/ui/ShapePicker.tsx');
  assert.doesNotMatch(s, /ScrollView/);
  assert.doesNotMatch(s, /numberOfLines/);
  assert.doesNotMatch(s, /noMirror/);
  assert.match(s, /styles\.list/);
  assert.match(s, /tileTextCol: \{ flex: 1, minWidth: 0, gap: (2|spaceV2\.xxs), paddingEnd: (space|spaceV2)\.lg \}/);
  // Each row shows the name and that shape's note; the separate note line under the list is gone.
  assert.match(s, /themeUi\.shape\.notes\.\$\{shape\}/);
  assert.doesNotMatch(s, /themeUi\.shape\.notes\.\$\{value\}/);
  // The selected indicator still slides from measured x/y.
  assert.match(s, /translateY: iy\.value/);
});
