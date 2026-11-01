// T187: pack format v2 widget options (parser / validator, v1 adapter, fit geometry, menu model).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FILL_ASPECT_TOLERANCE,
  MAX_WIDGET_OPTIONS,
  OPTION_SIZE_POINTS,
  PRACTICAL_KINDS,
  WIDGET_ART_PADDING,
  WIDGET_OPTION_KINDS,
  WIDGET_SHELF_KINDS,
  WIDGET_SHELF_ORDER,
  aspectMatch,
  isPracticalKind,
  liveKindOf,
  liveStudioHref,
  optionsForSize,
  parseWidgetOptions,
  placeArt,
  selectedOption,
  shelfOptions,
  validateWidgetOptions,
  widgetOptionKindKey,
  widgetOptionSections,
  widgetOptionsFromV1,
  widgetOptionsOfPack,
  widgetShelf,
  type OptionAsset,
} from './widgetOptions.ts';
import { parseRemoteArtManifest } from './packCatalog.ts';
import { deviceManifest } from './packDownloader.ts';
import { remoteArtFiles } from './remoteCatalog.ts';
import * as tabsNs from '../i18n/ns/tabs/index.ts';
import { CATALOGUE_KIND_SIZES, CATALOGUE_SIZE_POINTS } from './widgetKinds.ts';

const root = process.cwd();
const fixture = (): Record<string, unknown> => JSON.parse(readFileSync(join(root, 'src', 'core', 'fixtures', 'manifest-alpine-starlight-v1.json'), 'utf8'));

const ASSETS: OptionAsset[] = [
  { path: 'wallpaper-2796.aaaaaaaa.webp', role: 'wallpaper', width: 1290, height: 2796 },
  { path: 'widget-boat.11111111.webp', role: 'widget-art', width: 1024, height: 1024 },
  { path: 'widget-clock.22222222.webp', role: 'widget-art', width: 1024, height: 1024 },
  { path: 'widget-wide.33333333.webp', role: 'widget-art', width: 1092, height: 510 },
  { path: 'widget-small.44444444.webp', role: 'widget-small', width: 510, height: 510 },
  { path: 'thumb.55555555.webp', role: 'thumb', width: 240, height: 520 },
];

