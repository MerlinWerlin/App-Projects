import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_THEMES } from './plusThemes.ts';
import { calendarMonth, DESIGNED_KINDS, designedWidget, designedLiveSpec, isReplacedArtEdition, parseDesignedWidget, withWidgetIdentity } from './designedWidgets.ts';
import { plannedDesignedWidgets, upgradedDesignedLibrary } from './designedWidgetLibrary.ts';
import { parseLiveArtSpec } from './liveArt.ts';
import { minContrast } from './colour.ts';
import { parseLibrary, resolveWidgetPiece, serializeLibrary, themePieceId } from './widgetArtLibrary.ts';
import { designedWidgetSvg, localeFirstWeekday } from './designedWidgetPreview.ts';

const fixture = JSON.parse(readFileSync(new URL('../../docs/designed-widget-fixtures.json', import.meta.url), 'utf8')) as { catalogueThemes: number; themes: { id: string; designs: ReturnType<typeof designedWidget>[] }[] };
for (const theme of fixture.themes) theme.designs = theme.designs.map(design => withWidgetIdentity(theme.id, design));

test('every catalogue and bundled theme has authored, readable clock, battery and calendar artwork', () => {
  assert.equal(fixture.catalogueThemes, 141);
  assert.ok(fixture.themes.length >= 141);
  for (const t of fixture.themes) {
    assert.deepEqual(t.designs.map(d => d.kind), [...DESIGNED_KINDS], t.id);
    for (const design of t.designs) {
      assert.ok(design.identity, t.id);
      assert.deepEqual(parseDesignedWidget(design), design, t.id);
      assert.ok(minContrast(design.ink, design.background) >= 4.5, t.id);
      assert.ok(minContrast(design.secondary, design.background) >= 4.5, t.id);
      assert.ok(minContrast(design.accent, design.background) >= 3, t.id);
      assert.ok(minContrast(design.onAccent, [design.accent]) >= 4.5, t.id);
      assert.ok(!JSON.stringify(design).includes('.png'));
    }
  }
});

test('Gregorian month grid matches independent UTC weekday/length over 400 years and both week starts', () => {
  for (let year = 2000; year < 2400; year++) for (let month = 0; month < 12; month++) for (const first of [0, 1, 6]) {
    const result = calendarMonth(new Date(year, month, 15, 12), first);
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    assert.equal(result.days, days);
    assert.equal(result.offset, (new Date(Date.UTC(year, month, 1)).getUTCDay() - first + 7) % 7);
    assert.deepEqual(result.cells.filter(n => n !== null), Array.from({ length: days }, (_, i) => i + 1));
    assert.equal(result.cells.length, 42);
  }
  assert.equal(calendarMonth(new Date(2026, 7, 31), 0).offset, 6); // six-row month
  assert.equal(calendarMonth(new Date(2028, 1, 29)).days, 29);
  assert.equal(localeFirstWeekday('en-US'), 0);
  assert.equal(localeFirstWeekday('en-AU'), 1);
});

test('semantic designs survive the real shared library serializer, and corrupt designs fail safely', () => {
  const theme = ALL_THEMES[0], planned = plannedDesignedWidgets(theme, (kind, size) => `${kind} ${size}`);
  assert.equal(planned.length, 9);
  const lib = { v: 1 as const, pieces: planned.map(({ optionId, ...p }) => ({ ...p, file: p.id + '.jpg', created: 1 })) };
  const decoded = parseLibrary(serializeLibrary(lib));
  assert.deepEqual([...decoded.pieces].sort((a,b) => a.id.localeCompare(b.id)), [...lib.pieces].sort((a,b) => a.id.localeCompare(b.id)));
  const raw = designedLiveSpec(theme, 'clock');
  assert.deepEqual(parseLiveArtSpec(raw), raw);
  assert.equal(parseLiveArtSpec({ ...raw, kind: 'battery' }), null);
  assert.equal(parseLiveArtSpec({ ...raw, design: { ...raw.design, v: 2 } }), null);
  assert.equal(parseLiveArtSpec({ ...raw, design: { ...raw.design, ink: 'red' } }), null);
});

test('installed old ids migrate without losing personal photos, current choices, art or creation dates', () => {
  const theme = ALL_THEMES[0], plan = plannedDesignedWidgets(theme, (kind, size) => `${kind} ${size}`);
  const old = plan.map(({ optionId, ...p }) => ({ ...p, live: { ...p.live!, design: undefined }, file: p.id + '.jpg', created: 1234 }));
  const photo = { id: 'p-photo', name: 'My photo', themeId: null, themeName: '', source: 'photo' as const, file: 'p-photo.jpg', created: 2000, aspect: 1, size: null };
  const art = { ...old[0], id: 't-original-art', file: 't-original-art.jpg', name: 'Glass comet', live: undefined };
  const lib = { v: 1 as const, pieces: [photo, art, ...old], currentThemeId: theme.id, unpinned: { small: old[1].id } };
  const upgraded = upgradedDesignedLibrary(lib, theme, (kind, size) => `${kind} ${size}`)!;
  assert.equal(upgraded.pieces[0], photo); assert.equal(upgraded.pieces[1], art);
  assert.deepEqual(upgraded.unpinned, lib.unpinned);
  assert.deepEqual(upgraded.pieces.map(p => p.created), lib.pieces.map(p => p.created));
  assert.equal(upgraded.pieces.filter(p => p.live?.design).length, 9);
  assert.equal(upgradedDesignedLibrary(upgraded, theme, (kind, size) => `${kind} ${size}`), null);
});

