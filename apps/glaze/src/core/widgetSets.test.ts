import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, gradientStops, composite, isHex, minContrast, seededRandom, rgbToHex, ensureContrast } from './colour.ts';
import { THEMES } from './themes.ts';
import { NEW_THEMES } from './themesNew.ts';
import { ALL_THEMES, PLUS_THEMES } from './plusThemes.ts';
import { lookup, type CatalogueTree } from './i18n.ts';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import { parseWidgetTheme, serializeWidgetTheme, widgetThemeFrom, WIDGET_THEME_KEY } from './widgetTheme.ts';
import { catalogueI18nKeys } from './widgetKinds.ts';
import {
  CORNER_RADIUS_BY_SHAPE,
  GRAPHIC_MIN_CONTRAST,
  TEXT_MIN_CONTRAST,
  WIDGET_KINDS,
  WIDGET_SET_KEY,
  WIDGET_SIZES,
  applyWidgetEdits,
  generateWidgetSet,
  generateWidgetSetFromTokens,
  parseWidgetSetPayload,
  serialiseWidgetSet,
  widgetIssueKey,
  widgetKindKey,
  widgetSizeKey,
  widgetSpecOf,
  widgetTokensFrom,
  type WidgetFill,
  type WidgetSet,
  type WidgetSpec,
} from './widgetSets.ts';

const BUNDLED = (() => {
  const seen = new Map<string, (typeof ALL_THEMES)[number]>();
  for (const t of [...THEMES, ...NEW_THEMES, ...PLUS_THEMES, ...ALL_THEMES]) seen.set(t.id, t);
  return [...seen.values()];
})();
const SETS: WidgetSet[] = BUNDLED.map(generateWidgetSet);
const NOW = new Date('2026-10-18T09:41:00.000Z');

function samples(fill: WidgetFill, opacity: number): string[] {
  const base = fill.kind === 'solid' ? [fill.colour] : gradientStops([fill.from, fill.to], 9);
  if (opacity >= 1) return base;
  return base.flatMap((c) => [composite(c, opacity, '#000000'), composite(c, opacity, '#FFFFFF')]);
}

/** Independent AA check: recompute what each foreground sits on from the spec's own fills. */
function assertReadable(s: WidgetSpec): void {
  const surfaces = new Map<string, string[]>([['background', samples(s.background, s.backgroundOpacity)]]);
  for (const r of s.regions) {
    if (r.fill) surfaces.set(r.id, samples(r.fill, r.fillOpacity));
    const under = surfaces.get(r.on);
    assert.ok(under, `${s.id}/${r.id}: unknown base ${r.on}`);
    if (r.role === 'text') {
      assert.ok(r.colour && isHex(r.colour), `${s.id}/${r.id}: text colour`);
      const c = minContrast(r.colour!, under!);
      // 9-point gradient sampling is finer than the generator's 5, so allow a hair of rounding.
      assert.ok(c >= TEXT_MIN_CONTRAST - 0.05, `${s.id}/${r.id}: ${r.colour} contrast ${c.toFixed(2)}`);
      assert.ok(r.contrast >= TEXT_MIN_CONTRAST, `${s.id}/${r.id}: recorded contrast ${r.contrast}`);
      assert.ok(minContrast(r.colour!, r.backdrop) >= TEXT_MIN_CONTRAST);
    } else if (r.role === 'glyph' || r.role === 'meter') {
      assert.ok(r.colour && minContrast(r.colour, under!) >= GRAPHIC_MIN_CONTRAST - 0.05, `${s.id}/${r.id}: graphic contrast`);
      if (r.meter) assert.ok(contrastRatio(r.colour!, r.meter.track) >= GRAPHIC_MIN_CONTRAST, `${s.id}/${r.id}: meter vs track`);
    }
  }
}

