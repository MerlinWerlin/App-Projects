// Owner 2026-11-09 (build 65 / 1.0.20: "it hasn't fixed it ... this was not an issue in like build 40"):
// after a theme swap the whole Glaze page of the Add Widget gallery kept the old theme while placed
// widgets swapped. iOS renders every gallery preview of the app in ONE widget extension process with
// a small memory limit; over it, iOS stops the extension and keeps the old previews. The extension's
// gallery code was unchanged from build 41 to 1.0.13 (build 51); 1.0.14 (#252, build 53) added the
// Art tiles, each decoding its full composed image. 1.0.20 (#258) thumbnailed plain art only, so the
// live pieces in the later Art tiles still decoded in full. These guards keep the gallery path to
// thumbnails for every art tile, so the gallery's cost cannot grow back with full images again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPTION_SIZE_POINTS } from './widgetOptions.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8').replace(/\r\n/g, '\n');
const W = (f: string) => read('targets', 'widget', f);
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, '');

const seamless = W('SeamlessWidget.swift');
const slots = W('ThemeArtWidgets.swift');
const library = W('WidgetArtLibrary.swift');

function body(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `found ${start}`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b > a, `found ${end} after ${start}`);
  return strip(src.slice(a, b));
}

test('gallery Art tiles: every tile with a piece goes through SeamlessWidgetView in preview mode (live pieces included)', () => {
  const view = body(slots, 'struct ThemeArtSlotView', 'enum ThemeArtKind');
  assert.match(view, /SeamlessWidgetView\([^)]*preview: entry\.preview\)/);
  // No separate plain-art-only shortcut that lets live pieces fall through to a full decode.
  assert.doesNotMatch(view, /LiveArtStore\.spec/);
  assert.doesNotMatch(view, /UIImage\(contentsOfFile/);
});

test('gallery Art tiles: the slot list reads index.json once per tile, not once per piece', () => {
  const pieces = body(slots, 'static func pieces(family: WidgetFamily)', 'static func piece(slot:');
  assert.doesNotMatch(pieces, /LiveArtStore\.spec/);
  assert.match(pieces, /!\$0\.design/);
  assert.match(library, /design: LiveArtSpec\.parse\(p\["live"\]\)\?\.design != nil/);
});

test('SeamlessWidgetView: the preview path only ever decodes thumbnails, never the full composed image or raw art', () => {
  const art = body(seamless, '@ViewBuilder private var artBody', '.frame(maxWidth: .infinity');
  assert.match(art, /let image = preview\n\s*\? WidgetArtStore\.preview\(pieceID, preferSize: SeamlessStore\.familyName\(family\)\) \?\? SeamlessStore\.preview\(family\)\n\s*: WidgetArtStore\.load\(/);
  assert.match(art, /fit && !live && !preview \?/);
  const preview = body(library, 'static func preview(_ id: String?', '/// T238/T252: the current theme');
  assert.doesNotMatch(preview, /UIImage\(contentsOfFile/);
  assert.equal((preview.match(/GalleryThumbnail\.load\(/g) ?? []).length, 2);
  const store = body(seamless, 'static func preview(_ family: WidgetFamily)', 'static func loadArt(');
  assert.doesNotMatch(store, /UIImage\(contentsOfFile/);
  assert.match(store, /GalleryThumbnail\.load\(/);
});

test('GalleryThumbnail: ImageIO downsampling capped at 360 px (no full-size decode first)', () => {
  const thumb = body(seamless, 'enum GalleryThumbnail', 'enum SeamlessStore');
  assert.match(thumb, /static let maxPixels = 360/);
  assert.match(thumb, /CGImageSourceCreateThumbnailAtIndex/);
  assert.match(thumb, /kCGImageSourceThumbnailMaxPixelSize: maxPixels/);
  assert.match(thumb, /kCGImageSourceShouldCache: false/);
  assert.doesNotMatch(thumb, /UIImage\(contentsOfFile/);
});

test('both art providers mark the gallery: isPreview snapshots and placeholders render in preview mode', () => {
  const art = body(library, 'struct ArtProvider', 'func timeline(');
  assert.match(art, /pieceID: nil, layout: nil, preview: true\)/);
  assert.match(art, /layout: configuration\.layout, preview: context\.isPreview\)/);
  assert.match(seamless, /SeamlessWidgetView\(theme: entry\.theme, pieceID: entry\.pieceID, layout: entry\.layout, date: entry\.date, preview: entry\.preview\)/);
  const slotProvider = body(slots, 'struct ThemeArtProvider', 'struct ThemeArtSlotView');
  assert.match(slotProvider, /entry\(nil, family: context\.family, preview: true\)/);
  assert.match(slotProvider, /preview: context\.isPreview\)/);
  // Placed widgets (timelines) keep full images.
  assert.doesNotMatch(body(slots, 'func timeline(', 'struct ThemeArtSlotView'), /preview: true/);
});

test('gallery memory model: thumbnails keep all Art tiles far under the limit; full images did not', () => {
  // Visible gallery tiles from the Swift constants: Art 1 small/medium/large, Art 2..6 small and
  // large up to the gallery slot counts.
  const small = Number(/gallerySmallSlots = (\d+)/.exec(slots)?.[1]);
  const large = Number(/galleryLargeSlots = (\d+)/.exec(slots)?.[1]);
  assert.ok(small >= 1 && large >= 1);
  const scale = 3; // iPhone @3x: the composed piece is the widget's pixel size.
  const bytes = (w: number, h: number) => w * h * 4;
  const full = (s: 'small' | 'medium' | 'large') => bytes(OPTION_SIZE_POINTS[s].w * scale, OPTION_SIZE_POINTS[s].h * scale);
  const fullTotal = small * full('small') + full('medium') + large * full('large');
  const thumb = (s: 'small' | 'medium' | 'large') => {
    const { w, h } = OPTION_SIZE_POINTS[s];
    const k = 360 / Math.max(w * scale, h * scale);
    return bytes(Math.round(w * scale * k), Math.round(h * scale * k));
  };
  const thumbTotal = small * thumb('small') + thumb('medium') + large * thumb('large');
  const MB = 1024 * 1024;
  // Full images alone were ~30 MB (11 tiles): the whole widget extension budget.
  assert.ok(fullTotal > 25 * MB, `full ${(fullTotal / MB).toFixed(1)} MB`);
  assert.ok(thumbTotal < 6 * MB, `thumbnails ${(thumbTotal / MB).toFixed(1)} MB`);
});
