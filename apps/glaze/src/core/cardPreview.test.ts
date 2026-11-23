// 1.0.44 theme-card mini Home Screen (src/core/cardPreview.ts): every catalogued theme (the 141 of
// catalog.json + the 111 new ones) and every bundled starter gets a clock and three icons from data the
// gallery already has; geometry stays inside the print at every card width the app uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_PREVIEW_APPS, CARD_PREVIEW_MIN_WIDTH, cardClockSvg, cardIconSpecs, cardPreviewLayout, cardWidgetKind } from './cardPreview.ts';
import { CARD_ART } from './cardArtPlan.ts';
import { groupByCategory } from './themeBrowse.ts';
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

test('geometry: widget and three icons together in the top band, inside the print, at every card width', () => {
  assert.equal(cardPreviewLayout(CARD_PREVIEW_MIN_WIDTH - 1, 300), null);
  assert.equal(cardPreviewLayout(Number.NaN, 300), null);
  for (const w of [88, 103, 112, 144, 155, 170, 225, 260, 297]) {
    const h = Math.round(w * 2.1667);
    const l = cardPreviewLayout(w, h);
    assert.ok(l, `${w}`);
    assert.equal(l.icons.length, 3);
    for (const b of [l.widget, ...l.icons]) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.size <= w && b.y + b.size <= h, `${w}: box outside the print`);
    const [phone, messages, camera] = l.icons;
    // Phone and Messages on the widget's top row, Camera under Phone; all right of the widget.
    assert.equal(phone.y, l.widget.y);
    assert.equal(messages.y, l.widget.y);
    assert.equal(camera.x, phone.x);
    assert.ok(l.icons.every((b) => b.x > l.widget.x + l.widget.size), `${w}: icon over the widget`);
    assert.ok(messages.x - (phone.x + phone.size) > 2 && camera.y - (phone.y + phone.size) > 2, `${w}: icons touch`);
    assert.ok(Math.abs(camera.y + camera.size - (l.widget.y + l.widget.size)) <= 1, `${w}: cluster not one widget tall`);
    // Under the badge row (8 pt + 22 pt pill); the cluster stays in the top third, the rest is art.
    assert.ok(l.widget.y >= 34, `${w}: under the badge`);
    assert.ok(l.widget.y + l.widget.size < h * (w < 120 ? 0.4 : 0.34), `${w}: cluster out of the top band`);
  }
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

function catalogueThemes() {
  const live = JSON.parse(readFileSync(join(APP, 'scripts/packs/artwork-baseline/catalog.json'), 'utf8'));
  const cat = parseCatalog({ format: 'glaze-catalog', version: 1, generatedAt: 'x', packs: [...live.packs, ...newThemeEntries()] });
  assert.ok(cat.ok);
  return cat.value.packs.map((p) => remoteArtTheme(p, BASE));
}

test('half the cards show an Artwork piece, half the Clock, and each one ships in the app', () => {
  const themes = catalogueThemes();
  const art = themes.filter((t) => cardWidgetKind(t.id) === 'art');
  assert.ok(Math.abs(art.length - themes.length / 2) <= 3, `${art.length} art of ${themes.length}`);
  for (const [id, piece] of Object.entries(CARD_ART)) {
    assert.ok(themes.some((t) => t.id === id), `${id} not catalogued`);
    // Never a functional piece (date, focus, clock, score) standing in for art.
    assert.doesNotMatch(piece, /clock|date|focus|countdown|goal|habit|score|timer|battery|progress/, id);
    const file = join(APP, 'assets', 'card-art', `${id}.webp`);
    assert.ok(existsSync(file), file);
    assert.ok(statSync(file).size < 40_000, `${id}: card art too heavy`);
  }
  assert.equal(readdirSync(join(APP, 'assets', 'card-art')).length, Object.keys(CARD_ART).length);
  assert.equal(cardWidgetKind('a-theme-added-later'), 'clock');
});

test('neighbouring cards in every category rail alternate Clock and Artwork (published catalogue order)', () => {
  const order: { packs: [string, string][] } = JSON.parse(readFileSync(join(APP, 'scripts/packs/card-art-order.json'), 'utf8'));
  const live = JSON.parse(readFileSync(join(APP, 'scripts/packs/artwork-baseline/catalog.json'), 'utf8'));
  // The snapshot is catalog-v2.json: catalog.json's 141 first, then every new theme.
  assert.deepEqual(order.packs.slice(0, 141).map(([id]) => id), live.packs.map((p: { id: string }) => p.id));
  assert.deepEqual(new Set(order.packs.slice(141).map(([id]) => id)), new Set(newThemeEntries().map((e) => e.id)));
  const themes = order.packs.map(([id, category]) => ({ id, category }));
  const sections = groupByCategory(themes as never[]) as unknown as { id: string; themes: { id: string }[] }[];
  for (const s of sections) {
    for (let i = 1; i < s.themes.length; i++) {
      assert.notEqual(cardWidgetKind(s.themes[i - 1].id), cardWidgetKind(s.themes[i].id), `${s.id}: ${s.themes[i - 1].id} and ${s.themes[i].id}`);
    }
  }
});
