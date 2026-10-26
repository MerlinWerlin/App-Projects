import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composite, contrastRatio, gradientStops, isHex, minContrast, seededRandom, rgbToHex } from './colour.ts';
import { THEMES } from './themes.ts';
import { NEW_THEMES } from './themesNew.ts';
import { ALL_THEMES, PLUS_THEMES } from './plusThemes.ts';
import { WIDGET_INTENTS } from './habits.ts';
import {
  GRAPHIC_MIN_CONTRAST,
  TEXT_MIN_CONTRAST,
  WIDGET_KINDS,
  generateWidgetSet,
  normaliseTokens,
  parseWidgetSetPayload,
  serialiseWidgetSet,
  type WidgetFill,
} from './widgetSets.ts';
import {
  ACCESSORY_BACKDROP,
  ACCESSORY_SIZES,
  ACCESSORY_TINT_OPACITY,
  ALBUM_MAX_PHOTOS,
  CATALOGUE_KINDS,
  CATALOGUE_KIND_SIZES,
  CATALOGUE_SIZES,
  WIDGET_CATALOGUE,
  albumIndexAt,
  albumTimeline,
  applyCatalogueEdits,
  buildCatalogueSpec,
  catalogueI18nKeys,
  catalogueSpecOf,
  familyOf,
  generateWidgetCatalogue,
  generateWidgetCatalogueFromTokens,
  parseWidgetCatalogue,
  serialiseWidgetCatalogue,
  type CatalogueSpec,
  type WidgetCatalogue,
} from './widgetKinds.ts';

const BUNDLED = (() => {
  const seen = new Map<string, (typeof ALL_THEMES)[number]>();
  for (const t of [...THEMES, ...NEW_THEMES, ...PLUS_THEMES, ...ALL_THEMES]) seen.set(t.id, t);
  return [...seen.values()];
})();
const CATS: WidgetCatalogue[] = BUNDLED.map(generateWidgetCatalogue);
const NOW = new Date('2026-10-18T09:41:00.000Z');
const SPEC_COUNT = CATALOGUE_KINDS.reduce((n, k) => n + CATALOGUE_KIND_SIZES[k].length, 0);

function samples(fill: WidgetFill, opacity: number): string[] {
  const base = fill.kind === 'solid' ? [fill.colour] : gradientStops([fill.from, fill.to], 9);
  if (opacity >= 1) return base;
  return base.flatMap((c) => [composite(c, opacity, '#000000'), composite(c, opacity, '#FFFFFF')]);
}

