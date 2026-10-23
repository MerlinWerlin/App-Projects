// T92 (D79-2): every catalogue widget kind renders in every look without throwing.
//
// React can't be rendered here (no node_modules), so CatalogueWidgetPreview takes everything it
// draws from catalogueWidgetModel (pure core). This file runs that model for every theme × kind ×
// size × look, and guards the component's source so it keeps using the model and handles every
// draw kind and every symbol a spec can ask for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHex, minContrast } from './colour.ts';
import { formatDate, formatNumber, type DateOptions, type NumberOptions } from './i18n.ts';
import { ALL_THEMES } from './plusThemes.ts';
import { WIDGET_LOOKS, textMinContrast, type WidgetLook } from './widgetLook.ts';
import {
  CATALOGUE_KINDS,
  CATALOGUE_KIND_SIZES,
  applyCatalogueEdits,
  buildCatalogueSpec,
  catalogueLooksFor,
  familyOf,
  type CatalogueKind,
  type CatalogueRegion,
  type CatalogueSpec,
} from './widgetKinds.ts';
import { widgetTokensFrom } from './widgetSets.ts';
import {
  CATALOGUE_REGION_DRAWS,
  GLASS_RIM,
  LOCK_STAGE,
  catalogueWidgetModel,
  haloColour,
  regionDraw,
  type CatalogueRegionDraw,
  type CatalogueWidgetFormat,
  type CatalogueWidgetModel,
} from './catalogueWidgetModel.ts';

const here = dirname(fileURLToPath(import.meta.url));
const COMPONENT = join(here, '..', 'ui', 'CatalogueWidgetPreview.tsx');

const NOW = new Date('2026-10-18T09:41:00Z');

function formatFor(locale: string): CatalogueWidgetFormat {
  return {
    t: (key: string) => `«${key}»`,
    formatNumber: (n: number, o?: NumberOptions) => formatNumber(n, locale, o),
    formatDate: (d: Date, o?: DateOptions) => formatDate(d, locale, o),
  };
}
const EN = formatFor('en');

/** What each kind must visibly draw: at least one region with one of these draws. */
const ESSENTIAL: Readonly<Record<CatalogueKind, readonly CatalogueRegionDraw[]>> = {
  analogClock: ['dial'],
  monthCalendar: ['grid'],
  countdown: ['text'],
  yearProgress: ['dots', 'meter', 'text'],
  monthProgress: ['dots', 'meter', 'text'],
  photoAlbum: ['fill'],
  habitWater: ['meter', 'glyph', 'text'],
  habitMood: ['glyph', 'text', 'action'],
  habitSleep: ['meter', 'glyph', 'text'],
  habitSteps: ['meter', 'glyph', 'text'],
};

const RGBA = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1)\.\d\d\)$/;

function model(spec: CatalogueSpec, extra: Partial<Parameters<typeof catalogueWidgetModel>[0]> = {}): CatalogueWidgetModel {
  return catalogueWidgetModel({ spec, width: 160, now: NOW, hairline: 0.5, format: EN, ...extra });
}

