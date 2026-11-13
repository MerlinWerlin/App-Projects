// Owner 2026-11-14: a theme with no artwork (all 63 built-in themes; the packs all have 2-5) showed a
// blank grey Artwork tile on the Home Screen. It now shows a simple scene in the theme's colours. And
// My widget art is the one list: big number and large artwork side by side, no separate picker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const r = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8').replace(/\r\n/g, '\n');

test('an Artwork slot with no piece draws a theme-coloured scene, never a plain tile', () => {
  const slots = r('targets', 'widget', 'ThemeArtWidgets.swift');
  assert.match(slots, /ThemedFallbackArt\(theme: entry\.theme, variant: entry\.sample\)/);
  assert.match(slots, /preview: preview, sample: slot - 1\)/);
  const art = r('targets', 'widget', 'GallerySamples.swift');
  const fb = art.slice(art.indexOf('struct ThemedFallbackArt'));
  assert.match(fb, /theme\.accentColor/);
  assert.doesNotMatch(fb.replace(/^\s*\/\/.*$/gm, ''), /UIImage|FileManager|ThemeStore/);
});

test('My widget art: big number and large artwork on one line; the separate art picker is gone', () => {
  const list = r('src', 'ui', 'WidgetArtLibraryList.tsx');
  assert.match(list, /const THUMB = 132;/);
  assert.match(list, /const NUMBER = 64;/);
  const tab = r('app', '(tabs)', 'widgets.tsx');
  assert.doesNotMatch(tab, /<ThemeWidgetArt\b/);
  assert.match(tab, /<WidgetArtLibraryList refreshKey=\{artLibKey\}/);
  assert.match(r('src', 'i18n', 'ns', 'ui', 'en.ts'), /empty: 'This theme has no artwork yet\./);
});
