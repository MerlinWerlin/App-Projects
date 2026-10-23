// T65: widget looks (clear / tinted glass, glow) and contrast-aware pairing with the wallpaper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composite, contrastRatio, gradientStops, isHex, minContrast, rgbToHex, seededRandom } from './colour.ts';
import { ALL_THEMES } from './plusThemes.ts';
import { designedColours, homeColour, homeVersionFor } from './wallpaperPair.ts';
import { lookup, type CatalogueTree } from './i18n.ts';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import {
  BODY_TEXT_MIN_CONTRAST,
  GLOW_HALO_OPACITY,
  LARGE_TEXT_MIN_CONTRAST,
  LARGE_TEXT_SAFETY_SCALE,
  WIDGET_LOOKS,
  backdropFeasible,
  compactByLuminance,
  glowPalette,
  isLargeText,
  isWidgetLook,
  pairGlassText,
  suitsGlow,
  textMinContrast,
  wallpaperBackdrop,
  wallpaperColoursOf,
  widgetLookKey,
} from './widgetLook.ts';
import {
  GRAPHIC_MIN_CONTRAST,
  WIDGET_KINDS,
  applyWidgetEdits,
  generateWidgetSet,
  generateWidgetSetFromTokens,
  parseWidgetSetPayload,
  serialiseWidgetSet,
  widgetSpecOf,
  widgetTokensFrom,
  type WidgetFill,
  type WidgetSpec,
} from './widgetSets.ts';
import { STUDIO_SCALE_MIN, draftEdits, emptyDraft, initialStudioState, isDraftEmpty, parseStudioState, serialiseStudioState, studioLooks, studioSpec, updateDraft } from './widgetStudio.ts';
import { parseWidgetTheme, serializeWidgetTheme } from './widgetTheme.ts';

const NOW = new Date('2026-10-18T09:41:00.000Z');

// ------------------------------------------------------------------ independent reference model

/** Dense, independent model of everything a wallpaper (and its Home version) can show. */
function referenceWallpaper(colours: readonly string[]): string[] {
  if (colours.length === 0) return [];
  const home = homeVersionFor({ colours, size: { width: 1179, height: 2556 } });
  const homeCols = colours.map((c) => homeColour(c, home.wash, home.dim));
  const out: string[] = [];
  for (const set of [colours, homeCols]) {
    for (const a of set) for (const b of set) out.push(...gradientStops([a, b], 9));
  }
  return out;
}

function referenceFill(fill: WidgetFill, opacity: number, wallpaper: string[] | null): string[] {
  const base = fill.kind === 'solid' ? [fill.colour] : gradientStops([fill.from, fill.to], 9);
  if (opacity >= 1) return base;
  const under = wallpaper && wallpaper.length ? wallpaper : ['#000000', '#FFFFFF'];
  return base.flatMap((c) => under.map((u) => composite(c, opacity, u)));
}

/** Recompute what each foreground sits on from the spec alone and check its contrast. */
function assertLookReadable(s: WidgetSpec): void {
  const pane = (s.look === 'clear' || s.look === 'tinted') && s.surface === 'glass';
  const wall = pane ? referenceWallpaper(s.tokens.wallpaper) : null;
  let bg = referenceFill(s.background, s.backgroundOpacity, wall);
  if (s.glow) bg = [...bg, ...bg.map((b) => composite(s.glow!.colour, s.glow!.opacity, b))];
  const surfaces = new Map<string, string[]>([['background', bg]]);
  for (const r of s.regions) {
    if (r.fill) surfaces.set(r.id, referenceFill(r.fill, r.fillOpacity, null));
    const under = surfaces.get(r.on)!;
    if (r.role === 'text') {
      const need = textMinContrast(s.look, r.text!.source, r.text!.sizePt, r.text!.weight);
      const c = minContrast(r.colour!, under);
      assert.ok(c >= need - 0.05, `${s.id} ${s.look}/${r.id}: ${r.colour} ${c.toFixed(2)} < ${need}`);
      assert.ok(r.contrast >= need, `${s.id} ${s.look}/${r.id}: recorded ${r.contrast}`);
    } else if (r.role === 'glyph' || r.role === 'meter') {
      assert.ok(minContrast(r.colour!, under) >= GRAPHIC_MIN_CONTRAST - 0.05, `${s.id} ${s.look}/${r.id}: graphic`);
    }
  }
}