/** No throw, something to see, sane geometry and colours, readable text. */
function assertRenders(spec: CatalogueSpec, m: CatalogueWidgetModel, where: string): void {
  assert.ok(m.regions.length > 0, `${where}: no regions`);
  assert.equal(m.regions.length, spec.regions.length, `${where}: one model per region`);
  assert.ok(m.drawW > 0 && m.height > 0 && Number.isFinite(m.scale) && m.scale > 0, `${where}: size`);
  const essentials = ESSENTIAL[spec.kind];
  assert.ok(m.regions.some((r) => essentials.includes(r.draw)), `${where}: draws none of ${essentials.join('/')}`);
  for (const r of m.regions) {
    const at = `${where} ${r.region.id}`;
    assert.notEqual(r.draw, 'none', `${at}: draws nothing`);
    assert.ok(CATALOGUE_REGION_DRAWS.includes(r.draw), `${at}: draw ${r.draw}`);
    for (const v of [r.box.start, r.box.top, r.box.width, r.box.height]) assert.ok(Number.isFinite(v) && v >= 0, `${at}: box ${JSON.stringify(r.box)}`);
    assert.ok(r.box.start + r.box.width <= m.drawW + 0.5 && r.box.top + r.box.height <= m.height + 0.5, `${at}: box outside the widget`);
    assert.ok(isHex(r.colour), `${at}: colour ${r.colour}`);
    assert.ok(r.opacity > 0 && r.opacity <= 1, `${at}: opacity ${r.opacity}`);
    if (r.draw === 'text') {
      assert.ok(r.text.trim().length > 0, `${at}: empty text`);
      assert.ok(!r.text.includes('undefined') && !r.text.includes('NaN'), `${at}: text "${r.text}"`);
    }
    if (r.draw === 'text' || r.draw === 'grid') assert.ok(r.textSize >= 6 && r.lineHeight >= r.textSize, `${at}: text size`);
    if (r.draw === 'grid') {
      assert.ok(r.grid && r.grid.heads.length === 7 && r.grid.heads.every((h) => h.length > 0), `${at}: grid heads`);
      assert.ok(r.grid.weeks.length >= 4 && r.grid.weeks.every((w) => w.length === 7), `${at}: grid weeks`);
      assert.equal(r.grid.weeks.flat().filter((c) => c.today).length, 1, `${at}: one today cell`);
    }
    if (r.draw === 'meter') assert.ok(r.level >= 0 && r.level <= 1, `${at}: level ${r.level}`);
    if (r.draw === 'glyph' || r.draw === 'action') assert.ok(r.symbol, `${at}: symbol`);
    if (r.halo) assert.ok(m.glow && ['text', 'grid', 'glyph'].includes(r.draw), `${at}: halo without glow`);
    // Readable: the colour the model draws is the one the core checked, and it passes.
    if (!m.mono && r.region.backdrop.length > 0) {
      const real = minContrast(r.colour, r.region.backdrop);
      if (r.region.role === 'text' && r.region.text) {
        const min = textMinContrast(spec.look, r.region.text.source, r.region.text.sizePt, r.region.text.weight);
        assert.ok(real >= min - 0.01, `${at}: text contrast ${real} < ${min}`);
      } else assert.ok(real >= 2.99, `${at}: graphic contrast ${real}`);
    }
  }
  if (m.mono) {
    assert.ok(m.stage && m.stage.colour === LOCK_STAGE, `${where}: lock stage`);
    assert.equal(m.glow, null);
    assert.equal(m.pane, false);
  } else {
    assert.equal(m.stage, null);
    assert.equal(m.frame.width, 160);
    assert.ok(m.frame.borderRadius >= 0 && m.frame.borderWidth >= 0, `${where}: frame`);
  }
}

test('every catalogue kind renders in all four looks for every theme (home sizes)', () => {
  let count = 0;
  for (const theme of ALL_THEMES) {
    const tokens = widgetTokensFrom(theme);
    for (const kind of CATALOGUE_KINDS) {
      for (const size of CATALOGUE_KIND_SIZES[kind].filter((s) => familyOf(s) === 'home')) {
        const base = buildCatalogueSpec(tokens, kind, size);
        for (const look of WIDGET_LOOKS) {
          const where = `${theme.id} ${kind}/${size}/${look}`;
          const { spec, issues } = applyCatalogueEdits(base, { look });
          assert.deepEqual(issues, [], where);
          const m = model(spec);
          assertRenders(spec, m, where);
          const glass = look === 'clear' || look === 'tinted';
          assert.equal(m.pane, glass, `${where}: pane`);
          if (glass) {
            assert.ok(m.wallpaper?.kind === 'colours' && m.wallpaper.colours.length > 0, `${where}: wallpaper behind the pane`);
            assert.ok(m.frame.borderWidth > 0, `${where}: glass rim`);
            if (!spec.border) assert.equal(m.frame.borderColour, GLASS_RIM);
          } else assert.equal(m.wallpaper, null, `${where}: no wallpaper layer`);
          if (look === 'glow') {
            assert.ok(m.glow && RGBA.test(m.glow.colour) && m.glow.radius >= 2, `${where}: glow ${JSON.stringify(m.glow)}`);
            for (const r of m.regions) {
              const glows = r.region.on === 'background' && ['text', 'grid', 'glyph'].includes(r.draw);
              assert.equal(r.halo, glows, `${where} ${r.region.id}: halo on background text and glyphs`);
            }
          } else assert.equal(m.glow, null, `${where}: no glow`);
          count++;
        }
      }
    }
  }
  assert.ok(count >= ALL_THEMES.length * CATALOGUE_KINDS.length * WIDGET_LOOKS.length, `covered ${count}`);
});

