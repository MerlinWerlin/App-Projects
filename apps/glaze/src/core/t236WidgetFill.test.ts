// T236 (owner-1101g #1, TestFlight build 18: Saturn art letterboxed in a light-grey frame): widget
// art FILLS the widget edge to edge, no grey/light frame ever, subject never cut. Pure placement
// (fullBleedArt) plus source guards on the bridge, the Seamless widget and its Edit Widget layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPTION_SIZE_POINTS } from './widgetOptions.ts';
import { fullBleedArt, SEAMLESS_FILL_MIN_ASPECT_MATCH } from './widgetPreview.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const area = (r: { w: number; h: number }) => r.w * r.h;

test('fullBleedArt: art whole with no inset; strips + art cover the whole box; never cropped', () => {
  const arts = [
    { w: 1024, h: 1024 },
    { w: 1092, h: 510 },
    { w: 900, h: 1200 },
    { w: 3000, h: 400 },
    { w: 300, h: 2000 },
  ];
  for (const box of Object.values(OPTION_SIZE_POINTS)) {
    for (const art of arts) {
      const p = fullBleedArt(art, box);
      // Inside the box.
      assert.ok(p.rect.x >= -1e-9 && p.rect.y >= -1e-9, 'inside');
      assert.ok(p.rect.x + p.rect.w <= box.w + 1e-9 && p.rect.y + p.rect.h <= box.h + 1e-9, 'inside');
      if (p.edgeToEdge) {
        assert.deepEqual(p.rect, { x: 0, y: 0, w: box.w, h: box.h });
        assert.deepEqual(p.strips, []);
        continue;
      }
      // Own aspect, no inset: it spans the box in one dimension.
      close(p.rect.w / p.rect.h, art.w / art.h, 1e-9);
      assert.ok(Math.abs(p.rect.w - box.w) < 1e-9 || Math.abs(p.rect.h - box.h) < 1e-9, 'no inset');
      // Centred, and the strips fill exactly the rest: no theme colour can show as a frame.
      close(p.rect.x * 2 + p.rect.w, box.w, 1e-9);
      close(p.rect.y * 2 + p.rect.h, box.h, 1e-9);
      assert.equal(p.strips.length, 2);
      close(area(p.rect) + p.strips.reduce((s, r) => s + area(r), 0), area(box), 1e-6);
    }
  }
});

test('fullBleedArt: edge to edge within 2 % of the aspect, else extended', () => {
  assert.equal(fullBleedArt({ w: 100, h: 100 }, { w: 170, h: 170 }).edgeToEdge, true);
  assert.equal(fullBleedArt({ w: 101.5, h: 100 }, { w: 100, h: 100 }).edgeToEdge, true);
  const off = fullBleedArt({ w: 105, h: 100 }, { w: 100, h: 100 });
  assert.equal(off.edgeToEdge, false);
  assert.equal(off.strips.length, 2);
  // Square (Saturn) art in a large widget: whole, full width, thin strips above and below.
  const saturn = fullBleedArt({ w: 1024, h: 1024 }, OPTION_SIZE_POINTS.large);
  assert.equal(saturn.rect.w, 364);
  assert.equal(saturn.rect.x, 0);
  close(saturn.strips[0].h, 9);
  // Degenerate input never throws or produces NaN.
  const bad = fullBleedArt({ w: 0, h: Number.NaN }, { w: 10, h: 20 });
  assert.ok([bad.rect.x, bad.rect.y, bad.rect.w, bad.rect.h].every(Number.isFinite));
});