// ------------------------------------------------------------------ thresholds

test('looks: four ids, names are i18n keys in every locale', () => {
  assert.deepEqual([...WIDGET_LOOKS], ['theme', 'clear', 'tinted', 'glow']);
  assert.ok(isWidgetLook('glow') && !isWidgetLook('neon') && !isWidgetLook(null));
  for (const look of WIDGET_LOOKS) {
    const key = widgetLookKey(look);
    assert.equal(typeof lookup(en as unknown as CatalogueTree, key), 'string', `en ${key}`);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) assert.equal(typeof lookup(cat as CatalogueTree, key), 'string', `${locale} ${key}`);
  }
});

test('large-text minimum (3:1) only for large numerals under a look, and only if still large at the smallest studio size', () => {
  assert.equal(LARGE_TEXT_SAFETY_SCALE, STUDIO_SCALE_MIN / 100);
  assert.equal(textMinContrast('theme', 'time', 72, 'bold'), BODY_TEXT_MIN_CONTRAST);
  assert.equal(textMinContrast('clear', 'time', 40, 'bold'), LARGE_TEXT_MIN_CONTRAST);
  assert.equal(textMinContrast('clear', 'countdown', 48, 'bold'), LARGE_TEXT_MIN_CONTRAST);
  // 24 pt bold shrinks to 16.8 pt at 70 %: not large any more.
  assert.equal(textMinContrast('tinted', 'batteryLevel', 24, 'bold'), BODY_TEXT_MIN_CONTRAST);
  // Words never get the large-text allowance, however big.
  assert.equal(textMinContrast('clear', 'text', 40, 'bold'), BODY_TEXT_MIN_CONTRAST);
  assert.equal(textMinContrast('glow', 'weekday', 14, 'regular'), BODY_TEXT_MIN_CONTRAST);
  assert.ok(isLargeText(35, 'regular') && !isLargeText(33, 'regular') && isLargeText(27, 'bold') && !isLargeText(26, 'medium'));
  assert.equal(isLargeText(Number.NaN, 'bold'), false);
});

// ------------------------------------------------------------------ contrast maths

test('backdropFeasible agrees with a brute-force search over every grey', () => {
  const rand = seededRandom(65);
  const hex = () => rgbToHex({ r: rand() * 255, g: rand() * 255, b: rand() * 255 });
  const greys = Array.from({ length: 256 }, (_, v) => rgbToHex({ r: v, g: v, b: v }));
  for (let i = 0; i < 150; i++) {
    const samples = Array.from({ length: 1 + (i % 4) }, hex);
    for (const min of [3, 4.5]) {
      const brute = greys.some((g) => minContrast(g, samples) >= min);
      const fast = backdropFeasible(samples, min);
      // The exact answer can only be more permissive than the 256-step grey ramp.
      if (brute) assert.ok(fast, `${samples} @${min}`);
      if (!fast) assert.ok(!brute);
    }
  }
  assert.equal(backdropFeasible(['#000000', '#FFFFFF'], 3), true); // a mid grey sits in the gap
  assert.equal(backdropFeasible(['#000000', '#777777', '#FFFFFF'], 3), false);
});

test('compactByLuminance keeps every contrast verdict', () => {
  const rand = seededRandom(650);
  const hex = () => rgbToHex({ r: rand() * 255, g: rand() * 255, b: rand() * 255 });
  for (let i = 0; i < 40; i++) {
    const samples = Array.from({ length: 30 + i * 3 }, hex);
    const small = compactByLuminance(samples);
    assert.ok(small.length <= samples.length);
    for (const c of small) assert.ok(samples.includes(c));
    for (let j = 0; j < 40; j++) {
      const fg = hex();
      for (const min of [3, 4.5]) assert.equal(minContrast(fg, small) >= min, minContrast(fg, samples) >= min, `${fg} @${min}`);
    }
  }
});