test('StandBy and Lock Screen sizes render in every look they offer; other looks are refused, still renderable', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  for (const kind of CATALOGUE_KINDS) {
    for (const size of CATALOGUE_KIND_SIZES[kind].filter((s) => familyOf(s) !== 'home')) {
      const base = buildCatalogueSpec(tokens, kind, size);
      const offered = catalogueLooksFor(base.family);
      for (const look of WIDGET_LOOKS) {
        const where = `${kind}/${size}/${look}`;
        const { spec, issues } = applyCatalogueEdits(base, { look });
        if (offered.includes(look)) {
          assert.deepEqual(issues, [], where);
          assert.equal(spec.look, look);
        } else {
          assert.deepEqual(issues.map((i) => i.code), ['notSupported'], where);
          assert.equal(spec.look, 'theme', `${where}: falls back`);
        }
        assertRenders(spec, model(spec), where);
      }
    }
  }
});

test('clear / tinted glass draws the user photo when given one', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  for (const kind of CATALOGUE_KINDS) {
    const size = CATALOGUE_KIND_SIZES[kind].find((s) => familyOf(s) === 'home')!;
    for (const look of ['clear', 'tinted'] as const satisfies readonly WidgetLook[]) {
      const { spec } = applyCatalogueEdits(buildCatalogueSpec(tokens, kind, size), { look });
      const m = model(spec, { wallpaperUri: 'file:///photo.jpg' });
      assert.deepEqual(m.wallpaper, { kind: 'photo', uri: 'file:///photo.jpg' }, `${kind}/${look}`);
    }
    const { spec } = applyCatalogueEdits(buildCatalogueSpec(tokens, kind, size), { look: 'glow' });
    assert.equal(model(spec, { wallpaperUri: 'file:///photo.jpg' }).wallpaper, null, `${kind}: no photo behind an opaque look`);
  }
});

test('every kind × look renders in non-Latin locales and at tiny and huge widths', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  for (const locale of ['ar', 'ja', 'hi', 'de']) {
    for (const kind of CATALOGUE_KINDS) {
      for (const size of CATALOGUE_KIND_SIZES[kind]) {
        const base = buildCatalogueSpec(tokens, kind, size);
        for (const look of catalogueLooksFor(base.family)) {
          const { spec } = applyCatalogueEdits(base, { look });
          assertRenders(spec, catalogueWidgetModel({ spec, width: 160, now: NOW, hairline: 0.5, format: formatFor(locale) }), `${locale} ${kind}/${size}/${look}`);
        }
      }
    }
  }
  for (const width of [8, 40, 1000]) {
    for (const kind of CATALOGUE_KINDS) {
      for (const size of CATALOGUE_KIND_SIZES[kind]) {
        const { spec } = applyCatalogueEdits(buildCatalogueSpec(tokens, kind, size), { look: catalogueLooksFor(familyOf(size)).at(-1)! });
        const m = catalogueWidgetModel({ spec, width, now: NOW, hairline: 0.5, format: EN });
        assert.ok(m.drawW >= 8 && m.height >= 8, `${kind}/${size} at ${width}`);
        for (const r of m.regions) assert.ok(Number.isFinite(r.box.width) && Number.isFinite(r.textSize), `${kind}/${size} at ${width}`);
      }
    }
  }
});

test('habit values: logged amount fills the meter, the goal is the person’s own, mood picks a face', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  const water = buildCatalogueSpec(tokens, 'habitWater', 'medium');
  const meter = (m: CatalogueWidgetModel) => m.regions.find((r) => r.draw === 'meter')!;
  assert.equal(meter(model(water)).level, 0, 'nothing logged');
  assert.equal(meter(model(water, { habitValue: 900 })).level, 900 / 2000);
  assert.equal(meter(model(water, { habitValue: 900, habitGoal: 1000 })).level, 0.9);
  assert.equal(meter(model(water, { habitValue: 5000 })).level, 1, 'capped');
  assert.equal(meter(model(water, { habitValue: Number.NaN })).level, 0, 'junk is nothing logged');
  const texts = model(water, { habitValue: 900, habitGoal: 1500 }).regions.map((r) => r.text);
  assert.ok(texts.includes('900') && texts.includes('1,500 «widgets.unit.ml»'), texts.join(' | '));

  const mood = buildCatalogueSpec(tokens, 'habitMood', 'small');
  const face = (m: CatalogueWidgetModel) => m.regions.find((r) => r.draw === 'glyph' && r.region.symbol === 'mood')!.symbol;
  assert.equal(face(model(mood)), 'mood', 'not logged: plain mood symbol');
  for (let level = 1; level <= 5; level++) assert.equal(face(model(mood, { habitValue: level })), `mood${level}`);
  const medium = model(buildCatalogueSpec(tokens, 'habitMood', 'medium'), { habitValue: 4 });
  assert.ok(medium.regions.some((r) => r.text === '«widgets.mood.4»'));
});

