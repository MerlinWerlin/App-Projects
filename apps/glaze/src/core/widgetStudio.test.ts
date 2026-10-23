import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minContrast } from './colour.ts';
import { THEMES } from './themes.ts';
import { lookup, type CatalogueTree } from './i18n.ts';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import {
  TEXT_MIN_CONTRAST,
  WIDGET_SET_KEY,
  generateWidgetSet,
  parseWidgetSetPayload,
  widgetSpecOf,
  type WidgetSet,
} from './widgetSets.ts';
import {
  STUDIO_FONTS,
  STUDIO_MIN_POINT_SIZE,
  STUDIO_SCALE_DEFAULT,
  STUDIO_SCALE_MAX,
  STUDIO_SCALE_MIN,
  WIDGET_PHOTO_FILE,
  backgroundOptions,
  clampScale,
  colourSwatches,
  currentDraft,
  currentStudioSpec,
  daysUntil,
  draftEdits,
  editableRegions,
  fractionOfScale,
  gradientSwatches,
  gradientValue,
  hasCountdown,
  initialStudioState,
  needsPhotoCopy,
  parseGradientValue,
  parseStudioState,
  parseStudioStore,
  resetDraft,
  scaleFromFraction,
  scaledPointSize,
  selectWidget,
  serialiseStudioState,
  setDraftText,
  stepScale,
  studioKinds,
  studioPayload,
  studioSizes,
  updateDraft,
  catalogueDraftEdits,
  catalogueEditableRegions,
  catalogueHasButtons,
  catalogueSpecIds,
  catalogueStudioKinds,
  catalogueStudioSizes,
  currentCatalogueDraft,
  currentCatalogueSpecId,
  currentCatalogueStudioSpec,
  resetCatalogueDraft,
  rotateOptions,
  selectCatalogueWidget,
  setCatalogueDraftText,
  studioCatalogue,
  studioCataloguePayload,
  updateCatalogueDraft,
} from './widgetStudio.ts';
import { CATALOGUE_KINDS, CATALOGUE_KIND_SIZES, catalogueSpecOf, parseWidgetCatalogue } from './widgetKinds.ts';

const SET: WidgetSet = generateWidgetSet(THEMES[0]);
const NOW = new Date('2026-10-18T09:41:00.000Z');

test('kinds and sizes come from the generated set (new kinds show up automatically)', () => {
  const kinds = studioKinds(SET);
  assert.deepEqual(kinds, [...new Set(SET.specs.map((s) => s.kind))]);
  for (const k of kinds) assert.deepEqual(studioSizes(SET, k), SET.specs.filter((s) => s.kind === k).map((s) => s.size));
  // A set with an extra kind appended is picked up without code changes.
  const extra = { ...SET, specs: [...SET.specs, { ...SET.specs[0], id: 'x:extra:small', kind: 'extra' as never }] };
  assert.ok((studioKinds(extra) as string[]).includes('extra'));
});

test('initial state opens on the requested widget, else the first kind in small', () => {
  const s = initialStudioState(SET, 'photo', 'large');
  assert.equal(s.kind, 'photo');
  assert.equal(s.size, 'large');
  const d = initialStudioState(SET, 'nope', 'huge');
  assert.equal(d.kind, studioKinds(SET)[0]);
  assert.equal(d.size, 'small');
  assert.equal(d.themeId, SET.themeId);
});

test('selecting a widget keeps drafts and the size when the kind has it', () => {
  let s = initialStudioState(SET, 'clock', 'medium');
  s = updateDraft(SET, s, { accent: '#123456' });
  s = selectWidget(SET, s, 'date');
  assert.equal(s.size, 'medium');
  assert.equal(currentDraft(SET, s).accent, null);
  s = selectWidget(SET, s, 'clock');
  assert.equal(currentDraft(SET, s).accent, '#123456');
  assert.equal(selectWidget(SET, s, 'nope' as never), s);
});

test('slider snaps to 5 % steps between 70 and 130', () => {
  assert.equal(clampScale(102), 100);
  assert.equal(clampScale(103), 105);
  assert.equal(clampScale(10), STUDIO_SCALE_MIN);
  assert.equal(clampScale(999), STUDIO_SCALE_MAX);
  assert.equal(clampScale(Number.NaN), STUDIO_SCALE_DEFAULT);
  assert.equal(clampScale('x'), STUDIO_SCALE_DEFAULT);
  assert.equal(scaleFromFraction(0), 70);
  assert.equal(scaleFromFraction(1), 130);
  assert.equal(scaleFromFraction(0.5), 100);
  assert.equal(fractionOfScale(100), 0.5);
  assert.equal(stepScale(130, 1), 130);
  assert.equal(stepScale(100, -1), 95);
});

