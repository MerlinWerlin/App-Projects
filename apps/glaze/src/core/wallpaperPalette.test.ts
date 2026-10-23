// T85: the user's wallpaper photo colours (k-means palette + bounds) for widget contrast pairing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { composite, contrastRatio, hexToRgb, rgbToHex } from './colour.ts';
import { decodePng } from './png.ts';
import { ALL_THEMES } from './plusThemes.ts';
import { PHOTO_PALETTE_K, PHOTO_SAMPLE_SIZE, photoPaletteFromPixels, photoPaletteFromPng, photoWallpaperTokens, wallpaperTokensFor } from './wallpaperPalette.ts';
import { MAX_WALLPAPER_COLOURS, textMinContrast } from './widgetLook.ts';
import { CATALOGUE_KINDS, CATALOGUE_KIND_SIZES, applyCatalogueEdits, buildCatalogueSpec, familyOf } from './widgetKinds.ts';
import { applyWidgetEdits, generateWidgetSetFromTokens, widgetTokensFrom } from './widgetSets.ts';

const dir = new URL('./__fixtures__/packs/pack-aurora-2026/thumbs/', import.meta.url);
const PHOTOS = readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .sort()
  .map((f) => ({ name: f, png: new Uint8Array(readFileSync(new URL(f, dir))) }));

function pixelsOf(rgba: Uint8Array): string[] {
  const out = new Set<string>();
  for (let i = 0; i < rgba.length; i += 4) out.add(rgbToHex({ r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] }));
  return [...out];
}

test('palette: k-means colours plus the darkest and lightest bounds, at most 8', () => {
  assert.equal(PHOTO_PALETTE_K + 2, MAX_WALLPAPER_COLOURS);
  assert.ok(PHOTO_SAMPLE_SIZE.width * PHOTO_SAMPLE_SIZE.height <= 4000);
  for (const { name, png } of PHOTOS) {
    const p = photoPaletteFromPng(png);
    assert.ok(p.colours.length >= 3 && p.colours.length <= MAX_WALLPAPER_COLOURS, name);
    assert.ok(p.colours.includes(p.darkest!) && p.colours.includes(p.lightest!), `${name} keeps both bounds`);
    assert.equal(p.pixels, 48 * 104);
    const img = decodePng(png)!;
    const lo = hexToRgb(p.darkest!);
    const hi = hexToRgb(p.lightest!);
    for (let i = 0; i < img.rgba.length; i += 4) {
      assert.ok(img.rgba[i] >= lo.r && img.rgba[i + 1] >= lo.g && img.rgba[i + 2] >= lo.b);
      assert.ok(img.rgba[i] <= hi.r && img.rgba[i + 1] <= hi.g && img.rgba[i + 2] <= hi.b);
    }
    assert.deepEqual(photoPaletteFromPng(png), p, 'deterministic');
  }
});

test('palette: a flat photo gives one colour; transparent or unreadable input gives none', () => {
  const flat = new Uint8Array(16 * 4);
  for (let i = 0; i < flat.length; i += 4) flat.set([40, 90, 200, 255], i);
  assert.deepEqual(photoPaletteFromPixels(flat).colours, ['#285AC8']);
  const clear = new Uint8Array(16 * 4);
  assert.deepEqual(photoPaletteFromPixels(clear).colours, []);
  assert.deepEqual(photoPaletteFromPixels([]).colours, []);
  assert.deepEqual(photoPaletteFromPng(new Uint8Array([1, 2, 3])).colours, []);
});

test('tokens: the photo replaces the theme wallpaper; failed sampling means unknown, never the theme design', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  assert.ok(tokens.wallpaper.length > 0);
  const sampled = photoPaletteFromPng(PHOTOS[0].png).colours;
  const withPhoto = photoWallpaperTokens(tokens, sampled);
  assert.deepEqual(withPhoto.wallpaper, sampled);
  assert.equal(withPhoto.accent, tokens.accent);
  assert.notEqual(withPhoto.bg, tokens.bg, 'a copy');
  assert.deepEqual(photoWallpaperTokens(tokens, null).wallpaper, []);
  assert.deepEqual(photoWallpaperTokens(tokens, ['nope', '#12345']).wallpaper, []);
  assert.equal(wallpaperTokensFor(tokens, { usesPhoto: false, sampled }), tokens);
  assert.deepEqual(wallpaperTokensFor(tokens, { usesPhoto: true, sampled }).wallpaper, sampled);
  assert.deepEqual(wallpaperTokensFor(tokens, { usesPhoto: true, sampled: null }).wallpaper, []);
});

test('glass widgets solved on the sampled palette stay readable on every pixel of the photo', () => {
  const themes = [ALL_THEMES[0], ALL_THEMES[4], ALL_THEMES[9], ALL_THEMES[20]];
  let checked = 0;
  for (const { name, png } of PHOTOS) {
    const img = decodePng(png)!;
    const pixels = pixelsOf(img.rgba);
    const sampled = photoPaletteFromPng(png).colours;
    for (const theme of themes) {
      const tokens = photoWallpaperTokens(widgetTokensFrom(theme), sampled);
      const specs: { id: string; look: 'clear' | 'tinted'; pane: string; opacity: number; surface: string; texts: { colour: string; min: number; id: string }[] }[] = [];
      for (const look of ['clear', 'tinted'] as const) {
        for (const kind of CATALOGUE_KINDS) {
          for (const size of CATALOGUE_KIND_SIZES[kind].filter((s) => familyOf(s) === 'home')) {
            const s = applyCatalogueEdits(buildCatalogueSpec(tokens, kind, size), { look }).spec;
            if (s.background?.kind !== 'solid') continue;
            const texts = s.regions
              .filter((r) => r.role === 'text' && r.on === 'background' && r.text && r.colour)
              .map((r) => ({ id: r.id, colour: r.colour!, min: textMinContrast(look, r.text!.source, r.text!.sizePt, r.text!.weight) }));
            specs.push({ id: s.id, look, pane: s.background.colour, opacity: s.backgroundOpacity, surface: s.surface, texts });
          }
        }
        for (const s of generateWidgetSetFromTokens(tokens).specs) {
          const e = applyWidgetEdits(s, { look }).spec;
          if (e.background.kind !== 'solid') continue;
          const texts = e.regions
            .filter((r) => r.role === 'text' && r.on === 'background' && r.text && r.colour)
            .map((r) => ({ id: r.id, colour: r.colour!, min: textMinContrast(look, r.text!.source, r.text!.sizePt, r.text!.weight) }));
          specs.push({ id: e.id, look, pane: e.background.colour, opacity: e.backgroundOpacity, surface: e.surface, texts });
        }
      }
      for (const s of specs) {
        if (s.surface !== 'glass') continue;
        const seen = [...new Set(pixels.map((p) => composite(s.pane, s.opacity, p)))];
        for (const tx of s.texts) {
          let worst = Infinity;
          for (const c of seen) worst = Math.min(worst, contrastRatio(tx.colour, c));
          assert.ok(worst >= tx.min - 0.005, `${name} ${s.id} ${s.look} ${tx.id}: ${worst.toFixed(2)} < ${tx.min}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 500, `checked ${checked} text lines`);
});