/** Independent AA check, recomputed from the spec's own fills. */
function assertReadable(s: CatalogueSpec): void {
  const tag = (r: { id: string }) => `${s.id}/${r.id}`;
  if (s.rendering === 'monochrome') {
    for (const r of s.regions) {
      assert.equal(r.colour, '#FFFFFF', tag(r));
      assert.ok(r.tint && r.tintOpacity === ACCESSORY_TINT_OPACITY[r.tint], tag(r));
      const min = r.role === 'text' ? TEXT_MIN_CONTRAST : GRAPHIC_MIN_CONTRAST;
      for (const b of ACCESSORY_BACKDROP) assert.ok(contrastRatio(composite('#FFFFFF', r.tintOpacity!, b), b) >= min, `${tag(r)} on ${b}`);
      if (r.meter) assert.ok(contrastRatio(composite('#FFFFFF', r.tintOpacity!, ACCESSORY_BACKDROP[1]), r.meter.track) >= GRAPHIC_MIN_CONTRAST, tag(r));
    }
    return;
  }
  assert.ok(s.background);
  const surfaces = new Map<string, string[]>([['background', samples(s.background!, s.backgroundOpacity)]]);
  for (const r of s.regions) {
    const under = surfaces.get(r.on);
    assert.ok(under, `${tag(r)}: unknown base ${r.on}`);
    if (r.role === 'action') {
      assert.ok(r.fill && r.fill.kind === 'solid');
      const fill = (r.fill as { colour: string }).colour;
      assert.ok(minContrast(fill, under!) >= GRAPHIC_MIN_CONTRAST - 0.05, `${tag(r)}: button edge`);
      assert.ok(contrastRatio(r.colour!, fill) >= TEXT_MIN_CONTRAST, `${tag(r)}: button symbol`);
      assert.ok(r.action && r.action.labelKey.startsWith('widgets.action.'));
      continue;
    }
    if (r.fill) surfaces.set(r.id, samples(r.fill, r.fillOpacity));
    if (r.role === 'text') {
      assert.ok(r.colour && isHex(r.colour), tag(r));
      const c = minContrast(r.colour!, under!);
      assert.ok(c >= TEXT_MIN_CONTRAST - 0.05, `${tag(r)}: ${r.colour} ${c.toFixed(2)}`);
      assert.ok(r.contrast >= TEXT_MIN_CONTRAST);
      if (r.grid) {
        assert.ok(minContrast(r.grid.todayFill, under!) >= GRAPHIC_MIN_CONTRAST - 0.05, `${tag(r)}: today marker`);
        assert.ok(contrastRatio(r.grid.todayText, r.grid.todayFill) >= TEXT_MIN_CONTRAST, `${tag(r)}: today number`);
      }
    } else if (r.role === 'glyph' || r.role === 'meter' || r.role === 'dots' || r.role === 'dial') {
      assert.ok(r.colour && minContrast(r.colour, under!) >= GRAPHIC_MIN_CONTRAST - 0.05, `${tag(r)}: graphic`);
      if (r.meter) assert.ok(contrastRatio(r.colour!, r.meter.track) >= GRAPHIC_MIN_CONTRAST, `${tag(r)}: meter track`);
      if (r.dots) {
        assert.ok(contrastRatio(r.colour!, r.dots.track) >= GRAPHIC_MIN_CONTRAST, `${tag(r)}: dots track`);
        assert.ok(r.dots.columns * r.dots.rows >= r.dots.count);
      }
      if (r.dial) {
        assert.ok(minContrast(r.dial.tick, under!) >= GRAPHIC_MIN_CONTRAST - 0.05);
        assert.ok(minContrast(r.dial.hand, under!) >= (r.dial.numerals ? TEXT_MIN_CONTRAST : GRAPHIC_MIN_CONTRAST) - 0.05, `${tag(r)}: hands`);
      }
    }
  }
}

function assertValid(s: CatalogueSpec): void {
  assert.ok((CATALOGUE_KINDS as readonly string[]).includes(s.kind));
  assert.ok(CATALOGUE_KIND_SIZES[s.kind].includes(s.size));
  assert.equal(s.id, `${s.themeId}:${s.kind}:${s.size}`);
  assert.equal(s.family, familyOf(s.size));
  assert.equal(s.rendering === 'monochrome', s.family === 'accessory');
  assert.equal(s.background === null, s.family === 'accessory');
  assert.equal(s.standby !== null, s.family === 'standby');
  if (s.standby) assert.deepEqual(s.background, { kind: 'solid', colour: '#000000' });
  assert.ok(s.width > 0 && s.height > 0);
  assert.ok(s.regions.length >= 1);
  const ids = new Set<string>();
  for (const r of s.regions) {
    assert.ok(!ids.has(r.id), `${s.id}: duplicate ${r.id}`);
    ids.add(r.id);
    const { x, y, w, h } = r.frame;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001, `${s.id}/${r.id}: frame`);
    assert.ok(r.on === 'background' || s.regions.some((o) => o.id === r.on), `${s.id}/${r.id}: on`);
    if (r.text?.source === 'text') assert.ok(r.text.key?.startsWith('widgets.sample.'), `${s.id}/${r.id}`);
    if (r.text?.editable) assert.ok(r.text.maxLength > 0);
    if (r.action) assert.ok(Object.values(WIDGET_INTENTS).includes(r.action.intent.intent));
  }
  if (s.family === 'accessory') assert.ok(!s.regions.some((r) => r.action), `${s.id}: accessory widgets are display-only`);
  assert.equal(s.binding.habit !== null, s.kind.startsWith('habit'));
  assert.equal(s.editable.colours, s.family !== 'accessory');
}

