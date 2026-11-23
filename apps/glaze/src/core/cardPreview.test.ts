// 1.0.44 theme-card mini Home Screen (src/core/cardPreview.ts): every catalogued theme (the 141 of
// catalog.json + the 111 new ones) and every bundled starter gets a clock and three icons from data the
// gallery already has; geometry stays inside the print at every card width the app uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_PREVIEW_APPS, CARD_PREVIEW_MIN_WIDTH, cardClockSvg, cardIconSpecs, cardPreviewLayout, dockFill } from './cardPreview.ts';
import { remoteArtTheme } from './remoteCatalog.ts';
import { parseCatalog } from './packCatalog.ts';
import { THEMES } from './themes.ts';
import { identityForTheme } from './widgetIdentity.ts';

const APP = join(import.meta.dirname, '..', '..');
const BASE = 'https://packs.test';

function newThemeEntries() {
  return readdirSync(join(APP, 'theme-sources'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const meta = JSON.parse(readFileSync(join(APP, 'theme-sources', d.name, 'meta.json'), 'utf8'));
    const palette = JSON.parse(readFileSync(join(APP, 'theme-sources', d.name, 'palette.json'), 'utf8'));
    return { id: d.name, name: meta.name ?? d.name, packVersion: 1, plus: true, bytes: 10, manifest: `art/${d.name}/v1/manifest.json`, thumb: `art/${d.name}/v1/thumb.0000abcd.webp`, thumbhash: 'AbCd', palette, tags: [], mood: '', addedAt: '2026-11-23', category: meta.category };
  });
}

test('geometry: widget above a three-icon dock, inside the print, at every card width', () => {
  assert.equal(cardPreviewLayout(CARD_PREVIEW_MIN_WIDTH - 1, 300), null);
  assert.equal(cardPreviewLayout(Number.NaN, 300), null);
  for (const w of [88, 103, 112, 144, 155, 170, 260, 297]) {
    const h = Math.round(w * 2.1667);
    const l = cardPreviewLayout(w, h);
    assert.ok(l, `${w}`);
    assert.equal(l.icons.length, 3);
    for (const b of [l.widget, ...l.icons]) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.size <= w && b.y + b.size <= h, `${w}: box outside the print`);
    assert.ok(l.widget.y + l.widget.size < l.dock.y, `${w}: widget overlaps the dock`);
    assert.ok(l.dock.y + l.dock.h <= h && l.dock.x + l.dock.w <= w);
    assert.ok(l.icons.every((b) => b.y >= l.dock.y && b.y + b.size <= l.dock.y + l.dock.h), `${w}: icon outside the dock`);
    assert.ok(l.icons[1].x - (l.icons[0].x + l.icons[0].size) > 2, `${w}: icons touch`);
    // The top of the print stays the art (and room for the Plus badge).
    assert.ok(l.widget.y > h * 0.4, `${w}: preview climbs into the art`);
  }
});

test('the dock reads over dark and light art', () => {
  assert.notEqual(dockFill(0.05).fill, dockFill(0.9).fill);
});

test('all catalogued themes (141 + 111) and bundled starters get a clock and Phone, Messages, Camera without a download', () => {
  const live = JSON.parse(readFileSync(join(APP, 'scripts/packs/artwork-baseline/catalog.json'), 'utf8'));
  const cat = parseCatalog({ format: 'glaze-catalog', version: 1, generatedAt: 'x', packs: [...live.packs, ...newThemeEntries()] });
  assert.ok(cat.ok);
  const themes = [...cat.value.packs.map((p) => remoteArtTheme(p, BASE)), ...THEMES];
  assert.ok(themes.length >= 252, String(themes.length));
  const clocks = new Set<string>();
  for (const t of themes) {
    const icons = cardIconSpecs(t);
    assert.deepEqual(icons.map((s) => s.appId), [...CARD_PREVIEW_APPS], t.id);
    const svg = cardClockSvg(t, 'en-AU');
    assert.ok(svg.startsWith('<svg') && !/NaN|undefined/.test(svg), t.id);
    assert.equal(cardClockSvg(t, 'en-AU'), svg, 'cached');
    clocks.add(svg);
  }
  // Themes with a native identity draw their own clock, so the cards are not one repeated face.
  const withIdentity = themes.filter((t) => identityForTheme(t.id));
  assert.ok(withIdentity.length >= 240, String(withIdentity.length));
  assert.ok(clocks.size > withIdentity.length * 0.9, `only ${clocks.size} distinct clocks`);
});