test('scaled point sizes stay readable and inside their region', () => {
  assert.equal(scaledPointSize(40, 100, 51), 40);
  assert.ok(scaledPointSize(40, 130, 51) <= 51 / 1.15 + 0.1);
  assert.equal(scaledPointSize(10, 70, 40), STUDIO_MIN_POINT_SIZE);
  // A design that is already taller than its box is never shrunk by scaling up.
  assert.equal(scaledPointSize(60, 130, 40), 60);
});

test('font and size restyle every text line and keep AA contrast', () => {
  for (const font of STUDIO_FONTS) {
    let s = initialStudioState(SET, 'clock', 'large');
    s = updateDraft(SET, s, { font, scalePct: 120 });
    const { spec } = currentStudioSpec(SET, s)!;
    const base = widgetSpecOf(SET, 'clock', 'large')!;
    if (font !== 'theme') assert.equal(spec.typeface, font);
    for (const r of spec.regions) {
      if (!r.text) continue;
      const before = base.regions.find((b) => b.id === r.id)!.text!.sizePt;
      assert.ok(r.text.sizePt >= before, `${r.id} grew`);
      assert.ok(minContrast(r.colour!, r.backdrop) >= TEXT_MIN_CONTRAST - 1e-9);
      if (font !== 'theme') assert.equal(r.text.font, 'display');
    }
  }
});

test('draft maps onto widgetSets edits; photo only on photo widgets', () => {
  const photo = widgetSpecOf(SET, 'photo', 'medium')!;
  const clock = widgetSpecOf(SET, 'clock', 'small')!;
  assert.deepEqual(backgroundOptions(photo), ['photo', 'colour', 'gradient', 'theme']);
  assert.deepEqual(backgroundOptions(clock), ['colour', 'gradient', 'theme']);
  let s = initialStudioState(SET, 'photo', 'medium');
  s = updateDraft(SET, s, { background: { kind: 'photo', uri: 'file:///docs/backgrounds/a.jpg' } });
  const e = draftEdits(photo, currentDraft(SET, s));
  assert.equal(e.photoRef, WIDGET_PHOTO_FILE);
  const r = currentStudioSpec(SET, s)!;
  assert.equal(r.spec.photoRef, WIDGET_PHOTO_FILE);
  assert.deepEqual(r.issues, []);
  assert.equal(needsPhotoCopy(SET, s), 'file:///docs/backgrounds/a.jpg');
  // The same photo background on a clock is ignored (no photo area).
  assert.equal(draftEdits(clock, currentDraft(SET, s)).photoRef, undefined);
});

test('colours, gradients and text flow through with issues as catalogue keys', () => {
  let s = initialStudioState(SET, 'quote', 'large');
  const spec = widgetSpecOf(SET, 'quote', 'large')!;
  assert.ok(hasCountdown(spec));
  const quote = editableRegions(spec).find((r) => r.id === 'quote')!;
  s = setDraftText(SET, s, 'quote', 'x'.repeat(quote.maxLength + 10));
  s = updateDraft(SET, s, { background: { kind: 'gradient', from: '#FFFFFF', to: '#FFEEEE' }, textColour: '#FFFFFF', countdownTo: '2026-12-25' });
  const r = currentStudioSpec(SET, s)!;
  const region = r.spec.regions.find((x) => x.id === 'quote')!;
  assert.equal([...region.text!.userText!].length, quote.maxLength);
  assert.ok(r.issues.some((i) => i.code === 'tooLong'));
  assert.ok(r.issues.some((i) => i.code === 'contrastAdjusted'));
  for (const i of r.issues) assert.equal(typeof lookup(en as unknown as CatalogueTree, i.messageKey), 'string');
  assert.equal(r.spec.countdownTo, '2026-12-25');
  // Empty text resets to the sample.
  s = setDraftText(SET, s, 'quote', '');
  assert.equal(currentStudioSpec(SET, s)!.spec.regions.find((x) => x.id === 'quote')!.text!.userText, null);
  s = resetDraft(SET, s);
  assert.deepEqual(s.drafts, {});
});