function assertValidSpec(s: WidgetSpec): void {
  assert.ok((WIDGET_KINDS as readonly string[]).includes(s.kind));
  assert.ok((WIDGET_SIZES as readonly string[]).includes(s.size));
  assert.equal(s.id, `${s.themeId}:${s.kind}:${s.size}`);
  assert.equal(s.nameKey, widgetKindKey(s.kind));
  assert.ok(s.width > 0 && s.height > 0 && s.cornerRadius > 0);
  assert.ok(s.backgroundOpacity > 0 && s.backgroundOpacity <= 1);
  const fillHexes = s.background.kind === 'solid' ? [s.background.colour] : [s.background.from, s.background.to];
  for (const c of [...fillHexes, s.accent]) assert.ok(isHex(c), `${s.id}: ${c}`);
  if (s.border) assert.ok(isHex(s.border.colour) && s.border.width > 0);
  assert.ok(s.regions.length >= 2);
  const ids = new Set<string>();
  for (const r of s.regions) {
    assert.ok(!ids.has(r.id), `${s.id}: duplicate region ${r.id}`);
    ids.add(r.id);
    const { x, y, w, h } = r.frame;
    for (const v of [x, y, w, h]) assert.ok(v >= 0 && v <= 1, `${s.id}/${r.id}: frame`);
    assert.ok(x + w <= 1.0001 && y + h <= 1.0001 && w > 0 && h > 0, `${s.id}/${r.id}: frame bounds`);
    assert.ok(r.on === 'background' || s.regions.some((o) => o.id === r.on), `${s.id}/${r.id}: on`);
    if (r.role === 'text') {
      assert.ok(r.text, `${s.id}/${r.id}: slot`);
      if (r.text!.source === 'text') assert.ok(r.text!.key?.startsWith('widgets.sample.'), `${s.id}/${r.id}: sample key`);
      if (r.text!.editable) assert.ok(r.text!.maxLength > 0);
    }
  }
  assert.equal(s.editable.photo, s.kind === 'photo');
  assert.equal(s.editable.text, s.regions.some((r) => r.text?.editable));
  assert.equal(s.editable.colours, true);
}

// ------------------------------------------------------------------ generation

test('there are bundled themes from all three sources', () => {
  assert.ok(THEMES.length > 0 && NEW_THEMES.length > 0 && PLUS_THEMES.length > 0);
  assert.equal(BUNDLED.length, ALL_THEMES.length, 'ALL_THEMES covers every bundled theme');
});

test('every bundled theme yields 15 valid specs: 5 kinds × 3 sizes', () => {
  for (const set of SETS) {
    assert.equal(set.specs.length, 15, set.themeId);
    assert.equal(new Set(set.specs.map((s) => s.id)).size, 15);
    for (const kind of WIDGET_KINDS) for (const size of WIDGET_SIZES) assert.ok(widgetSpecOf(set, kind, size), `${set.themeId} ${kind} ${size}`);
    for (const s of set.specs) assertValidSpec(s);
  }
});

test('AA contrast everywhere: text ≥ 4.5:1, glyphs and meters ≥ 3:1', () => {
  for (const set of SETS) for (const s of set.specs) assertReadable(s);
});

test('output is deterministic', () => {
  for (const t of BUNDLED) {
    assert.deepEqual(generateWidgetSet(t), generateWidgetSet(t));
    assert.equal(serialiseWidgetSet(generateWidgetSet(t), { now: NOW }), serialiseWidgetSet(generateWidgetSet(t), { now: NOW }));
  }
});

test('specs follow the theme tokens (shape, glyphs, fonts, palette)', () => {
  for (const t of BUNDLED) {
    const set = generateWidgetSet(t);
    for (const s of set.specs) {
      assert.equal(s.cornerRadius, CORNER_RADIUS_BY_SHAPE[t.iconStyle.shape], t.id);
      assert.equal(s.glyphSet, t.iconStyle.glyphSet);
      assert.equal(s.typeface, t.art.displayFont);
      assert.equal(s.font, t.widget.font);
      assert.equal(s.surface, t.widget.style);
      assert.equal(s.accent, widgetThemeFrom(t).accent);
      assert.equal(s.border !== null, t.widget.style === 'outline');
    }
  }
});