test('bridge setWidgetArt: full bleed, no 6 % inset, no veil, edges extended, raw art written', () => {
  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  const setArt = bridge.slice(bridge.indexOf('AsyncFunction("setWidgetArt")'), bridge.indexOf('AsyncFunction("linkStatus")')) +
    // T252: the composition itself lives in the shared helper (also used by composeWidgetArtPiece).
    bridge.slice(bridge.indexOf('private static func composeArtImage('), bridge.indexOf('private static func reloadWidgets()'));
  const code = setArt.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /0\.06/, 'no 6 % pad');
  assert.doesNotMatch(code, /insetBy/, 'no inset');
  assert.doesNotMatch(code, /withAlphaComponent/, 'no veil of the theme colour');
  // T251 (owner-1101h #2): the blurred extended edges read as a light-grey frame: gone. The art is
  // blended (keyed / feathered) and drawn on the theme colour.
  assert.doesNotMatch(code, /clampedToExtent|CIGaussianBlur|CIFilter/);
  assert.match(code, /let art = GlazeArtBlend\.blended\(loaded\)/);
  assert.match(code, /art\.draw\(in: artRect\)/);
  assert.match(code, /"seamless-\\\(family\)-art\.png"/);
  assert.match(code, /downscale\(art, maxEdge: 1200\)\.pngData\(\)/);
  // The wallpaper path keeps its inset hero; T251: it blends the hero, writes it as the raw art and
  // drops a stale file when there is no hero. T252: the composition lives in the shared helper.
  const setSeam = bridge.slice(bridge.indexOf('AsyncFunction("setSeamless")'), bridge.indexOf('AsyncFunction("setWidgetArt")')) +
    bridge.slice(bridge.indexOf('private static func composeSeamlessImage('), bridge.indexOf('private static func composeArtImage('));
  assert.match(setSeam, /\* 0\.06/);
  assert.match(setSeam, /GlazeArtBlend\.blended\(\$0\)/);
  assert.match(setSeam, /let heroURL = container\.appendingPathComponent\("seamless-\\\(family\)-art\.png"\)/);
  assert.match(setSeam, /removeItem\(at: heroURL\)/);
});

test('library: <id>-art.png copied beside <id>.jpg when present and kept by the index', () => {
  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  const save = bridge.slice(bridge.indexOf('AsyncFunction("saveWidgetArtPiece")'), bridge.indexOf('AsyncFunction("getWidgetArtLibrary")'));
  assert.match(save, /"\\\(id\)-art\.png"/);
  assert.match(save, /if FileManager\.default\.fileExists\(atPath: rawSource\.path\)/, 'optional: older sources still work');
  assert.match(save, /copyItem\(at: rawSource, to: rawDest\)/);
  const index = bridge.slice(bridge.indexOf('AsyncFunction("setWidgetArtIndex")'));
  assert.match(index, /keep\.insert\("\\\(id\)-art\.png"\)/);
});

test('Seamless widget: Edit Widget Layout Fill (default) / Fit; Fill never shows the theme as a frame', () => {
  const lib = read('targets', 'widget', 'WidgetArtLibrary.swift');
  assert.match(lib, /@Parameter\(title: "Layout", default: \.fill\)\s*var layout: ArtLayout/);
  assert.match(lib, /enum ArtLayout: String, AppEnum \{\s*case fill\s*case fit/);
  assert.match(lib, /\.fill: "Fill",\s*\.fit: "Fit"/);
  assert.match(lib, /layout: configuration\.layout/);
  assert.match(lib, /"\\\(id\)-art\.png"/);
  const widget = read('targets', 'widget', 'SeamlessWidget.swift');
  assert.match(widget, /SeamlessWidgetView\(theme: entry\.theme, pieceID: entry\.pieceID, layout: entry\.layout(, date: entry\.date)?\)/);
  assert.match(widget, /let fit = layout == \.fit/, 'nil and .fill both mean Fill');
  assert.match(widget, /"seamless-\\\(name\)-art\.png"/);
  // Fill branch: full-opacity blur, no GlazeBackground, no opacity veil.
  const fill = widget.slice(widget.indexOf('} else {\n            // T236 Fill'), widget.indexOf('} else {\n        GlazeBackground'));
  assert.ok(fill.length > 100, 'Fill branch found');
  assert.doesNotMatch(fill, /GlazeBackground|\.opacity\(/);
  // T251: no blur at all; the plain theme gradient (no material / outline) only behind the image.
  assert.doesNotMatch(fill, /\.blur\(/);
  assert.match(fill, /ArtBackdrop\(theme: t\)/);
  assert.match(widget, /seamlessFillMinAspectMatch: CGFloat = 0\.97/);
  assert.equal(SEAMLESS_FILL_MIN_ASPECT_MATCH, 0.97);
  // Fit branch: the raw art whole, inset, on the theme background.
  const fit = widget.slice(widget.indexOf('if fit {'), widget.indexOf('// T236 Fill'));
  assert.match(fit, /ArtBackdrop\(theme: t\)/, 'T251: plain gradient behind the blended raw art, no panel / outline');
  assert.match(fit, /Image\(uiImage: raw \?\? image\)\s*\.resizable\(\)\s*\.scaledToFit\(\)\s*\.padding\(inset\)/);
  // The new literals are localised in every language.
  const en = read('targets', 'widget', 'en.lproj', 'Localizable.strings');
  for (const k of ['Layout', 'Fill', 'Fit']) assert.match(en, new RegExp(`^"${k}" = "${k}";$`, 'm'));
});