test('combined catalogue lists the 5 theme-set kinds and the new kinds', () => {
  assert.equal(WIDGET_CATALOGUE.length, WIDGET_KINDS.length + CATALOGUE_KINDS.length);
  assert.deepEqual(WIDGET_CATALOGUE.filter((e) => e.module === 'set').map((e) => e.kind), [...WIDGET_KINDS]);
  for (const e of WIDGET_CATALOGUE) assert.ok(e.nameKey.startsWith('widgets.kind.') && e.sizes.length > 0);
  for (const s of ACCESSORY_SIZES) assert.ok(CATALOGUE_KINDS.some((k) => CATALOGUE_KIND_SIZES[k].includes(s)), s);
  for (const size of CATALOGUE_SIZES) assert.ok(CATALOGUE_KINDS.some((k) => CATALOGUE_KIND_SIZES[k].includes(size)), size);
});

test('every bundled theme yields a full, valid catalogue', () => {
  for (const cat of CATS) {
    assert.equal(cat.specs.length, SPEC_COUNT, cat.themeId);
    assert.equal(new Set(cat.specs.map((s) => s.id)).size, SPEC_COUNT);
    for (const k of CATALOGUE_KINDS) for (const z of CATALOGUE_KIND_SIZES[k]) assert.ok(catalogueSpecOf(cat, k, z));
    for (const s of cat.specs) assertValid(s);
  }
});

test('AA everywhere: text 4.5:1, graphics and buttons 3:1, accessory tint levels too', () => {
  for (const cat of CATS) for (const s of cat.specs) assertReadable(s);
});

test('deterministic and follows the theme', () => {
  for (const t of BUNDLED.slice(0, 12)) assert.deepEqual(generateWidgetCatalogue(t), generateWidgetCatalogue(t));
  for (const [i, t] of BUNDLED.entries()) {
    for (const s of CATS[i].specs) {
      assert.equal(s.glyphSet, t.iconStyle.glyphSet);
      assert.equal(s.font, t.widget.font);
      if (s.family === 'home') assert.equal(s.border !== null, t.widget.style === 'outline');
    }
  }
});

test('parts: dial, dots, month grid, habit buttons and intents', () => {
  const cat = CATS[0];
  const dial = catalogueSpecOf(cat, 'analogClock', 'large')!.regions.find((r) => r.role === 'dial')!;
  assert.equal(dial.dial!.numerals, true);
  const dots = catalogueSpecOf(cat, 'yearProgress', 'medium')!.regions.find((r) => r.role === 'dots')!;
  assert.equal(dots.dots!.source, 'year');
  assert.equal(dots.dots!.count, 366);
  assert.equal(catalogueSpecOf(cat, 'monthProgress', 'small')!.regions.find((r) => r.role === 'dots')!.dots!.count, 31);
  assert.ok(catalogueSpecOf(cat, 'monthCalendar', 'large')!.regions.some((r) => r.grid && r.text?.source === 'monthGrid'));
  const water = catalogueSpecOf(cat, 'habitWater', 'small')!;
  assert.deepEqual(water.binding, { habit: 'water', progress: null });
  assert.deepEqual(water.regions.filter((r) => r.action).map((r) => r.action!.intent), [
    { intent: WIDGET_INTENTS.habitDecrement, params: { habit: 'water' } },
    { intent: WIDGET_INTENTS.habitIncrement, params: { habit: 'water' } },
  ]);
  const mood = catalogueSpecOf(cat, 'habitMood', 'medium')!;
  assert.deepEqual(mood.regions.filter((r) => r.action).map((r) => r.action!.intent.params.value), [1, 2, 3, 4, 5]);
  assert.equal(catalogueSpecOf(cat, 'photoAlbum', 'medium')!.regions.find((r) => r.action)!.action!.intent.intent, WIDGET_INTENTS.albumNext);
  assert.equal(catalogueSpecOf(cat, 'yearProgress', 'medium')!.binding.progress, 'year');
  assert.deepEqual(water.tap, { intent: WIDGET_INTENTS.open, params: { habit: 'water' } });
  // Buttons are big enough to hit (≥ 44 pt on the short side would be ideal; widgets allow ~36).
  for (const r of water.regions.filter((x) => x.action)) assert.ok(r.frame.h * water.height >= 36 && r.frame.w * water.width >= 36);
  assert.throws(() => buildCatalogueSpec(cat.tokens, 'photoAlbum', 'accessoryInline'));
});