test('swatch presets: theme colours first, unique, gradient values round-trip', () => {
  const c = colourSwatches(SET.tokens);
  assert.equal(c[0].hex, SET.tokens.bg[0].toUpperCase());
  assert.equal(new Set(c.map((x) => x.hex)).size, c.length);
  const g = gradientSwatches(SET.tokens);
  assert.ok(g.every((x) => x.hex2 && x.hex2 !== x.hex));
  const v = gradientValue('#aabbcc', '#112233');
  assert.deepEqual(parseGradientValue(v), { from: '#AABBCC', to: '#112233' });
  assert.equal(parseGradientValue('nope'), null);
  for (const s of [...c, ...g]) {
    assert.equal(typeof lookup(en as unknown as CatalogueTree, s.nameKey), 'string', s.nameKey);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
      assert.equal(typeof lookup(cat as CatalogueTree, s.nameKey), 'string', `${locale} ${s.nameKey}`);
    }
  }
});

test('countdown days use the local calendar day', () => {
  const today = new Date(2026, 9, 18, 23, 30);
  assert.equal(daysUntil('2026-10-25', today), 7);
  assert.equal(daysUntil('2026-10-18', today), 0);
  assert.equal(daysUntil('bad', today), null);
  assert.equal(daysUntil(null, today), null);
});

test('payload is a valid glaze.widgets.v2 set with the studio block, no preview uri', () => {
  assert.equal(WIDGET_SET_KEY, 'glaze.widgets.v2');
  let s = initialStudioState(SET, 'photo', 'small');
  s = updateDraft(SET, s, { background: { kind: 'photo', uri: 'file:///private/a.jpg' }, font: 'serif', scalePct: 110 });
  s = setDraftText(SET, s, 'caption', 'Beach day');
  const json = studioPayload(SET, s, { now: NOW, translate: (k) => `T(${k})` });
  assert.ok(!json.includes('file://'), 'preview uri never written');
  const o = JSON.parse(json);
  assert.equal(o.v, 2);
  const id = `${SET.themeId}:photo:small`;
  assert.equal(o.studio.selected, id);
  assert.deepEqual(o.studio.styles[id], { font: 'serif', scalePct: 110 });
  const spec = o.specs.find((x: { id: string }) => x.id === id);
  assert.equal(spec.typeface, 'serif');
  assert.equal(spec.photoRef, WIDGET_PHOTO_FILE);
  assert.equal(o.texts[id].caption, 'Beach day');
  const back = parseWidgetSetPayload(json);
  assert.ok(back);
  assert.equal(back!.set.specs.find((x) => x.id === id)!.photoRef, WIDGET_PHOTO_FILE);
});

test('studio state round-trips and tolerates junk', () => {
  let s = initialStudioState(SET, 'battery', 'medium');
  s = updateDraft(SET, s, { accent: '#abcdef', scalePct: 90, font: 'mono' });
  s = setDraftText(SET, s, 'label', 'My\u0007 phone');
  const back = parseStudioState(serialiseStudioState(s), SET);
  assert.equal(back.kind, 'battery');
  assert.equal(back.size, 'medium');
  const d = back.drafts[`${SET.themeId}:battery:medium`];
  assert.equal(d.accent, '#ABCDEF');
  assert.equal(d.text.label, 'My phone');
  assert.equal(d.font, 'mono');
  // Junk and other themes fall back to a fresh studio.
  for (const junk of ['{', null, 3, [], { v: 9 }, { v: 1, themeId: 'other' }]) {
    const f = parseStudioState(junk, SET);
    assert.deepEqual(f.drafts, {});
    assert.equal(f.themeId, SET.themeId);
  }
  const bad = parseStudioState(
    { v: 1, themeId: SET.themeId, kind: 'photo', size: 'small', drafts: { [`${SET.themeId}:photo:small`]: { background: { kind: 'photo', uri: 'https://x/y.jpg' }, accent: 'red', font: 'comic', scalePct: 400 }, 'zz:unknown': {} } },
    SET,
  );
  const bd = bad.drafts[`${SET.themeId}:photo:small`];
  assert.deepEqual(bd.background, { kind: 'theme' }, 'only file:// photo copies');
  assert.equal(bd.accent, null);
  assert.equal(bd.font, 'theme');
  assert.equal(bd.scalePct, STUDIO_SCALE_MAX);
  assert.deepEqual(Object.keys(bad.drafts), [`${SET.themeId}:photo:small`]);
  assert.deepEqual(parseStudioStore('nope'), {});
  assert.deepEqual(parseStudioStore({ a: 1 }), { a: 1 });
});

// ------------------------------------------------------------------ catalogue kinds (T78)

const CAT = studioCatalogue(SET);

