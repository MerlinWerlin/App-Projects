import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_THEMES } from './plusThemes.ts';
import { calendarMonth, DESIGNED_KINDS, designedWidget, designedLiveSpec, parseDesignedWidget } from './designedWidgets.ts';
import { plannedDesignedWidgets, upgradedDesignedLibrary } from './designedWidgetLibrary.ts';
import { parseLiveArtSpec } from './liveArt.ts';
import { minContrast } from './colour.ts';
import { parseLibrary, serializeLibrary } from './widgetArtLibrary.ts';
import { designedWidgetSvg, localeFirstWeekday } from './designedWidgetPreview.ts';

const fixture = JSON.parse(readFileSync(new URL('../../docs/designed-widget-fixtures.json', import.meta.url), 'utf8')) as { catalogueThemes: number; themes: { id: string; designs: ReturnType<typeof designedWidget>[] }[] };

test('every catalogue and bundled theme has three readable, artwork-independent functional designs', () => {
  assert.equal(fixture.catalogueThemes, 141);
  assert.ok(fixture.themes.length >= 141);
  for (const t of fixture.themes) {
    assert.deepEqual(t.designs.map(d => d.kind), [...DESIGNED_KINDS], t.id);
    for (const design of t.designs) {
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
  assert.deepEqual(parseLibrary(serializeLibrary(lib)), lib);
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

test('each preview draws the function at every size, includes six calendar rows, never embeds old art', () => {
  const date = new Date(2026, 7, 31, 22, 48);
  for (const t of fixture.themes) for (const design of t.designs) for (const size of ['small', 'medium', 'large'] as const) {
    const svg = designedWidgetSvg(design, size, { date, battery: 73, locale: 'en-AU' });
    assert.ok(svg.startsWith('<svg'));assert.doesNotMatch(svg, /<image|NaN|undefined/);
    if (design.kind === 'calendar') for (let day = 1; day <= 31; day++) assert.ok(svg.includes(`>${day}</text>`));
  }
});