test('progress and countdown text follow the device time', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  const texts = (spec: CatalogueSpec) => model(spec).regions.map((r) => r.text);
  assert.ok(texts(buildCatalogueSpec(tokens, 'monthProgress', 'small')).includes('18/31'));
  const { spec: cd } = applyCatalogueEdits(buildCatalogueSpec(tokens, 'countdown', 'small'), { countdownTo: '2026-10-25' });
  assert.ok(texts(cd).includes('7'), texts(cd).join(' | '));
  const { spec: past } = applyCatalogueEdits(buildCatalogueSpec(tokens, 'countdown', 'small'), { countdownTo: '2026-01-01' });
  assert.ok(texts(past).includes('0'), 'past targets show 0');
});

test('regionDraw maps every region role', () => {
  const roles: readonly CatalogueRegion['role'][] = ['text', 'glyph', 'photo', 'scrim', 'band', 'meter', 'dial', 'dots', 'action'];
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  const seen = new Set<string>();
  for (const kind of CATALOGUE_KINDS) for (const size of CATALOGUE_KIND_SIZES[kind]) for (const r of buildCatalogueSpec(tokens, kind, size).regions) seen.add(r.role);
  for (const role of seen) assert.ok(roles.includes(role as CatalogueRegion['role']), `unlisted role ${role}`);
  const blank = buildCatalogueSpec(tokens, 'photoAlbum', 'small').regions[0];
  for (const role of roles) {
    const d = regionDraw({ ...blank, role, fill: null, meter: null, dial: null, dots: null, text: null, grid: null });
    assert.ok(CATALOGUE_REGION_DRAWS.includes(d), role);
  }
  assert.equal(regionDraw({ ...blank, role: 'meter', meter: null }), 'none', 'a role missing its data draws nothing');
  assert.equal(haloColour('#FF8000', 0.25), 'rgba(255, 128, 0, 0.60)');
});

// ---------------------------------------------------------------------------------- static guard

test('CatalogueWidgetPreview draws from the core model and handles every draw kind and symbol', () => {
  const src = readFileSync(COMPONENT, 'utf8');
  assert.match(src, /from '\.\.\/core\/catalogueWidgetModel'/, 'imports the core model');
  assert.match(src, /catalogueWidgetModel\(\{/, 'calls catalogueWidgetModel');
  // The per-kind / per-look decisions live in the model, not in the component.
  for (const moved of [/spec\.look\s*===/, /spec\.glow\b/, /function haloColour/, /GLASS_RIM\s*=/, /case 'photo'/, /textFor\s*=/, /meterLevel\s*=/]) {
    assert.doesNotMatch(src, moved, `component should leave ${moved} to catalogueWidgetModel`);
  }
  // Exhaustive switch over the model's draw kinds.
  for (const draw of CATALOGUE_REGION_DRAWS) assert.ok(src.includes(`case '${draw}':`), `renderRegion handles '${draw}'`);
  assert.match(src, /const unknown: never = draw/, 'renderRegion switch is exhaustive');

  // Every symbol any spec (or the mood face) can ask for has an icon.
  const symbols = src.match(/const SYMBOLS: Record<string, FeatherName> = \{([\s\S]*?)\};/);
  assert.ok(symbols, 'SYMBOLS map');
  const keys = new Set([...symbols[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]));
  const wanted = new Set<string>(['theme', 'plus', 'mood1', 'mood2', 'mood3', 'mood4', 'mood5']);
  for (const theme of ALL_THEMES.slice(0, 3)) {
    const tokens = widgetTokensFrom(theme);
    for (const kind of CATALOGUE_KINDS) for (const size of CATALOGUE_KIND_SIZES[kind]) for (const r of buildCatalogueSpec(tokens, kind, size).regions) if (r.symbol) wanted.add(r.symbol);
  }
  for (const s of wanted) assert.ok(keys.has(s), `SYMBOLS has no icon for '${s}'`);
});
