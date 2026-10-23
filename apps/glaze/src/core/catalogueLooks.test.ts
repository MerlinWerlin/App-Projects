// T85: widget looks (clear / tinted glass, glow) for every catalogue kind, with WCAG guarantees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, minContrast } from './colour.ts';
import { ALL_THEMES } from './plusThemes.ts';
import { WIDGET_LOOKS, textMinContrast, type WidgetLook } from './widgetLook.ts';
import {
  CATALOGUE_KINDS,
  CATALOGUE_KIND_SIZES,
  applyCatalogueEdits,
  buildCatalogueSpec,
  catalogueLooksFor,
  familyOf,
  generateWidgetCatalogueFromTokens,
  parseWidgetCatalogue,
  serialiseWidgetCatalogue,
  type CatalogueSpec,
} from './widgetKinds.ts';
import { GRAPHIC_MIN_CONTRAST, generateWidgetSet, generateWidgetSetFromTokens, widgetSpecOf, widgetTokensFrom, type WidgetTokens } from './widgetSets.ts';
import {
  catalogueSpecInLook,
  catalogueStudioLooks,
  currentCatalogueStudioSpec,
  emptyCatalogueDraft,
  initialStudioState,
  isCatalogueDraftEmpty,
  parseStudioState,
  previewLooks,
  selectCatalogueWidget,
  serialiseStudioState,
  setSpecInLook,
  studioCatalogue,
  updateCatalogueDraft,
} from './widgetStudio.ts';

const NOW = new Date('2026-10-18T09:41:00Z');

/** Every text line ≥ its look's minimum (and never below 3:1); every graphic ≥ 3:1. */
function assertReadable(spec: CatalogueSpec, look: WidgetLook): void {
  const where = `${spec.id} in ${look}`;
  for (const r of spec.regions) {
    if (spec.rendering === 'monochrome' || !r.colour || r.backdrop.length === 0) continue;
    const real = minContrast(r.colour, r.backdrop);
    assert.ok(Math.abs(real - r.contrast) < 0.01, `${where} ${r.id}: stored contrast matches`);
    if (r.role === 'text' && r.text) {
      const min = textMinContrast(look, r.text.source, r.text.sizePt, r.text.weight);
      assert.ok(real >= min, `${where} ${r.id}: text ${real} < ${min}`);
      assert.ok(real >= 3, `${where} ${r.id}: text below 3:1`);
      if (r.grid) assert.ok(contrastRatio(r.grid.todayText, r.grid.todayFill) >= 4.5, `${where}: today marker`);
    } else if (r.role === 'action') {
      assert.ok(real >= 4.5, `${where} ${r.id}: button symbol`);
    } else {
      assert.ok(real >= GRAPHIC_MIN_CONTRAST, `${where} ${r.id}: graphic ${real}`);
    }
  }
}

test('every catalogue kind renders in every look on its home sizes', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  for (const kind of CATALOGUE_KINDS) {
    const home = CATALOGUE_KIND_SIZES[kind].filter((s) => familyOf(s) === 'home');
    assert.ok(home.length > 0, `${kind} has a home size`);
    for (const size of home) {
      const base = buildCatalogueSpec(tokens, kind, size);
      assert.equal(base.look, 'theme');
      assert.equal(base.glow, null);
      for (const look of WIDGET_LOOKS) {
        const { spec, issues } = applyCatalogueEdits(base, { look });
        assert.deepEqual(issues, [], `${kind}/${size}/${look}`);
        assert.equal(spec.look, look);
        assert.equal(spec.edits.look, look);
        if (look === 'glow') assert.ok(spec.glow && spec.glow.radius > 0 && spec.surface === 'solid');
        if (look === 'clear' || look === 'tinted') assert.equal(spec.surface, 'glass', `${kind}/${size}/${look} uses a pane`);
      }
    }
  }
});