test('catalogue kinds: every kind is offered with the sizes widgetKinds gives it', () => {
  assert.deepEqual(catalogueStudioKinds(), [...CATALOGUE_KINDS]);
  for (const k of CATALOGUE_KINDS) assert.deepEqual(catalogueStudioSizes(k), [...CATALOGUE_KIND_SIZES[k]]);
  assert.equal(new Set(catalogueSpecIds(SET.themeId)).size, CAT.specs.length);
  assert.deepEqual(new Set(catalogueSpecIds(SET.themeId)), new Set(CAT.specs.map((s) => s.id)));
  assert.deepEqual(rotateOptions(), [15, 30, 60, 180, 360, 720, 1440]);
});

test('the route can open a catalogue widget; picking a set widget closes it again', () => {
  const s = initialStudioState(SET, 'countdown', 'medium');
  assert.deepEqual(s.catalogue, { kind: 'countdown', size: 'medium' });
  assert.equal(currentCatalogueSpecId(s), `${SET.themeId}:countdown:medium`);
  // A size the kind doesn't have falls back to small, else the kind's first size.
  assert.deepEqual(initialStudioState(SET, 'monthCalendar', 'small').catalogue, { kind: 'monthCalendar', size: 'medium' });
  assert.deepEqual(initialStudioState(SET, 'analogClock', 'nope').catalogue, { kind: 'analogClock', size: 'small' });
  const back = selectWidget(SET, s, 'clock');
  assert.equal(back.catalogue, undefined);
  assert.equal(currentCatalogueStudioSpec(CAT, back), null);
  // Plain set states stay as they were (no catalogue keys).
  assert.deepEqual(Object.keys(initialStudioState(SET, 'clock', 'small')).sort(), ['drafts', 'kind', 'size', 'themeId', 'v']);
  assert.equal(selectCatalogueWidget(s, 'nope' as never), s);
});

test('catalogue drafts: text, colours, countdown day and album interval go through applyCatalogueEdits', () => {
  let s = initialStudioState(SET, 'countdown', 'small');
  const spec = catalogueSpecOf(CAT, 'countdown', 'small')!;
  const regions = catalogueEditableRegions(spec).map((r) => r.id);
  assert.ok(regions.includes('title') && regions.includes('label'));
  s = setCatalogueDraftText(s, 'title', 'Our trip');
  // (The countdown draws on an accent gradient, so a text colour may be adjusted for AA.)
  s = updateCatalogueDraft(s, { countdownTo: '2026-12-24', accent: '#203040', textColour: '#FAFAFA' });
  const edited = currentCatalogueStudioSpec(CAT, s)!;
  assert.ok(edited.issues.every((i) => i.code === 'contrastAdjusted'), JSON.stringify(edited.issues));
  assert.equal(edited.spec.regions.find((r) => r.id === 'title')!.text!.userText, 'Our trip');
  assert.equal(edited.spec.countdownTo, '2026-12-24');
  assert.equal(edited.spec.accent, '#203040');
  for (const r of edited.spec.regions) if (r.role === 'text' && r.colour) assert.ok(minContrast(r.colour, r.backdrop) >= TEXT_MIN_CONTRAST);
  // Background colour on a habit widget.
  let h = initialStudioState(SET, 'habitWater', 'small');
  h = updateCatalogueDraft(h, { background: { kind: 'colour', colour: '#101820' }, textColour: '#FAFAFA' });
  const hs = currentCatalogueStudioSpec(CAT, h)!;
  assert.deepEqual(hs.issues, []);
  assert.deepEqual(hs.spec.background, { kind: 'solid', colour: '#101820' });
  // Drafts are per widget and survive switching.
  s = selectCatalogueWidget(s, 'countdown', 'medium');
  assert.equal(currentCatalogueDraft(s).countdownTo, null);
  s = selectCatalogueWidget(s, 'countdown', 'small');
  assert.equal(currentCatalogueDraft(s).text.title, 'Our trip');
  s = setCatalogueDraftText(s, 'title', '');
  assert.equal(currentCatalogueDraft(s).text.title, undefined);
  assert.equal(currentCatalogueDraft(resetCatalogueDraft(s)).countdownTo, null);

  // Album interval: only listed values are kept.
  let a = initialStudioState(SET, 'photoAlbum', 'medium');
  a = updateCatalogueDraft(a, { rotateMinutes: 180 });
  assert.equal(currentCatalogueStudioSpec(CAT, a)!.spec.rotateMinutes, 180);
  a = updateCatalogueDraft(a, { rotateMinutes: 7 });
  assert.equal(currentCatalogueDraft(a).rotateMinutes, null);
  assert.equal(currentCatalogueStudioSpec(CAT, a)!.spec.rotateMinutes, 60);
});