const boat = { id: 'paper-boat', kind: 'art', image: 'widget-boat.11111111.webp', sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur', label: 'Paper boat' };

test('parse: a full option keeps every field and takes the size from its asset', () => {
  const r = parseWidgetOptions([boat], ASSETS);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.options, [
    { id: 'paper-boat', kind: 'art', image: 'widget-boat.11111111.webp', sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur', label: 'Paper boat', width: 1024, height: 1024, derived: false },
  ]);
});

test('parse: fit defaults to fit, background to theme, label to null; label is trimmed', () => {
  const r = parseWidgetOptions([{ id: 'c', kind: 'clock', image: 'widget-clock.22222222.webp', sizes: ['small'] }, { id: 'd', kind: 'art', image: 'widget-small.44444444.webp', sizes: ['lock'], label: '  Moon  ' }], ASSETS);
  assert.deepEqual(r.errors, []);
  assert.equal(r.options[0].fit, 'fit');
  assert.equal(r.options[0].background, 'theme');
  assert.equal(r.options[0].label, null);
  assert.equal(r.options[1].label, 'Moon');
  // v1 widget roles may be referenced too.
  assert.equal(r.options[1].image, 'widget-small.44444444.webp');
});

test('parse: label null is the same as no label (a stored device manifest round-trips)', () => {
  const r = parseWidgetOptions([{ ...boat, label: null, width: 1, height: 1, derived: true }], ASSETS);
  assert.deepEqual(r.errors, []);
  assert.equal(r.options[0].label, null);
  assert.equal(r.options[0].width, 1024, 'size always comes from the asset');
  assert.equal(r.options[0].derived, false);
});

test('parse: each bad option is dropped with a reason; good ones stay', () => {
  const bad: unknown[] = [
    7,
    { ...boat, id: 'Bad Id' },
    { ...boat, id: '-x' },
    { ...boat, id: 'x'.repeat(41) },
    { ...boat, id: 'k1', kind: 'weather' },
    { ...boat, id: 'k2', image: 'nope.webp' },
    { ...boat, id: 'k3', image: 'wallpaper-2796.aaaaaaaa.webp' },
    { ...boat, id: 'k4', image: 'thumb.55555555.webp' },
    { ...boat, id: 'k5', sizes: [] },
    { ...boat, id: 'k6', sizes: 'small' },
    { ...boat, id: 'k7', sizes: ['small', 'huge'] },
    { ...boat, id: 'k8', sizes: ['small', 'small'] },
    { ...boat, id: 'k9', fit: 'crop' },
    { ...boat, id: 'k10', background: 'red' },
    { ...boat, id: 'k11', label: '' },
    { ...boat, id: 'k12', label: 'x'.repeat(41) },
    { ...boat, id: 'k13', label: 5 },
    boat,
    { ...boat },
  ];
  const r = parseWidgetOptions(bad, ASSETS);
  assert.deepEqual(r.options.map((o) => o.id), ['paper-boat']);
  assert.equal(r.errors.length, bad.length - 1, r.errors.join('\n'));
  assert.ok(r.errors.some((e) => e.includes('duplicate id paper-boat')));
  assert.ok(r.errors.some((e) => e.includes('unknown kind weather')));
  assert.ok(r.errors.some((e) => e.includes('has role wallpaper')));
});

test('parse: not a list, and more than the maximum', () => {
  assert.deepEqual(parseWidgetOptions({}, ASSETS), { options: [], errors: ['widgets: not a list'] });
  const many = Array.from({ length: MAX_WIDGET_OPTIONS + 3 }, (_, i) => ({ ...boat, id: `o${i}` }));
  const r = parseWidgetOptions(many, ASSETS);
  assert.equal(r.options.length, MAX_WIDGET_OPTIONS);
  assert.equal(r.errors.length, 1);
});

test('validate (strict, for pack builders): empty is an error, any dropped option is an error', () => {
  assert.deepEqual(validateWidgetOptions([], ASSETS), ['widgets: empty']);
  assert.deepEqual(validateWidgetOptions([boat], ASSETS), []);
  assert.equal(validateWidgetOptions([boat, { ...boat, id: 'z', kind: 'nope' }], ASSETS).length, 1);
});

test('every kind is accepted; live kinds map to real catalogue widgets', () => {
  const list = WIDGET_OPTION_KINDS.map((k) => ({ id: `k-${k}`, kind: k, image: 'widget-clock.22222222.webp', sizes: ['small'] }));
  assert.equal(parseWidgetOptions(list, ASSETS).options.length, WIDGET_OPTION_KINDS.length);
  for (const k of WIDGET_OPTION_KINDS) {
    const live = liveKindOf(k);
    if (live) assert.ok(live in CATALOGUE_KIND_SIZES, `${k} → ${live} is a catalogue kind`);
    assert.equal(widgetOptionKindKey(k), `tabs.widgetsTab.art.kinds.${k}`);
  }
  assert.equal(liveKindOf('art'), null);
  assert.equal(liveKindOf('battery'), null);
  assert.equal(liveKindOf('clock'), 'analogClock');
});

test('v1 adapter: each widget role is an art option offered in every Home Screen size, own size first', () => {
  const m = fixture();
  const opts = widgetOptionsFromV1(m.assets as OptionAsset[]);
  assert.deepEqual(opts.map((o) => o.id), ['hero-small', 'hero-medium', 'hero-large']);
  assert.deepEqual(opts.map((o) => o.sizes[0]), ['small', 'medium', 'large']);
  for (const o of opts) {
    assert.deepEqual([...o.sizes].sort(), ['large', 'medium', 'small']);
    assert.equal(o.kind, 'art');
    assert.equal(o.fit, 'fit');
    assert.equal(o.background, 'wallpaper');
    assert.equal(o.derived, true);
    assert.ok(!o.sizes.includes('lock'));
  }
  assert.deepEqual(widgetOptionsFromV1([]), []);
});

test('v1 manifest (real fixture) parses with derived options; the medium tab offers the square art too', () => {
  const r = parseRemoteArtManifest(fixture(), 'alpine-starlight');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.version, 1);
  assert.equal(r.value.widgets.length, 3);
  const medium = optionsForSize(r.value.widgets, 'medium');
  assert.equal(medium[0].id, 'hero-medium', 'its own art first');
  assert.ok(medium.some((o) => o.id === 'hero-small'), 'square art is offered (fitted) in medium');
  assert.equal(optionsForSize(r.value.widgets, 'lock').length, 0);
});