test('photo, battery, quote and date layouts carry their parts', () => {
  const set = SETS[0];
  for (const size of WIDGET_SIZES) {
    const photo = widgetSpecOf(set, 'photo', size)!;
    assert.ok(photo.regions.some((r) => r.role === 'photo') && photo.regions.some((r) => r.role === 'scrim'));
    assert.ok(widgetSpecOf(set, 'battery', size)!.regions.some((r) => r.role === 'meter' && r.meter));
    assert.ok(widgetSpecOf(set, 'date', size)!.regions.some((r) => r.role === 'band'));
    assert.ok(widgetSpecOf(set, 'clock', size)!.regions.some((r) => r.text?.source === 'time'));
  }
  assert.ok(widgetSpecOf(set, 'quote', 'large')!.regions.some((r) => r.text?.source === 'countdown'));
  assert.ok(!widgetSpecOf(set, 'quote', 'small')!.regions.some((r) => r.text?.source === 'countdown'));
});

test('extreme tokens still give AA (flattening / opacity fallbacks)', () => {
  const rand = seededRandom(58);
  const hex = () => rgbToHex({ r: rand() * 255, g: rand() * 255, b: rand() * 255 });
  for (let i = 0; i < 60; i++) {
    const set = generateWidgetSetFromTokens({
      ...widgetTokensFrom(BUNDLED[i % BUNDLED.length]),
      themeId: `rand-${i}`,
      bg: i % 3 === 0 ? ['#000000', '#FFFFFF'] : [hex(), hex()],
      surface: hex(),
      accent: i % 5 === 0 ? '#777777' : hex(),
      ink: hex(),
      glyph: hex(),
      style: (['glass', 'solid', 'outline'] as const)[i % 3],
    });
    for (const s of set.specs) {
      assertValidSpec(s);
      assertReadable(s);
    }
  }
});

// ------------------------------------------------------------------ i18n

test('kind names, sizes, samples and issues are i18n keys present in every locale', () => {
  const keys = new Set<string>();
  for (const k of WIDGET_KINDS) keys.add(widgetKindKey(k));
  for (const s of WIDGET_SIZES) keys.add(widgetSizeKey(s));
  for (const c of ['unknownRegion', 'notEditable', 'tooLong', 'emptyText', 'invalidColour', 'invalidPhoto', 'invalidDate', 'notSupported', 'contrastAdjusted'] as const) keys.add(widgetIssueKey(c));
  for (const set of SETS) for (const s of set.specs) for (const r of s.regions) if (r.text?.key) keys.add(r.text.key);
  for (const key of keys) {
    const msg = lookup(en as unknown as CatalogueTree, key);
    assert.equal(typeof msg, 'string', `en missing ${key}`);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
      assert.equal(typeof lookup(cat as CatalogueTree, key), 'string', `${locale} missing ${key}`);
    }
  }
  // Every widgets.* English leaf is used (no dead copy): by the theme sets above or by the widget
  // catalogue (widgetKinds.ts catalogueI18nKeys(), which is checked for every locale too).
  const catalogueKeys = catalogueI18nKeys();
  for (const key of catalogueKeys) {
    assert.equal(typeof lookup(en as unknown as CatalogueTree, key), 'string', `en missing catalogue key ${key}`);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
      assert.equal(typeof lookup(cat as CatalogueTree, key), 'string', `${locale} missing catalogue key ${key}`);
    }
  }
  const used = new Set<string>([...keys, ...catalogueKeys]);
  const leaves: string[] = [];
  const walk = (o: Record<string, unknown>, p: string) => {
    for (const [k, v] of Object.entries(o)) typeof v === 'string' ? leaves.push(`${p}.${k}`) : walk(v as Record<string, unknown>, `${p}.${k}`);
  };
  walk((en as unknown as Record<string, Record<string, unknown>>).widgets, 'widgets');
  for (const l of leaves) assert.ok(used.has(l), `unused key ${l}`);
});