test('Lock Screen sizes take no colour edits (iOS tints them); habit widgets are flagged as having buttons', () => {
  const acc = catalogueSpecOf(CAT, 'countdown', 'accessoryRectangular')!;
  const edits = catalogueDraftEdits(acc, { text: {}, background: { kind: 'colour', colour: '#FF0000' }, accent: '#00FF00', textColour: null, countdownTo: null, rotateMinutes: null });
  assert.equal(edits.colours, undefined);
  let s = initialStudioState(SET, 'countdown', 'accessoryRectangular');
  s = updateCatalogueDraft(s, { accent: '#00FF00' });
  assert.deepEqual(currentCatalogueStudioSpec(CAT, s)!.issues, []);
  assert.equal(currentCatalogueStudioSpec(CAT, s)!.spec.rendering, 'monochrome');
  assert.ok(catalogueHasButtons(catalogueSpecOf(CAT, 'habitWater', 'small')!));
  assert.ok(!catalogueHasButtons(catalogueSpecOf(CAT, 'analogClock', 'small')!));
});

test('catalogue payload: set + catalogue block through serialiseWidgetCatalogue, studio names the widget added', () => {
  let s = initialStudioState(SET, 'countdown', 'medium');
  s = updateCatalogueDraft(s, { countdownTo: '2027-01-01' });
  s = setCatalogueDraftText(s, 'title', 'New year');
  const json = studioCataloguePayload(SET, CAT, s, { now: NOW, translate: (k) => `T(${k})` });
  const o = JSON.parse(json);
  assert.equal(o.studio.selected, `${SET.themeId}:countdown:medium`);
  assert.equal(o.specs.length, SET.specs.length);
  const back = parseWidgetCatalogue(json)!;
  assert.ok(back);
  const spec = back.catalogue.specs.find((x) => x.id === `${SET.themeId}:countdown:medium`)!;
  assert.equal(spec.countdownTo, '2027-01-01');
  assert.equal(back.texts[spec.id].title, 'New year');
  // A set widget open: selected is the set spec id; catalogue edits still ride along.
  const set = selectWidget(SET, s, 'clock', 'small');
  assert.equal(JSON.parse(studioCataloguePayload(SET, CAT, set, { now: NOW })).studio.selected, `${SET.themeId}:clock:small`);
  assert.equal(parseWidgetCatalogue(studioCataloguePayload(SET, CAT, set, { now: NOW }))!.catalogue.specs.find((x) => x.id === spec.id)!.countdownTo, '2027-01-01');
});

test('catalogue drafts persist and junk is dropped', () => {
  let s = initialStudioState(SET, 'habitWater', 'medium');
  s = setCatalogueDraftText(s, 'name', 'Water\u0007 today');
  s = updateCatalogueDraft(s, { accent: '#abcdef' });
  const back = parseStudioState(serialiseStudioState(s), SET);
  assert.deepEqual(back.catalogue, { kind: 'habitWater', size: 'medium' });
  const d = currentCatalogueDraft(back);
  assert.equal(d.text.name, 'Water today');
  assert.equal(d.accent, '#ABCDEF');
  const junk = parseStudioState(
    {
      v: 1, themeId: SET.themeId, kind: 'clock', size: 'small', drafts: {},
      catalogue: { kind: 'nope' },
      catalogueDrafts: { 'x:y:z': { accent: '#000000' }, [`${SET.themeId}:photoAlbum:small`]: { rotateMinutes: 5, background: { kind: 'photo', uri: 'file:///a.jpg' }, accent: '#111111' } },
    },
    SET,
  );
  assert.equal(junk.catalogue, undefined);
  assert.deepEqual(Object.keys(junk.catalogueDrafts ?? {}), [`${SET.themeId}:photoAlbum:small`]);
  const jd = junk.catalogueDrafts![`${SET.themeId}:photoAlbum:small`];
  assert.equal(jd.rotateMinutes, null);
  assert.deepEqual(jd.background, { kind: 'theme' });
  // Set-only states serialise exactly as before.
  assert.deepEqual(Object.keys(JSON.parse(serialiseStudioState(initialStudioState(SET)))).sort(), ['drafts', 'kind', 'size', 'themeId', 'v']);
});

test('Widgets tab / studio copy for catalogue kinds is in every locale', () => {
  const keys = ['previewBadge', 'buttonsNote', 'studio.rotate', 'studio.minutes', 'studio.hours', 'studio.albumPhotos', 'studio.lockColours', 'studio.standbyNote'].map((k) => `tabs.widgetsTab.${k}`);
  for (const key of keys) {
    assert.equal(typeof lookup(en as unknown as CatalogueTree, key), 'string', `en missing ${key}`);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) assert.equal(typeof lookup(cat as CatalogueTree, key), 'string', `${locale} missing ${key}`);
  }
});