test('wallpaper colours come from the theme wallpaper (lock colours, pattern tint, art) and stay clean', () => {
  for (const t of ALL_THEMES) {
    const cols = wallpaperColoursOf(t.wallpaper);
    assert.ok(cols.length >= 2 && cols.length <= 8, t.id);
    for (const c of cols) assert.ok(isHex(c) && designedColours(t.wallpaper).includes(c));
    assert.deepEqual(widgetTokensFrom(t).wallpaper, cols);
  }
  assert.deepEqual(wallpaperColoursOf(null), []);
  assert.deepEqual(wallpaperBackdrop([]), []);
});

// ------------------------------------------------------------------ pairing

test('pairGlassText: text stays AA on the pane over every wallpaper colour, for every bundled theme', () => {
  let faint = 0;
  for (const t of ALL_THEMES) {
    const wall = wallpaperColoursOf(t.wallpaper);
    const ref = referenceWallpaper(wall);
    for (const look of ['clear', 'tinted'] as const) {
      for (const min of [4.5, 3]) {
        const p = pairGlassText({ wallpaper: wall, look, tint: t.widget.accent, text: [t.palette.ink], min });
        assert.ok(p.wallpaperKnown);
        assert.ok(p.opacity > 0 && p.opacity <= 1);
        const c = minContrast(p.colour, ref.map((u) => composite(p.tint, p.opacity, u)));
        assert.ok(c >= min - 0.05, `${t.id} ${look} @${min}: ${p.colour} on ${p.tint}@${p.opacity} = ${c.toFixed(2)}`);
        assert.ok(p.contrast >= min);
        if (look === 'tinted') assert.equal(p.tint, t.widget.accent.toUpperCase());
        if (look === 'clear' && min === 4.5 && p.opacity <= 0.62) faint += 1;
      }
    }
  }
  // Clear really is see-through on most theme wallpapers.
  assert.ok(faint >= ALL_THEMES.length * 0.8, `clear ≤ 62 % on ${faint}/${ALL_THEMES.length} themes`);
});

test('pairGlassText without a known wallpaper bounds the pane over black and white', () => {
  const p = pairGlassText({ wallpaper: [], look: 'clear', min: 4.5 });
  assert.equal(p.wallpaperKnown, false);
  for (const under of ['#000000', '#FFFFFF', '#808080', '#FF0000']) {
    assert.ok(contrastRatio(p.colour, composite(p.tint, p.opacity, under)) >= 4.5 - 0.05, under);
  }
  assert.ok(p.opacity >= 0.5, 'unknown wallpaper → a more opaque pane');
});

test('glow palette: neon text clears AA on its dark base and on its own halo, for any accent', () => {
  const rand = seededRandom(6500);
  for (let i = 0; i < 200; i++) {
    const accent = rgbToHex({ r: rand() * 255, g: rand() * 255, b: rand() * 255 });
    const g = glowPalette(accent);
    const base = gradientStops(g.base, 9);
    const all = [...base, ...base.map((b) => composite(g.neon, GLOW_HALO_OPACITY, b))];
    assert.ok(minContrast(g.neon, all) >= 4.5 - 0.05, `${accent} → ${g.neon}`);
    assert.ok(suitsGlow(g.base), 'the base is dark');
  }
  assert.ok(isHex(glowPalette('nope').neon));
});

// ------------------------------------------------------------------ widget specs