test('generated specs contain no English copy', () => {
  const english: string[] = [];
  const walk = (o: unknown) => {
    if (typeof o === 'string') english.push(o);
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk((en as unknown as Record<string, unknown>).widgets);
  for (const set of SETS.slice(0, 8)) {
    const json = serialiseWidgetSet(set, { now: NOW });
    for (const s of english) assert.ok(!json.includes(JSON.stringify(s).slice(1, -1)), `"${s}" leaked into ${set.themeId}`);
  }
});

// ------------------------------------------------------------------ edits

const quoteL = () => widgetSpecOf(SETS[0], 'quote', 'large')!;
const photoM = () => widgetSpecOf(SETS[0], 'photo', 'medium')!;

test('text edits: applied, cleaned, clipped, reset; bad regions rejected', () => {
  const spec = quoteL();
  const before = JSON.stringify(spec);
  const r1 = applyWidgetEdits(spec, { text: { quote: '  Keep\u0000 going\n\tgently  ', countdownLabel: 'x'.repeat(80), time: 'nope', ghost: 'boo' } });
  assert.equal(JSON.stringify(spec), before, 'input spec not mutated');
  const q = r1.spec.regions.find((r) => r.id === 'quote')!;
  assert.equal(q.text!.userText, 'Keep going gently');
  assert.equal(r1.spec.regions.find((r) => r.id === 'countdownLabel')!.text!.userText!.length, 30);
  const codes = r1.issues.map((i) => `${i.field}:${i.code}`).sort();
  assert.deepEqual(codes, ['text.countdownLabel:tooLong', 'text.ghost:unknownRegion', 'text.time:unknownRegion']);
  assert.ok(r1.issues.some((i) => i.field === 'text.countdownLabel' && i.code === 'tooLong'));
  assert.ok(r1.issues.some((i) => i.field === 'text.ghost' && i.code === 'unknownRegion'));
  assert.ok(r1.issues.every((i) => i.messageKey === widgetIssueKey(i.code)));
  // 'time' is not a region of quote/large; on the clock it exists but is not editable.
  const clock = applyWidgetEdits(widgetSpecOf(SETS[0], 'clock', 'large')!, { text: { time: '12:00', greeting: 'Hi' } });
  assert.ok(clock.issues.some((i) => i.field === 'text.time' && i.code === 'notEditable'));
  assert.equal(clock.spec.regions.find((r) => r.id === 'greeting')!.text!.userText, 'Hi');
  // Incremental: later edits merge; '' resets with an issue, null resets silently.
  const r2 = applyWidgetEdits(r1.spec, { text: { countdownLabel: '   ' } });
  assert.equal(r2.spec.regions.find((r) => r.id === 'quote')!.text!.userText, 'Keep going gently');
  assert.equal(r2.spec.regions.find((r) => r.id === 'countdownLabel')!.text!.userText, null);
  assert.ok(r2.issues.some((i) => i.code === 'emptyText'));
  const r3 = applyWidgetEdits(r2.spec, { text: { quote: null } });
  assert.equal(r3.spec.regions.find((r) => r.id === 'quote')!.text!.userText, null);
  assert.deepEqual(r3.issues, []);
});

test('text limits count characters, not UTF-16 units', () => {
  const r = applyWidgetEdits(widgetSpecOf(SETS[0], 'battery', 'small')!, { text: { label: '🔋'.repeat(25) } });
  assert.equal([...r.spec.regions.find((x) => x.id === 'label')!.text!.userText!].length, 20);
});

test('photo and countdown edits are validated and kind-checked', () => {
  const ok = applyWidgetEdits(photoM(), { photoRef: 'widget-photo.jpg' });
  assert.equal(ok.spec.photoRef, 'widget-photo.jpg');
  assert.deepEqual(ok.issues, []);
  for (const bad of ['../etc/passwd.jpg', '/abs/p.png', 'file:///x.jpg', 'a.gif', '', 'x'.repeat(70) + '.jpg']) {
    const r = applyWidgetEdits(ok.spec, { photoRef: bad });
    assert.equal(r.spec.photoRef, 'widget-photo.jpg', bad);
    assert.equal(r.issues[0]?.code, 'invalidPhoto', bad);
  }
  assert.equal(applyWidgetEdits(ok.spec, { photoRef: null }).spec.photoRef, null);
  assert.equal(applyWidgetEdits(quoteL(), { photoRef: 'a.jpg' }).issues[0].code, 'notSupported');

  const cd = applyWidgetEdits(quoteL(), { countdownTo: '2026-12-25' });
  assert.equal(cd.spec.countdownTo, '2026-12-25');
  for (const bad of ['2026-02-30', '2026-13-01', 'tomorrow', '2026-1-1']) {
    assert.equal(applyWidgetEdits(cd.spec, { countdownTo: bad }).issues[0].code, 'invalidDate', bad);
  }
  assert.equal(applyWidgetEdits(widgetSpecOf(SETS[0], 'quote', 'small')!, { countdownTo: '2026-12-25' }).issues[0].code, 'notSupported');
});

test('colour edits: invalid rejected, readable text kept exactly, unreadable text adjusted to AA', () => {
  const base = widgetSpecOf(SETS[0], 'clock', 'medium')!;
  const bad = applyWidgetEdits(base, { colours: { background: ['#12', 'zz'], accent: 'red', text: 42 as unknown as string } });
  assert.deepEqual(bad.issues.map((i) => i.code).sort(), ['invalidColour', 'invalidColour', 'invalidColour']);
  assert.deepEqual(bad.spec, base);

  const dark = applyWidgetEdits(base, { colours: { background: '#101010', text: '#F0F0F0' } });
  assert.deepEqual(dark.issues, []);
  assert.deepEqual(dark.spec.background, { kind: 'solid', colour: '#101010' });
  for (const r of dark.spec.regions) if (r.role === 'text') assert.equal(r.colour, '#F0F0F0');
  assertReadable(dark.spec);

  const clash = applyWidgetEdits(base, { colours: { background: '#FFFFFF', text: '#FFEEAA' } });
  assert.ok(clash.issues.some((i) => i.field === 'colours.text' && i.code === 'contrastAdjusted'));
  for (const r of clash.spec.regions) if (r.role === 'text') assert.notEqual(r.colour, '#FFEEAA');
  assertReadable(clash.spec);

  const reset = applyWidgetEdits(clash.spec, { colours: { background: null, text: null } });
  assert.deepEqual(reset.spec, base);
});

test('random colour edits on every kind and size always stay AA', () => {
  const rand = seededRandom(1018);
  const hex = () => rgbToHex({ r: rand() * 255, g: rand() * 255, b: rand() * 255 });
  for (let i = 0; i < 150; i++) {
    const set = SETS[i % SETS.length];
    const spec = set.specs[i % 15];
    const { spec: out } = applyWidgetEdits(spec, {
      colours: { background: i % 2 ? [hex(), hex()] : hex(), accent: hex(), text: i % 4 ? hex() : null },
      text: { quote: 'Hello there', caption: 'Hi' },
    });
    assertValidSpec(out);
    assertReadable(out);
  }
});

test('ensureContrast keeps hue and returns null only when impossible', () => {
  assert.equal(ensureContrast('#000000', ['#FFFFFF']), '#000000');
  const c = ensureContrast('#FF8080', ['#FFFFFF'])!;
  assert.ok(contrastRatio(c, '#FFFFFF') >= 4.5);
  // (A mid grey near #757575 clears 4.5:1 against both black and white, so add a grey too.)
  assert.equal(ensureContrast('#777777', ['#000000', '#FFFFFF', '#777777']), null);
});

// ------------------------------------------------------------------ payload

test('payload round-trips for every bundled theme', () => {
  for (const set of SETS) {
    const json = serialiseWidgetSet(set, { now: NOW });
    const back = parseWidgetSetPayload(json);
    assert.ok(back, set.themeId);
    assert.equal(back!.v, 2);
    assert.deepEqual(back!.set, set);
    assert.equal(back!.updatedAt, NOW.toISOString());
    assert.equal(serialiseWidgetSet(back!.set, { now: NOW }), json);
  }
});

test('payload carries the unchanged v1 theme block so older extensions still decode it', () => {
  const t = BUNDLED[3];
  const json = serialiseWidgetSet(generateWidgetSet(t), { now: NOW });
  const o = JSON.parse(json);
  assert.notEqual(WIDGET_SET_KEY, WIDGET_THEME_KEY);
  assert.equal(JSON.stringify(o.theme), serializeWidgetTheme(widgetThemeFrom(t, NOW)));
  assert.deepEqual(parseWidgetTheme(o.theme), widgetThemeFrom(t, NOW));
  assert.equal(o.specs.length, 15);
});

test('edits and translated texts survive the round trip', () => {
  const set = generateWidgetSet(BUNDLED[1]);
  const i = set.specs.findIndex((s) => s.kind === 'quote' && s.size === 'large');
  const j = set.specs.findIndex((s) => s.kind === 'photo' && s.size === 'small');
  set.specs[i] = applyWidgetEdits(set.specs[i], { text: { quote: 'Mine' }, countdownTo: '2027-01-01', colours: { background: ['#203040', '#405060'], text: '#FAFAFA' } }).spec;
  set.specs[j] = applyWidgetEdits(set.specs[j], { photoRef: 'widget-photo.jpg', colours: { accent: '#00AA88' } }).spec;
  const translate = (k: string) => `T(${k})`;
  const back = parseWidgetSetPayload(serialiseWidgetSet(set, { now: NOW, translate }))!;
  assert.deepEqual(back.set, set);
  const qid = set.specs[i].id;
  assert.equal(back.texts[qid].quote, 'Mine');
  assert.equal(back.texts[qid].countdownLabel, 'T(widgets.sample.countdownLabel)');
  assert.equal(back.texts[qid].countdown, undefined, 'dynamic sources are formatted natively');
});

test('a bare v1 theme payload upgrades to a full set', () => {
  const v1 = serializeWidgetTheme(widgetThemeFrom(BUNDLED[0], NOW));
  const back = parseWidgetSetPayload(v1)!;
  assert.equal(back.set.specs.length, 15);
  assert.equal(back.set.themeId, BUNDLED[0].id);
  for (const s of back.set.specs) assertReadable(s);
});

test('tampered or junk payloads are rebuilt or rejected, never unreadable', () => {
  assert.equal(parseWidgetSetPayload('not json'), null);
  assert.equal(parseWidgetSetPayload(null), null);
  assert.equal(parseWidgetSetPayload([1, 2]), null);
  assert.equal(parseWidgetSetPayload({ v: 3, specs: [] }), null);

  const o = JSON.parse(serialiseWidgetSet(SETS[2], { now: NOW }));
  o.tokens.bg = ['#FFFFFF'];
  o.tokens.accent = 'nope';
  o.specs[0].regions[0].colour = '#FFFFFF';
  o.specs[3].edits = { text: { month: 'x', day: 7 }, colours: { text: '#FFFFFE', background: 'bad' }, photoRef: '../x.jpg' };
  o.specs.push({ kind: 'clock', size: 'huge' });
  o.texts = { [SETS[2].specs[0].id]: { time: 5, greeting: 'ok' }, 'other:clock:small': { a: 'b' } };
  const back = parseWidgetSetPayload(JSON.stringify(o))!;
  assert.equal(back.set.specs.length, 15);
  for (const s of back.set.specs) {
    assertValidSpec(s);
    assertReadable(s);
  }
  assert.deepEqual(back.texts, { [SETS[2].specs[0].id]: { greeting: 'ok' } });
  // Missing specs and texts default cleanly.
  const bare = parseWidgetSetPayload({ v: 2 })!;
  assert.equal(bare.set.specs.length, 15);
});