test('v1 manifests still reject the v2-only widget-art role', () => {
  const m = fixture();
  const assets = m.assets as Record<string, unknown>[];
  assets[3] = { ...assets[3], role: 'widget-art' };
  assert.equal(parseRemoteArtManifest(m).ok, false);
});

function v2(widgets: unknown): Record<string, unknown> {
  const m = fixture();
  const assets = [...(m.assets as Record<string, unknown>[])];
  const extra = [
    { path: 'widget-boat.0a0b0c0d.webp', role: 'widget-art', width: 1024, height: 1024, bytes: 20000, sha256: 'a'.repeat(64), mime: 'image/webp' },
    { path: 'widget-clock.1a1b1c1d.webp', role: 'widget-art', width: 1024, height: 1024, bytes: 15000, sha256: 'b'.repeat(64), mime: 'image/png' },
  ];
  assets.push(...extra);
  const total = assets.reduce((n, a) => n + (a.bytes as number), 0);
  return { ...m, version: 2, assets, totalBytes: total, ...(widgets === undefined ? {} : { widgets }) };
}

test('v2 manifest: the widgets list becomes the options', () => {
  const r = parseRemoteArtManifest(
    v2([
      { id: 'paper-boat', kind: 'art', image: 'widget-boat.0a0b0c0d.webp', sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur', label: 'Paper boat' },
      { id: 'moon-clock', kind: 'clock', image: 'widget-clock.1a1b1c1d.webp', sizes: ['small', 'lock'] },
    ]),
    'alpine-starlight',
  );
  assert.ok(r.ok, r.ok ? '' : r.error);
  if (!r.ok) return;
  assert.equal(r.value.version, 2);
  assert.deepEqual(r.value.widgets.map((o) => o.id), ['paper-boat', 'moon-clock']);
  assert.deepEqual(optionsForSize(r.value.widgets, 'small').map((o) => o.id), ['paper-boat', 'moon-clock'], 'pack order kept');
  assert.deepEqual(optionsForSize(r.value.widgets, 'lock').map((o) => o.id), ['moon-clock']);
});

test('v2 manifest: widgets list is required; an all-bad list falls back to the v1 roles', () => {
  const missing = parseRemoteArtManifest(v2(undefined));
  assert.equal(missing.ok, false);
  const allBad = parseRemoteArtManifest(v2([{ id: 'x', kind: 'nope', image: 'widget-boat.0a0b0c0d.webp', sizes: ['small'] }]));
  assert.ok(allBad.ok);
  if (allBad.ok) assert.deepEqual(allBad.value.widgets.map((o) => o.id), ['hero-small', 'hero-medium', 'hero-large']);
  assert.equal(parseRemoteArtManifest({ ...fixture(), version: 3 }).ok, false);
});

test('v2 device manifest round-trips through JSON (what the phone stores and re-reads)', () => {
  const r = parseRemoteArtManifest(v2([{ id: 'paper-boat', kind: 'art', image: 'widget-boat.0a0b0c0d.webp', sizes: ['medium'] }]), 'alpine-starlight');
  assert.ok(r.ok);
  if (!r.ok) return;
  const local = deviceManifest(r.value, r.value.assets.filter((a) => a.role !== 'wallpaper' || a.width === 1290));
  const again = parseRemoteArtManifest(JSON.parse(JSON.stringify(local)), 'alpine-starlight');
  assert.ok(again.ok, again.ok ? '' : again.error);
  if (again.ok) assert.deepEqual(again.value.widgets, r.value.widgets);
  // and a stored v1 manifest (which now carries derived options) still parses as v1.
  const v1 = parseRemoteArtManifest(fixture());
  assert.ok(v1.ok);
  if (v1.ok) {
    const back = parseRemoteArtManifest(JSON.parse(JSON.stringify(v1.value)));
    assert.ok(back.ok);
    if (back.ok) assert.deepEqual(back.value.widgets, v1.value.widgets);
  }
});

test('widgetOptionsOfPack picks v2 or derives from v1', () => {
  assert.equal(widgetOptionsOfPack({ version: 1, widgets: [boat], assets: ASSETS })[0].id, 'hero-small');
  assert.equal(widgetOptionsOfPack({ version: 2, widgets: [boat], assets: ASSETS })[0].id, 'paper-boat');
});

// ------------------------------------------------------------------ geometry

const inside = (r: { x: number; y: number; w: number; h: number }, box: { w: number; h: number }) =>
  r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= box.w + 1e-9 && r.y + r.h <= box.h + 1e-9;

test('placeArt: square art in a medium widget is fitted whole, centred, never cropped', () => {
  const box = OPTION_SIZE_POINTS.medium;
  const p = placeArt({ w: 1024, h: 1024 }, box, 'fit');
  assert.equal(p.mode, 'fit');
  assert.ok(inside(p.rect, box));
  assert.ok(Math.abs(p.rect.w - p.rect.h) < 1e-9, 'aspect kept');
  const pad = Math.min(box.w, box.h) * WIDGET_ART_PADDING;
  assert.ok(Math.abs(p.rect.h - (box.h - pad * 2)) < 1e-9, 'fills the height');
  assert.ok(Math.abs(p.rect.x - (box.w - p.rect.w) / 2) < 1e-9, 'centred');
});

test('placeArt: fill is honoured only for a matching aspect; otherwise it fits', () => {
  for (const size of ['small', 'medium', 'large'] as const) {
    const box = OPTION_SIZE_POINTS[size];
    const same = placeArt({ w: box.w * 3, h: box.h * 3 }, box, 'fill');
    assert.equal(same.mode, 'fill');
    assert.deepEqual(same.rect, { x: 0, y: 0, w: box.w, h: box.h });
    const square = placeArt({ w: 100, h: 100 }, box, 'fill');
    if (size === 'small') assert.equal(square.mode, 'fill');
    else {
      assert.equal(square.mode, 'fit');
      assert.ok(inside(square.rect, box));
    }
  }
  // Just outside the tolerance → fit.
  const near = placeArt({ w: 100 * (1 + FILL_ASPECT_TOLERANCE * 2), h: 100 }, { w: 100, h: 100 }, 'fill');
  assert.equal(near.mode, 'fit');
});

test('placeArt: every art shape stays inside every box, with its own aspect', () => {
  const shapes = [{ w: 1, h: 1 }, { w: 1092, h: 510 }, { w: 510, h: 1092 }, { w: 1092, h: 1146 }, { w: 3000, h: 10 }, { w: 0, h: 0 }];
  for (const art of shapes) {
    for (const box of [...Object.values(OPTION_SIZE_POINTS), { w: 0, h: 0 }, { w: 50, h: 300 }]) {
      const p = placeArt(art, box, 'fit');
      assert.ok(inside(p.rect, box), `${JSON.stringify(art)} in ${JSON.stringify(box)}`);
      if (art.w > 0 && box.w > 0 && p.rect.h > 0) assert.ok(Math.abs(p.rect.w / p.rect.h - art.w / art.h) < 1e-6);
    }
  }
});

test('aspectMatch is symmetric and 1 for the same shape', () => {
  assert.equal(aspectMatch({ w: 2, h: 1 }, { w: 4, h: 2 }), 1);
  assert.equal(aspectMatch({ w: 1, h: 1 }, { w: 2, h: 1 }), aspectMatch({ w: 2, h: 1 }, { w: 1, h: 1 }));
  assert.ok(aspectMatch({ w: 1, h: 1 }, OPTION_SIZE_POINTS.medium) < 0.5);
});

test('the option boxes have the same aspect as the real widget sizes', () => {
  for (const s of ['small', 'medium', 'large'] as const) {
    const real = CATALOGUE_SIZE_POINTS[s];
    assert.ok(Math.abs(OPTION_SIZE_POINTS[s].w / OPTION_SIZE_POINTS[s].h - real.width / real.height) < 0.02, s);
  }
});

// ------------------------------------------------------------------ menu

test('sections: one per kind, practical kinds first (shelf order), art last; every piece in every Home size', () => {
  const r = parseWidgetOptions(
    [
      // T206: number-free pictures stay practical (pictures with fixed numbers go with the art).
      { id: 'c1', kind: 'clock', image: 'widget-clock.22222222.webp', sizes: ['small'], numberFree: true },
      { id: 'a1', kind: 'art', image: 'widget-boat.11111111.webp', sizes: ['small', 'medium'] },
      { id: 'b1', kind: 'battery', image: 'widget-clock.22222222.webp', sizes: ['small'], numberFree: true },
      { id: 'a2', kind: 'art', image: 'widget-wide.33333333.webp', sizes: ['medium'] },
    ],
    ASSETS,
  );
  const ids = (size: 'small' | 'medium' | 'large') => widgetOptionSections(r.options, size).map((s) => [s.kind, s.options.map((o) => o.id)]);
  // a2 is only suggested for medium, but small offers it too (fitted), after the suggested a1.
  assert.deepEqual(ids('small'), [['clock', ['c1']], ['battery', ['b1']], ['art', ['a1', 'a2']]]);
  assert.deepEqual(ids('medium'), [['clock', ['c1']], ['battery', ['b1']], ['art', ['a1', 'a2']]]);
  // Nothing is suggested for large: still every piece, the best aspect match first.
  assert.deepEqual(ids('large'), [['clock', ['c1']], ['battery', ['b1']], ['art', ['a1', 'a2']]]);
  assert.deepEqual(widgetOptionSections(r.options, 'lock'), []);
});

test('T201 widgetShelf: practical (habits, countdown, calendar, date, clock, battery…), then art, then standard', () => {
  assert.deepEqual(WIDGET_SHELF_ORDER, ['practical', 'art', 'standard']);
  assert.deepEqual(PRACTICAL_KINDS.slice(0, 6), ['habits', 'countdown', 'calendar', 'date', 'clock', 'battery']);
  assert.deepEqual([...WIDGET_SHELF_KINDS].sort(), [...WIDGET_OPTION_KINDS].sort(), 'every kind has a shelf place');
  assert.equal(WIDGET_SHELF_KINDS[WIDGET_SHELF_KINDS.length - 1], 'art');
  assert.ok(PRACTICAL_KINDS.every(isPracticalKind) && !isPracticalKind('art'));
  const img = 'widget-boat.11111111.webp';
  const r = parseWidgetOptions(
    [
      { id: 'fox', kind: 'art', image: img, sizes: ['small', 'medium', 'large'] },
      { id: 'clock', kind: 'clock', image: img, sizes: ['small'], numberFree: true },
      { id: 'cal', kind: 'calendar', image: img, sizes: ['medium'], numberFree: true },
      { id: 'water', kind: 'habits', image: img, sizes: ['small', 'medium'], numberFree: true },
      { id: 'trip', kind: 'countdown', image: img, sizes: ['large'], numberFree: true },
      { id: 'owl', kind: 'art', image: 'widget-wide.33333333.webp', sizes: ['medium'] },
      { id: 'lockonly', kind: 'date', image: img, sizes: ['lock'], numberFree: true },
    ],
    ASSETS,
  );
  assert.equal(r.errors.length, 0);
  const standard = ['analogClock', 'battery', 'date', 'monthCalendar'];
  const shelf = widgetShelf(r.options, 'small', standard);
  assert.deepEqual(shelf.map((b) => b.group), ['practical', 'art', 'standard']);
  const flat = shelf.flatMap((b) =>
    b.group === 'practical' ? b.sections.flatMap((s) => s.options.map((o) => o.id)) : b.group === 'art' ? b.options.map((o) => o.id) : b.items,
  );
  assert.deepEqual(flat, ['water', 'trip', 'cal', 'clock', 'fox', 'owl', ...standard]);
  assert.deepEqual(shelfOptions(r.options, 'small').map((o) => o.id), ['water', 'trip', 'cal', 'clock', 'fox', 'owl']);
  // The first thing on the shelf is what a fresh menu selects.
  assert.equal(selectedOption(r.options, 'small', null)?.id, 'water');
  assert.equal(selectedOption(r.options, 'small', 'owl')?.id, 'owl', 'a medium-only piece can be picked for small');
  // Lock: only lock pieces; empty groups are left out.
  assert.deepEqual(widgetShelf(r.options, 'lock').map((b) => b.group), ['practical']);
  assert.deepEqual(widgetShelf([], 'small', standard).map((b) => b.group), ['standard']);
  assert.deepEqual(widgetShelf([], 'small'), []);
});

test('T201: any art piece is offered in every Home Screen size, suggested sizes first', () => {
  const r = parseWidgetOptions(
    [
      { id: 'banner', kind: 'art', image: 'widget-wide.33333333.webp', sizes: ['medium'], fit: 'fill' },
      { id: 'fox', kind: 'art', image: 'widget-boat.11111111.webp', sizes: ['small'] },
    ],
    ASSETS,
  );
  for (const size of ['small', 'medium', 'large'] as const) {
    assert.deepEqual(optionsForSize(r.options, size).map((o) => o.id).sort(), ['banner', 'fox'], size);
  }
  assert.deepEqual(optionsForSize(r.options, 'medium').map((o) => o.id), ['banner', 'fox']);
  assert.deepEqual(optionsForSize(r.options, 'small').map((o) => o.id), ['fox', 'banner']);
  assert.deepEqual(optionsForSize(r.options, 'large').map((o) => o.id), ['fox', 'banner'], 'square fits large better');
  // And it is never cropped there: a wide `fill` banner in a small box is fitted whole.
  const banner = r.options[0];
  const p = placeArt({ w: banner.width, h: banner.height }, OPTION_SIZE_POINTS.small, banner.fit);
  assert.equal(p.mode, 'fit');
  assert.ok(p.rect.w <= OPTION_SIZE_POINTS.small.w && p.rect.h <= OPTION_SIZE_POINTS.small.h);
  assert.ok(Math.abs(p.rect.w / p.rect.h - banner.width / banner.height) < 1e-9, 'own aspect kept');
});

test('selectedOption: remembered id when still offered, else the first', () => {
  const opts = widgetOptionsFromV1(ASSETS.concat([{ path: 'widget-medium.6.webp', role: 'widget-medium', width: 1092, height: 510 }]));
  assert.equal(selectedOption(opts, 'medium', 'hero-small')?.id, 'hero-small');
  assert.equal(selectedOption(opts, 'medium', 'gone')?.id, 'hero-medium');
  assert.equal(selectedOption(opts, 'lock', null), null);
  assert.equal(selectedOption([], 'small', 'x'), null);
});

test('liveStudioHref: the catalogue widget in this size, or its first Home Screen size; none for art', () => {
  assert.equal(liveStudioHref('cloud-atelier', 'clock', 'small'), '/widget-studio?theme=cloud-atelier&kind=analogClock&size=small');
  // The analogue clock has no medium size: it opens in small.
  assert.equal(liveStudioHref('cloud-atelier', 'clock', 'medium'), '/widget-studio?theme=cloud-atelier&kind=analogClock&size=small');
  assert.equal(liveStudioHref('cloud-atelier', 'date', 'small'), '/widget-studio?theme=cloud-atelier&kind=monthCalendar&size=medium');
  assert.equal(liveStudioHref('x', 'art', 'small'), null);
  assert.equal(liveStudioHref('x', 'battery', 'small'), null);
});

test('remoteArtFiles: a v2 pack with no widget-<size> file uses its first option for that size', () => {
  const assets = [
    { path: 'wallpaper-2796.aaaaaaaa.webp', role: 'wallpaper' as const },
    { path: 'thumb.55555555.webp', role: 'thumb' as const },
    { path: 'widget-boat.11111111.webp', role: 'widget-art' as const },
  ].map((a) => ({ ...a, width: 10, height: 10, bytes: 1, sha256: 'a'.repeat(64), mime: 'image/webp' as const }));
  const widgets = parseWidgetOptions([{ ...boat, sizes: ['medium', 'large'] }], assets).options;
  assert.deepEqual(remoteArtFiles({ assets, widgets }).heroes, { medium: 'widget-boat.11111111.webp', large: 'widget-boat.11111111.webp' });
  assert.deepEqual(remoteArtFiles({ assets }).heroes, {});
});

test('T201 remoteArtFiles: a v2 art option beats a (possibly pre-cropped) v1 widget-<size> file; v1 packs unchanged', () => {
  const assets = [
    { path: 'wallpaper-2796.aaaaaaaa.webp', role: 'wallpaper' as const },
    { path: 'widget-medium.22222222.webp', role: 'widget-medium' as const },
    { path: 'widget-fox.11111111.webp', role: 'widget-art' as const },
    { path: 'widget-habits.33333333.webp', role: 'widget-art' as const },
  ].map((a) => ({ ...a, width: 10, height: 10, bytes: 1, sha256: 'a'.repeat(64), mime: 'image/webp' as const }));
  const widgets = parseWidgetOptions(
    [
      { id: 'water', kind: 'habits', image: 'widget-habits.33333333.webp', sizes: ['small', 'medium', 'large'] },
      { id: 'fox', kind: 'art', image: 'widget-fox.11111111.webp', sizes: ['small', 'medium', 'large'], background: 'blur' },
    ],
    assets,
  ).options;
  const heroes = remoteArtFiles({ assets, widgets }).heroes;
  assert.deepEqual(heroes, { small: 'widget-fox.11111111.webp', medium: 'widget-fox.11111111.webp', large: 'widget-fox.11111111.webp' }, 'the whole art piece, never the habits picture');
  // Only practical options: the v1 file is still preferred over a habits picture.
  const practical = widgets.filter((o) => o.kind !== 'art');
  assert.equal(remoteArtFiles({ assets, widgets: practical }).heroes.medium, 'widget-medium.22222222.webp');
  // v1 (derived options): the v1 role files as before.
  const v1 = widgetOptionsFromV1(assets);
  assert.deepEqual(remoteArtFiles({ assets, widgets: v1 }).heroes, { medium: 'widget-medium.22222222.webp' });
});

test('docs/THEME_PACKS.md: the v2 example manifest parses and validates strictly', () => {
  const doc = read('docs', 'THEME_PACKS.md');
  const at = doc.indexOf('### Example v2 manifest');
  assert.ok(at > 0);
  const block = /```json\n([\s\S]*?)\n```/.exec(doc.slice(at));
  assert.ok(block);
  const raw = JSON.parse(block[1].replaceAll('<64 hex>', 'a'.repeat(64)));
  const r = parseRemoteArtManifest(raw, 'cloud-atelier');
  assert.ok(r.ok, r.ok ? '' : r.error);
  assert.deepEqual(validateWidgetOptions(raw.widgets, raw.assets), []);
  if (r.ok) {
    assert.equal(r.value.widgets.length, 5);
    assert.deepEqual(optionsForSize(r.value.widgets, 'medium').map((o) => o.id), ['paper-boat', 'cloud-banner', 'rain-habits', 'hot-air-balloon', 'cloud-clock']);
  }
  // Every field name the table documents is a field the parser reads.
  for (const f of ['`id`', '`kind`', '`image`', '`sizes`', '`fit`', '`background`', '`label`']) assert.ok(doc.includes(`| ${f} |`), f);
});

// ------------------------------------------------------------------ source guards (UI + native)

const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('Widgets tab shows the theme widget art menu above the grid', () => {
  const tab = read('app', '(tabs)', 'widgets.tsx');
  assert.match(tab, /import \{ ThemeWidgetArt \} from '\.\.\/\.\.\/src\/ui\/ThemeWidgetArt';/);
  assert.match(tab, /<ThemeWidgetArt theme=\{gridTheme\} size=\{size\}/);
  const art = read('src', 'ui', 'ThemeWidgetArt.tsx');
  assert.match(art, /useRemoteArtTheme\(/);
  assert.match(art, /widgetOptionsFromV1\(/, 'bundled art packs list their hero pieces as options');
  assert.match(art, /widgets\.setWidgetArt\(/);
  assert.match(art, /widgets\.setSeamless\(/);
  // T251: every piece tries the wallpaper crop first; setWidgetArt only when there is no wallpaper file.
  assert.match(art, /ok = await seamless\(artUri\);\s*if \(ok === false && option\.background !== 'wallpaper'\)/);
});

test('menu previews fit the art (never crop): placeArt / fullBleedArt rectangle + contain; T251 no blurred copy', () => {
  const menu = read('src', 'ui', 'WidgetArtMenu.tsx');
  assert.match(menu, /placeArt\(/); // over the wallpaper crop (inset hero, like setSeamless)
  assert.match(menu, /fullBleedArt\(/); // no wallpaper: theme colour, full bleed (like setWidgetArt)
  assert.match(menu, /<BlendedArt source=\{source\} rect=\{place\.rect\} blend=\{blend\} \/>/);
  assert.equal((menu.match(/contentFit="cover"/g) ?? []).length, 0);
  assert.doesNotMatch(menu, /strips\.map\(|styles\.strip|blurRadius/);
  assert.match(menu, /accessibilityState=\{\{ selected \}\}/);
  assert.match(menu, /widgetOptionSections\(/);
  assert.doesNotMatch(menu, /withSpring|Animated\.spring|ActivityIndicator/);
});

test('native: the Seamless widget fits its image (T251: no blurred copy); the bridge has setWidgetArt (fit)', () => {
  const widget = read('targets', 'widget', 'SeamlessWidget.swift');
  assert.match(widget, /\.scaledToFit\(\)/);
  assert.doesNotMatch(widget, /\.blur\(radius:/);
  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  assert.match(bridge, /AsyncFunction\("setWidgetArt"\)/);
  assert.doesNotMatch(bridge, /CIGaussianBlur/);
  assert.match(bridge, /let s = min\(target\.width \/ art\.size\.width, target\.height \/ art\.size\.height\)/, 'fit = min scale (T236: no inset)');
  const adapter = read('src', 'native', 'widgets.ts');
  assert.match(adapter, /typeof mod\.setWidgetArt !== 'function'\) return \{ available: false, ok: false, reason: 'not-built' \}/);
});

test('every locale has the widget art menu strings', () => {
  const keys = ['eyebrow', 'title', 'body', 'numbered', 'optionA11y', 'live', 'liveHint', 'use', 'useA11y', 'makeLive', 'download'];
  const locales = Object.entries(tabsNs) as [string, { widgetsTab?: { art?: Record<string, unknown> } }][];
  assert.equal(locales.length, 11);
  for (const [loc, msgs] of locales) {
    const art = msgs.widgetsTab?.art ?? {};
    for (const k of keys) assert.ok(typeof art[k] === 'string' && (art[k] as string).length > 0, `${loc}: art.${k}`);
    const kinds = (art.kinds ?? {}) as Record<string, string>;
    for (const k of WIDGET_OPTION_KINDS) assert.ok(typeof kinds[k] === 'string' && kinds[k].length > 0, `${loc}: art.kinds.${k}`);
  }
});