test('every widget in a look stays readable (text 4.5:1 / large numerals 3:1, graphics 3:1)', () => {
  for (const [i, t] of ALL_THEMES.entries()) {
    const set = generateWidgetSet(t);
    // All 15 widgets for some themes, the small size of every kind for the rest (keeps the suite fast).
    const specs = i % 8 === 0 ? set.specs : WIDGET_KINDS.map((k) => widgetSpecOf(set, k, 'small')!);
    for (const base of specs) {
      for (const look of ['clear', 'tinted', 'glow'] as const) {
        const { spec, issues } = applyWidgetEdits(base, { look });
        assert.deepEqual(issues, []);
        assert.equal(spec.look, look);
        assert.equal(spec.edits.look, look);
        if (look === 'glow') {
          assert.equal(spec.surface, 'solid');
          assert.ok(spec.glow && isHex(spec.glow.colour));
        } else {
          assert.equal(spec.glow, null);
          assert.equal(spec.border, null);
        }
        assertLookReadable(spec);
      }
    }
  }
});

test('looks with user colours and text colours stay readable', () => {
  const set = generateWidgetSet(ALL_THEMES[3]);
  const rand = seededRandom(651);
  const hex = () => rgbToHex({ r: rand() * 255, g: rand() * 255, b: rand() * 255 });
  for (let i = 0; i < 24; i++) {
    const base = set.specs[i % set.specs.length];
    const look = (['clear', 'tinted', 'glow'] as const)[i % 3];
    const { spec } = applyWidgetEdits(base, { look, colours: { background: hex(), accent: hex(), text: hex() } });
    assertLookReadable(spec);
  }
  // Tinted uses the user's background colour as the tint.
  const tinted = applyWidgetEdits(widgetSpecOf(set, 'clock', 'small')!, { look: 'tinted', colours: { background: '#2255AA' } }).spec;
  assert.equal(tinted.background.kind === 'solid' && tinted.background.colour, '#2255AA');
});

test('clear and tinted are see-through over the theme wallpaper (not just a solid card)', () => {
  let seeThrough = 0;
  for (const t of ALL_THEMES) {
    const clock = widgetSpecOf(generateWidgetSet(t), 'clock', 'small')!;
    const s = applyWidgetEdits(clock, { look: 'clear' }).spec;
    if (s.surface === 'glass' && s.backgroundOpacity <= 0.62) seeThrough += 1;
  }
  assert.ok(seeThrough >= ALL_THEMES.length * 0.8, `${seeThrough}/${ALL_THEMES.length}`);
});

test('the theme look is unchanged: default specs carry look "theme", no glow, same as before', () => {
  const set = generateWidgetSet(ALL_THEMES[0]);
  for (const s of set.specs) {
    assert.equal(s.look, 'theme');
    assert.equal(s.glow, null);
    assert.equal(s.edits.look, 'theme');
  }
  const back = applyWidgetEdits(applyWidgetEdits(set.specs[0], { look: 'glow' }).spec, { look: null }).spec;
  assert.deepEqual(back, set.specs[0]);
  const bad = applyWidgetEdits(set.specs[0], { look: 'neon' as never });
  assert.deepEqual(bad.issues.map((i) => i.code), ['notSupported']);
  assert.equal(bad.spec.look, 'theme');
});

test('without a known wallpaper (a v1 theme) clear is bounded over black and white', () => {
  const tokens = { ...widgetTokensFrom(ALL_THEMES[0]), wallpaper: [] };
  const set = generateWidgetSetFromTokens(tokens);
  for (const s of set.specs) assertLookReadable(applyWidgetEdits(s, { look: 'clear' }).spec);
});

// ------------------------------------------------------------------ payload