test('legacy fallback clocks disappear from menus and saved art without losing working designs or photos', () => {
  const theme = ALL_THEMES[0];
  const designs = plannedDesignedWidgets(theme, (kind, size) => `${kind} ${size}`).map(({ optionId, ...p }) => ({ ...p, file: p.id + '.jpg', created: 100 }));
  const clocks = designs.filter(p => p.live?.design?.kind === 'clock');
  const legacy = clocks.map(p => ({ ...p, id: themePieceId(theme.id, 'live-clock', p.size!), file: themePieceId(theme.id, 'live-clock', p.size!) + '.jpg', name: 'Plain clock (fallback)', live: { ...p.live!, design: undefined }, slot: 12 }));
  const photo = { id: 'p-photo', name: 'Plain clock (fallback)', themeId: null, themeName: '', source: 'photo' as const, file: 'p-photo.jpg', created: 200, aspect: 1, size: null };
  const art = { ...designs[0], id: 't-original-art', file: 't-original-art.jpg', name: 'Original artwork', slot: 3, live: undefined };
  const inactiveFallback = { ...legacy[0], themeId: ALL_THEMES[1].id, id: themePieceId(ALL_THEMES[1].id, 'live-clock', 'small'), file: 'inactive-fallback.jpg' };
  const lib = { v: 1 as const, pieces: [photo, art, ...designs, ...legacy, inactiveFallback], currentThemeId: theme.id, retired: { 'old-art': { size: 'medium' as const, slot: 4 } }, unpinned: { small: legacy[0].id, medium: photo.id } };
  const upgraded = upgradedDesignedLibrary(lib, theme, (kind, size) => `${kind} ${size}`)!;
  assert.deepEqual(upgraded.pieces, [photo, art, ...designs]);
  assert.deepEqual(upgraded.retired?.['old-art'], lib.retired['old-art']);
  assert.deepEqual(upgraded.retired?.[inactiveFallback.id], { size: 'small', slot: 0 });
  assert.equal(upgraded.unpinned?.small, clocks[0].id);
  assert.equal(upgraded.unpinned?.medium, photo.id);
  for (const piece of legacy) assert.equal(resolveWidgetPiece(upgraded, piece.id, piece.size), clocks.find(p => p.size === piece.size)!.id);
  assert.equal(upgradedDesignedLibrary(upgraded, theme, (kind, size) => `${kind} ${size}`), null);
  assert.deepEqual(['live-clock', 'original-art'].filter(id => !isReplacedArtEdition({ id })), ['original-art']);
  assert.deepEqual(plannedDesignedWidgets(theme, (kind, size) => `${kind} ${size}`).map(p => p.id), designs.map(p => p.id));
});

test('each preview draws the function at every size, including six calendar rows and Alpine original art', () => {
  const date = new Date(2026, 7, 31, 22, 48);
  const identities = new Map<string, Map<string, string>>();
  for (const t of fixture.themes) for (const design of t.designs) for (const size of ['small', 'medium', 'large'] as const) {
    const svg = designedWidgetSvg(design, size, { date, battery: 73, locale: 'en-AU', originalArtwork: 'alpine-clock-face.jpg' });
    assert.ok(svg.startsWith('<svg'));
    assert.doesNotMatch(svg, /NaN|undefined/);
    const original = t.id === 'alpine-starlight' && design.kind === 'clock';
    assert.equal(svg.includes('<image href="alpine-clock-face.jpg"'), original);
    if (original) assert.notEqual(svg, designedWidgetSvg(design, size, { date: new Date(2026, 7, 31, 7, 25), battery: 73, locale: 'en-AU', originalArtwork: 'alpine-clock-face.jpg' }));
    if (design.kind === 'calendar') for (let day = 1; day <= 31; day++) assert.ok(svg.includes(`>${day}</text>`));
    // Compare the render instructions with ink and font removed. Each theme must be
    // visibly distinct at each function and size, even in the same colour palette.
    const key = `${design.kind}/${size}`;
    const seen = identities.get(key) ?? new Map();
    const monochrome = svg.replace(/#[0-9a-fA-F]{6}/g, '#808080').replace(/font-family="[^"]*"/g, '');
    assert.equal(seen.get(monochrome), undefined, `${key}: ${t.id} repeats ${seen.get(monochrome)}`);
    seen.set(monochrome, t.id);
    identities.set(key, seen);
  }
});