test('no weather, no now playing, no health reads', () => {
  const words = JSON.stringify(CATS[0]).toLowerCase();
  for (const w of ['weather', 'nowplaying', 'now playing', 'healthkit', 'pedometer']) assert.ok(!words.includes(w), w);
});

test('edits: text, countdown, album photos and interval are validated', () => {
  const cat = CATS[0];
  const cd = catalogueSpecOf(cat, 'countdown', 'medium')!;
  let r = applyCatalogueEdits(cd, { countdownTo: '2026-12-25', text: { title: '  Trip\u0007 to the sea  ', days: 'x', nope: 'x' } });
  assert.equal(r.spec.countdownTo, '2026-12-25');
  assert.equal(r.spec.regions.find((x) => x.id === 'title')!.text!.userText, 'Trip to the sea');
  assert.deepEqual(r.issues.map((i) => i.code).sort(), ['notEditable', 'unknownRegion']);
  r = applyCatalogueEdits(r.spec, { countdownTo: '2026-02-30', text: { title: 'x'.repeat(80) } });
  assert.equal(r.spec.countdownTo, '2026-12-25');
  assert.deepEqual(r.issues.map((i) => i.code).sort(), ['invalidDate', 'tooLong']);
  assert.equal([...r.spec.regions.find((x) => x.id === 'title')!.text!.userText!].length, 24);

  const album = catalogueSpecOf(cat, 'photoAlbum', 'large')!;
  const refs = Array.from({ length: 14 }, (_, i) => `album-${i}.jpg`);
  r = applyCatalogueEdits(album, { photoRefs: [...refs, '../etc/passwd', 'album-0.jpg'], rotateMinutes: 30 });
  assert.equal(r.spec.photoRefs.length, ALBUM_MAX_PHOTOS);
  assert.equal(r.spec.rotateMinutes, 30);
  assert.deepEqual(r.issues.map((i) => i.code).sort(), ['invalidPhoto', 'tooManyPhotos']);
  r = applyCatalogueEdits(r.spec, { rotateMinutes: 7 });
  assert.equal(r.spec.rotateMinutes, 30);
  assert.deepEqual(r.issues.map((i) => [i.code, i.messageKey]), [['invalidInterval', 'widgets.issue.invalidInterval']]);
  r = applyCatalogueEdits(cd, { photoRefs: ['a.jpg'], rotateMinutes: 60 });
  assert.deepEqual(r.issues.map((i) => i.code), ['notSupported', 'notSupported']);
});

test('colour edits stay AA; accessory sizes refuse colours', () => {
  const rnd = seededRandom(72);
  const hex = () => rgbToHex({ r: Math.floor(rnd() * 256), g: Math.floor(rnd() * 256), b: Math.floor(rnd() * 256) });
  for (const s of CATS[3].specs) {
    for (let i = 0; i < 3; i++) {
      const { spec, issues } = applyCatalogueEdits(s, { colours: { background: [hex(), hex()], accent: hex(), text: hex() } });
      if (s.family === 'accessory') {
        assert.deepEqual(issues.map((x) => x.code), ['notSupported']);
        assert.deepEqual(spec.edits.colours, { background: null, accent: null, text: null });
      }
      assertReadable(spec);
    }
  }
  const bad = applyCatalogueEdits(CATS[0].specs[0], { colours: { accent: 'red' } });
  assert.deepEqual(bad.issues.map((i) => i.code), ['invalidColour']);
});