test('glaze.widgets.v2 carries the look and wallpaper, round-trips, and stays backward compatible', () => {
  const set = generateWidgetSet(ALL_THEMES[5]);
  const looks = ['clear', 'tinted', 'glow'] as const;
  const edited = { ...set, specs: set.specs.map((s, i) => applyWidgetEdits(s, { look: looks[i % 3] }).spec) };
  const json = serialiseWidgetSet(edited, { now: NOW });
  const o = JSON.parse(json);
  assert.equal(o.v, 2);
  assert.deepEqual(o.tokens.wallpaper, set.tokens.wallpaper);
  assert.equal(o.specs[0].look, 'clear');
  assert.equal(o.specs[2].look, 'glow');
  assert.ok(o.specs[2].glow.radius > 0);
  // The v1 theme block is untouched (no look leaks into glaze.theme.v1).
  assert.equal('look' in o.theme, false);
  assert.equal(JSON.stringify(o.theme), serializeWidgetTheme(parseWidgetTheme(o.theme)!));

  const back = parseWidgetSetPayload(json)!;
  for (const [i, s] of back.set.specs.entries()) {
    assert.equal(s.look, looks[i % 3]);
    assert.equal(s.backgroundOpacity, edited.specs[i].backgroundOpacity);
    assertLookReadable(s);
  }

  // A payload written before T65: no look, no wallpaper → theme look, empty wallpaper.
  const old = JSON.parse(serialiseWidgetSet(set, { now: NOW }));
  delete old.tokens.wallpaper;
  for (const s of old.specs) {
    delete s.look;
    delete s.glow;
    delete s.edits.look;
  }
  const parsedOld = parseWidgetSetPayload(old)!;
  assert.deepEqual(parsedOld.set.tokens.wallpaper, []);
  for (const s of parsedOld.set.specs) assert.equal(s.look, 'theme');

  // Tampering: an unknown look and junk wallpaper colours fall back safely.
  const tampered = JSON.parse(json);
  tampered.specs[0].edits.look = 'neon';
  tampered.tokens.wallpaper = ['#FFFFFF', 'red', 7, '#000'];
  const t2 = parseWidgetSetPayload(tampered)!;
  assert.equal(t2.set.specs[0].look, 'theme');
  assert.deepEqual(t2.set.tokens.wallpaper, ['#FFFFFF', '#000000']);
  for (const s of t2.set.specs) assertLookReadable(s);
});

// ------------------------------------------------------------------ studio

test('Widget Studio: the look is part of the draft, saved and restored, and drives the spec', () => {
  const set = generateWidgetSet(ALL_THEMES[2]);
  let state = initialStudioState(set, 'clock', 'small');
  assert.equal(emptyDraft().look, 'theme');
  state = updateDraft(set, state, { look: 'clear' });
  const id = `${set.themeId}:clock:small`;
  assert.equal(state.drafts[id].look, 'clear');
  assert.equal(isDraftEmpty(state.drafts[id]), false);
  const base = widgetSpecOf(set, 'clock', 'small')!;
  assert.equal(draftEdits(base, state.drafts[id]).look, 'clear');
  assert.equal('look' in draftEdits(base, emptyDraft()), false);
  const shown = studioSpec(base, state.drafts[id]).spec;
  assert.equal(shown.look, 'clear');
  assertLookReadable(shown);

  const restored = parseStudioState(serialiseStudioState(state), set);
  assert.equal(restored.drafts[id].look, 'clear');
  // Drafts saved before T65 have no look.
  const old = JSON.parse(serialiseStudioState(updateDraft(set, initialStudioState(set), { accent: '#123456' })));
  for (const d of Object.values(old.drafts) as Record<string, unknown>[]) delete d.look;
  const restoredOld = parseStudioState(old, set);
  for (const d of Object.values(restoredOld.drafts)) assert.equal(d.look, 'theme');
  const junk = JSON.parse(serialiseStudioState(state));
  junk.drafts[id].look = 'sparkle';
  assert.equal(parseStudioState(junk, set).drafts[id], undefined, 'an otherwise empty draft with a junk look is dropped');
});

test('studioLooks offers every look, glow early for dark themes', () => {
  for (const t of ALL_THEMES) {
    const looks = studioLooks(widgetTokensFrom(t));
    assert.deepEqual([...looks].sort(), [...WIDGET_LOOKS].sort());
    assert.equal(looks[0], 'theme');
  }
  assert.equal(studioLooks({ bg: ['#0E0B2A', '#101A44'] })[1], 'glow');
  assert.equal(studioLooks({ bg: ['#FFF4F1'] })[1], 'clear');
});
