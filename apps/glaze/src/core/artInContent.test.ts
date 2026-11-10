// Owner 2026-11-10 (Home Screen screenshot): the art widgets sat on a lighter frosted panel with a
// bright rim while the designed Clock beside them kept its colour. iOS may put its own glass over a
// widget's container background; the Clock draws its face in the content. These guards keep the
// art in the content too, with its own colours on tinted Home Screens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'targets', 'widget', 'SeamlessWidget.swift'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, '');
const between = (a: string, b: string) => {
  const i = src.indexOf(a);
  assert.ok(i >= 0, a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(j > i, b);
  return strip(src.slice(i, j));
};

test('art widgets draw the art in the content, never in the container background', () => {
  const art = between('@ViewBuilder private var artBody', 'struct SeamlessArtLayer');
  assert.match(art, /if let image = image \{\n\s*SeamlessArtLayer\(image: image, raw: raw, fit: fit, theme: t\)/);
  const bg = art.slice(art.indexOf('.containerBackground(for: .widget)'));
  assert.doesNotMatch(bg, /Image\(uiImage/);
  assert.doesNotMatch(bg, /SeamlessArtLayer/);
  assert.match(bg, /if image != nil \{ ArtBackdrop\(theme: t\) \} else \{ GlazeBackground\(theme: t\) \}/);
});

test('every art image keeps its own colours on tinted Home Screens (iOS 18+)', () => {
  const layer = between('struct SeamlessArtLayer', 'extension Image {');
  const images = layer.match(/Image\(uiImage:[^)]*\)\n\s*\.resizable\(\)\n\s*\.glazeArtFullColor\(\)/g) ?? [];
  assert.equal(images.length, 3);
  assert.equal((layer.match(/Image\(uiImage:/g) ?? []).length, 3);
  assert.match(src, /if #available\(iOS 18\.0, \*\) \{ return self\.widgetAccentedRenderingMode\(\.fullColor\) \}/);
});

test('the designed Clock is unchanged: face in the content, gradient as the container background', () => {
  assert.match(src, /DesignedWidgetContent\(spec: design, date: date\)\n\s*\.containerBackground\(for: \.widget\)/);
});