test('extreme tokens still give AA', () => {
  for (const tokens of [
    { bg: ['#FFFFFF'], surface: '#FFFFFF', accent: '#FFFFFF', ink: '#FFFFFF', glyph: '#FFFFFF', style: 'glass' },
    { bg: ['#000000', '#FFFFFF'], surface: '#808080', accent: '#777777', ink: '#787878', glyph: '#767676', style: 'solid' },
    { bg: ['#000000'], surface: '#000000', accent: '#000000', ink: '#000000', glyph: '#000000', style: 'outline' },
  ]) {
    const cat = generateWidgetCatalogueFromTokens(normaliseTokens(tokens));
    for (const s of cat.specs) {
      assertValid(s);
      assertReadable(s);
    }
  }
});

test('photo album rotation and timeline', () => {
  assert.equal(albumIndexAt(0, 60, NOW, 0), -1);
  assert.equal(albumIndexAt(3, 60, new Date('2026-10-18T09:00:00Z'), 0), albumIndexAt(3, 60, new Date('2026-10-18T09:59:00Z'), 0));
  const a = albumIndexAt(3, 60, new Date('2026-10-18T09:59:00Z'), 0);
  assert.equal(albumIndexAt(3, 60, new Date('2026-10-18T10:00:00Z'), 0), (a + 1) % 3);
  const tl = albumTimeline({ photoRefs: ['a.jpg', 'b.jpg', 'c.jpg'], rotateMinutes: 60 }, NOW, 4, 0);
  assert.deepEqual(tl.map((e) => e.at.toISOString()), ['2026-10-18T09:41:00.000Z', '2026-10-18T10:00:00.000Z', '2026-10-18T11:00:00.000Z', '2026-10-18T12:00:00.000Z']);
  assert.equal(new Set(tl.slice(1).map((e) => e.photoRef)).size, 3);
  // Local boundaries: with a +05:30 offset the hour flips at :30 UTC.
  const tl2 = albumTimeline({ photoRefs: ['a.jpg', 'b.jpg'], rotateMinutes: 60 }, NOW, 2, 330);
  assert.equal(tl2[1].at.toISOString(), '2026-10-18T10:30:00.000Z');
  assert.deepEqual(albumTimeline({ photoRefs: [], rotateMinutes: 60 }, NOW, 3, 0), []);
});

test('i18n keys: catalogue copy is keys only', () => {
  const keys = catalogueI18nKeys();
  assert.ok(keys.length > 30);
  for (const k of keys) assert.match(k, /^widgets\.[a-z]+\.[A-Za-z0-9]+$/);
  for (const k of ['widgets.kind.analogClock', 'widgets.size.accessoryInline', 'widgets.action.plus', 'widgets.unit.ml', 'widgets.mood.3']) assert.ok(keys.includes(k), k);
});

test('payload: catalogue rides alongside the v2 set and round-trips', () => {
  for (const [i, t] of BUNDLED.entries()) {
    if (i % 5) continue;
    const set = generateWidgetSet(t);
    const json = serialiseWidgetCatalogue(set, CATS[i], { now: NOW });
    const parsed = parseWidgetCatalogue(json)!;
    assert.ok(parsed, t.id);
    assert.deepEqual(parsed.catalogue, CATS[i]);
    assert.equal(serialiseWidgetCatalogue(parsed.set.set, parsed.catalogue, { now: NOW }), json);
    // The theme-set part is exactly what serialiseWidgetSet writes, and the old parser still reads it.
    const base = JSON.parse(serialiseWidgetSet(set, { now: NOW }));
    const withCat = JSON.parse(json);
    delete withCat.catalogue;
    assert.deepEqual(withCat, base);
    assert.deepEqual(parseWidgetSetPayload(json), parseWidgetSetPayload(serialiseWidgetSet(set, { now: NOW })));
  }
});