test('glass and glow keep WCAG contrast for every theme, kind and size', () => {
  for (const theme of ALL_THEMES) {
    const tokens = widgetTokensFrom(theme);
    for (const kind of CATALOGUE_KINDS) {
      for (const size of CATALOGUE_KIND_SIZES[kind]) {
        const base = buildCatalogueSpec(tokens, kind, size);
        for (const look of catalogueLooksFor(base.family)) {
          if (look === 'theme') continue;
          assertReadable(applyCatalogueEdits(base, { look }).spec, look);
        }
      }
    }
  }
});

test('clear glass is see-through where the wallpaper allows, and checked against it', () => {
  let seeThrough = 0;
  for (const theme of ALL_THEMES.slice(0, 14)) {
    const tokens = widgetTokensFrom(theme);
    const spec = applyCatalogueEdits(buildCatalogueSpec(tokens, 'countdown', 'small'), { look: 'clear' }).spec;
    if (spec.backgroundOpacity < 1) seeThrough++;
    assert.ok(spec.background?.kind === 'solid');
    const text = spec.regions.find((r) => r.id === 'days')!;
    // With a known wallpaper the backdrop is the pane over it, not black and white.
    assert.ok(text.backdrop.length > 0);
  }
  assert.ok(seeThrough >= 10, `most themes get a see-through pane (${seeThrough})`);
});

test('user colours and text still stay readable under a look', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[3]);
  for (const look of ['clear', 'tinted', 'glow'] as const) {
    const { spec, issues } = applyCatalogueEdits(buildCatalogueSpec(tokens, 'habitWater', 'small'), {
      look,
      colours: { background: '#FFD400', accent: '#3355FF', text: '#FFFF00' },
      text: {},
    });
    assertReadable(spec, look);
    assert.ok(issues.every((i) => i.code === 'contrastAdjusted'));
  }
});

test('StandBy takes theme or glow; Lock Screen sizes keep the theme look', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[0]);
  assert.deepEqual(catalogueLooksFor('accessory'), ['theme']);
  assert.deepEqual(catalogueLooksFor('standby'), ['theme', 'glow']);
  const lock = buildCatalogueSpec(tokens, 'countdown', 'accessoryCircular');
  const r1 = applyCatalogueEdits(lock, { look: 'glow' });
  assert.equal(r1.spec.look, 'theme');
  assert.deepEqual(r1.issues.map((i) => [i.field, i.code]), [['look', 'notSupported']]);
  const standby = buildCatalogueSpec(tokens, 'countdown', 'standby');
  const r2 = applyCatalogueEdits(standby, { look: 'clear' });
  assert.equal(r2.spec.look, 'theme');
  assert.equal(r2.issues[0].code, 'notSupported');
  const glow = applyCatalogueEdits(standby, { look: 'glow' }).spec;
  assert.equal(glow.look, 'glow');
  assert.equal(glow.background?.kind === 'solid' && glow.background.colour, '#000000', 'StandBy stays on black');
  assertReadable(glow, 'glow');
  const reset = applyCatalogueEdits(applyCatalogueEdits(standby, { look: 'glow' }).spec, { look: null }).spec;
  assert.equal(reset.look, 'theme');
  assert.equal(applyCatalogueEdits(standby, { look: 'neon' as unknown as WidgetLook }).issues[0].code, 'notSupported');
});

test('the theme look is unchanged by T85 (same spec as before looks existed)', () => {
  const tokens = widgetTokensFrom(ALL_THEMES[5]);
  const base = buildCatalogueSpec(tokens, 'monthCalendar', 'medium');
  const again = applyCatalogueEdits(applyCatalogueEdits(base, { look: 'glow' }).spec, { look: 'theme' }).spec;
  assert.deepEqual(again.regions, base.regions);
  assert.deepEqual(again.background, base.background);
});