test('payload: edits and texts survive; old payloads get a default catalogue', () => {
  const t = BUNDLED[2];
  const set = generateWidgetSet(t);
  const cat = generateWidgetCatalogue(t);
  const idx = (k: string, z: string) => cat.specs.findIndex((s) => s.kind === k && s.size === z);
  cat.specs[idx('countdown', 'small')] = applyCatalogueEdits(cat.specs[idx('countdown', 'small')], { countdownTo: '2027-01-01', text: { title: 'New year' }, colours: { text: '#123456' } }).spec;
  cat.specs[idx('photoAlbum', 'small')] = applyCatalogueEdits(cat.specs[idx('photoAlbum', 'small')], { photoRefs: ['one.jpg', 'two.heic'], rotateMinutes: 1440 }).spec;
  cat.specs[idx('habitWater', 'accessoryRectangular')] = applyCatalogueEdits(cat.specs[idx('habitWater', 'accessoryRectangular')], { text: { name: 'Drink up' } }).spec;
  const translate = (k: string) => `T(${k})`;
  const json = serialiseWidgetCatalogue(set, cat, { now: NOW, translate });
  const back = parseWidgetCatalogue(json)!;
  assert.deepEqual(back.catalogue, cat);
  const cdId = cat.specs[idx('countdown', 'small')].id;
  assert.equal(back.texts[cdId].title, 'New year');
  assert.equal(back.texts[cdId].label, 'T(widgets.sample.countdownLabel)');
  assert.equal(back.texts[cat.specs[idx('habitWater', 'small')].id]['plus.label'], 'T(widgets.action.plus)');

  // Old payloads: v2 without the block, and bare v1 themes.
  const old = parseWidgetCatalogue(serialiseWidgetSet(set, { now: NOW }))!;
  assert.deepEqual(old.catalogue, generateWidgetCatalogue(t));
  assert.deepEqual(old.texts, {});
  const v1 = parseWidgetCatalogue(JSON.stringify(JSON.parse(serialiseWidgetSet(set, { now: NOW })).theme))!;
  assert.equal(v1.catalogue.specs.length, SPEC_COUNT);
  assert.equal(parseWidgetCatalogue('{"v":3}'), null);
  assert.equal(parseWidgetCatalogue('nope'), null);
});

test('tampered catalogue blocks are rebuilt, never unreadable', () => {
  const t = BUNDLED[1];
  const raw = JSON.parse(serialiseWidgetCatalogue(generateWidgetSet(t), generateWidgetCatalogue(t), { now: NOW }));
  for (const s of raw.catalogue.specs) {
    s.regions = [];
    s.edits = { text: { title: 7, name: 'ok' }, colours: { background: ['#zzzzzz'], text: '#FFFF00', accent: 5 }, countdownTo: 'soon', photoRefs: ['/abs.jpg', 'fine.png'], rotateMinutes: -1 };
  }
  raw.catalogue.texts = { nope: { a: 'b' }, [raw.catalogue.specs[0].id]: { a: 3, b: 'x' } };
  const back = parseWidgetCatalogue(JSON.stringify(raw))!;
  for (const s of back.catalogue.specs) {
    assertValid(s);
    assertReadable(s);
    if (s.kind === 'photoAlbum') assert.deepEqual([s.photoRefs, s.rotateMinutes], [['fine.png'], 60]);
    if (s.kind === 'countdown') assert.equal(s.countdownTo, null);
  }
  assert.deepEqual(Object.keys(back.texts), [raw.catalogue.specs[0].id]);
  assert.deepEqual(back.texts[raw.catalogue.specs[0].id], { b: 'x' });
  raw.catalogue = { v: 9 };
  assert.deepEqual(parseWidgetCatalogue(JSON.stringify(raw))!.catalogue, generateWidgetCatalogue(t));
});

// Owner regression: quote/countdown and glass styles discarded explicit backgrounds.
test('explicit gradients survive every Home Screen design and remain readable', () => {
  for (const set of CATS) {
    for (const original of set.specs) {
      if ('family' in original && original.family !== 'home') continue;
      const { spec } = applyCatalogueEdits(original, { colours: { background: ['#112233', '#445566'] } });
      assert.deepEqual(spec.background, { kind: 'gradient', from: '#112233', to: '#445566', angle: 180 }, original.id);
      assertReadable(spec);
    }
  }
});