test('looks survive the widget payload round trip, and old payloads read as the theme look', () => {
  const theme = ALL_THEMES[2];
  const set = generateWidgetSet(theme);
  const cat = generateWidgetCatalogueFromTokens(set.tokens);
  const looks: Record<string, WidgetLook> = {};
  cat.specs = cat.specs.map((s) => {
    const want = catalogueLooksFor(s.family).at(-1)!;
    looks[s.id] = want;
    return applyCatalogueEdits(s, { look: want }).spec;
  });
  const json = serialiseWidgetCatalogue(set, cat, { now: NOW });
  const raw = JSON.parse(json) as { catalogue: { specs: { id: string; look: string; edits: { look: string } }[] } };
  for (const s of raw.catalogue.specs) {
    assert.equal(s.look, looks[s.id]);
    assert.equal(s.edits.look, looks[s.id]);
  }
  const parsed = parseWidgetCatalogue(json)!;
  for (const s of parsed.catalogue.specs) assert.equal(s.look, looks[s.id], s.id);

  // Strip looks (a pre-T85 payload): everything is the theme look.
  for (const s of raw.catalogue.specs) {
    delete (s as Record<string, unknown>).look;
    delete (s.edits as Record<string, unknown>).look;
  }
  const old = parseWidgetCatalogue(JSON.stringify(raw))!;
  assert.ok(old.catalogue.specs.every((s) => s.look === 'theme'));
  // A look a size can't take, written by hand, is ignored.
  const forged = JSON.parse(json) as { catalogue: { specs: { size: string; edits: Record<string, unknown> }[] } };
  for (const s of forged.catalogue.specs) s.edits.look = 'clear';
  const f = parseWidgetCatalogue(JSON.stringify(forged))!;
  for (const s of f.catalogue.specs) assert.equal(s.look, s.family === 'home' ? 'clear' : 'theme');
});

test('studio: a catalogue draft carries its look, and saved state keeps it', () => {
  const set = generateWidgetSet(ALL_THEMES[1]);
  const cat = studioCatalogue(set);
  let state = selectCatalogueWidget(initialStudioState(set), 'yearProgress', 'medium');
  assert.equal(emptyCatalogueDraft().look, 'theme');
  state = updateCatalogueDraft(state, { look: 'tinted' });
  const open = currentCatalogueStudioSpec(cat, state)!;
  assert.equal(open.spec.look, 'tinted');
  assert.deepEqual(catalogueStudioLooks(open.spec), catalogueLooksFor('home', set.tokens));
  const id = `${set.themeId}:yearProgress:medium`;
  assert.equal(isCatalogueDraftEmpty(state.catalogueDrafts![id]), false);
  const back = parseStudioState(serialiseStudioState(state), set);
  assert.equal(back.catalogueDrafts?.[id]?.look, 'tinted');
  assert.equal(isCatalogueDraftEmpty({ ...emptyCatalogueDraft(), look: undefined }), true);
  // A Lock Screen size ignores a look in its draft.
  let lock = selectCatalogueWidget(initialStudioState(set), 'habitSleep', 'accessoryRectangular');
  lock = updateCatalogueDraft(lock, { look: 'glow' });
  const lockSpec = currentCatalogueStudioSpec(cat, lock)!;
  assert.equal(lockSpec.spec.look, 'theme');
  assert.deepEqual(lockSpec.issues, []);
});

test('Widgets tab preview looks apply to set and catalogue widgets alike', () => {
  const tokens: WidgetTokens = widgetTokensFrom(ALL_THEMES[0]);
  const set = generateWidgetSetFromTokens(tokens);
  assert.deepEqual(previewLooks(tokens).slice().sort(), [...WIDGET_LOOKS].sort());
  const clock = widgetSpecOf(set, 'clock', 'small')!;
  assert.equal(setSpecInLook(clock, 'theme'), clock);
  assert.equal(setSpecInLook(clock, 'glow').look, 'glow');
  const cat = generateWidgetCatalogueFromTokens(tokens);
  for (const s of cat.specs) {
    const out = catalogueSpecInLook(s, 'clear');
    assert.equal(out.look, s.family === 'home' ? 'clear' : 'theme', s.id);
    if (s.family !== 'home') assert.equal(out, s);
  }
});
