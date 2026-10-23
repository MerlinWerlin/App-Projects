import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES } from './themes.ts';
import {
  DEFAULT_WIDGET_THEME,
  parseWidgetTheme,
  serializeWidgetTheme,
  widgetThemeFrom,
  type WidgetTheme,
} from './widgetTheme.ts';

const HEX = /^#[0-9A-F]{6}$/;
const NOW = new Date('2026-10-12T09:30:00.000Z');

test('widgetThemeFrom: every starter theme produces a valid widget theme', () => {
  for (const theme of THEMES) {
    const w = widgetThemeFrom(theme, NOW);
    assert.equal(w.v, 1);
    assert.equal(w.themeId, theme.id);
    assert.equal(w.name, theme.name);
    assert.ok(w.bg.length >= 1 && w.bg.length <= 2, theme.id);
    for (const c of [...w.bg, w.surface, w.accent, w.ink]) assert.match(c, HEX, `${theme.id}: ${c}`);
    assert.equal(w.style, theme.widget.style);
    assert.equal(w.font, theme.widget.font);
    assert.equal(w.accent, theme.widget.accent.toUpperCase());
    assert.equal(w.updatedAt, NOW.toISOString());
  }
});

test('serialize -> parse round-trips', () => {
  for (const theme of THEMES) {
    const w = widgetThemeFrom(theme, NOW);
    const json = serializeWidgetTheme(w);
    assert.deepEqual(parseWidgetTheme(json), w);
  }
});

test('serialize uses a stable key order', () => {
  const json = serializeWidgetTheme(widgetThemeFrom(THEMES[0], NOW));
  assert.deepEqual(Object.keys(JSON.parse(json)), [
    'v', 'themeId', 'name', 'bg', 'surface', 'accent', 'ink', 'style', 'font', 'updatedAt',
  ]);
});

test('parseWidgetTheme: rejects non-objects, bad JSON and unknown versions', () => {
  assert.equal(parseWidgetTheme('not json'), null);
  assert.equal(parseWidgetTheme('[1,2]'), null);
  assert.equal(parseWidgetTheme(null), null);
  assert.equal(parseWidgetTheme(42), null);
  assert.equal(parseWidgetTheme({ v: 2 }), null);
});

test('parseWidgetTheme: empty object falls back to defaults', () => {
  assert.deepEqual(parseWidgetTheme({}), DEFAULT_WIDGET_THEME);
  assert.deepEqual(parseWidgetTheme('{}'), DEFAULT_WIDGET_THEME);
});

test('parseWidgetTheme: validates and normalises hex colours', () => {
  const w = parseWidgetTheme({
    v: 1,
    bg: ['#abc', 'nope', '#123456', '#654321'],
    surface: 'red',
    accent: '#e0794f',
    ink: 7,
  }) as WidgetTheme;
  assert.deepEqual(w.bg, ['#AABBCC', '#123456']);
  assert.equal(w.surface, DEFAULT_WIDGET_THEME.surface);
  assert.equal(w.accent, '#E0794F');
  assert.equal(w.ink, DEFAULT_WIDGET_THEME.ink);
});

test('parseWidgetTheme: single bg string and all-invalid bg', () => {
  assert.deepEqual(parseWidgetTheme({ bg: '#000' })?.bg, ['#000000']);
  assert.deepEqual(parseWidgetTheme({ bg: ['x', 1] })?.bg, DEFAULT_WIDGET_THEME.bg);
});

test('parseWidgetTheme: unknown style/font/updatedAt fall back', () => {
  const w = parseWidgetTheme({ style: 'neon', font: 'comic', updatedAt: 'yesterday', name: '  ' }) as WidgetTheme;
  assert.equal(w.style, DEFAULT_WIDGET_THEME.style);
  assert.equal(w.font, DEFAULT_WIDGET_THEME.font);
  assert.equal(w.updatedAt, DEFAULT_WIDGET_THEME.updatedAt);
  assert.equal(w.name, DEFAULT_WIDGET_THEME.name);
  const ok = parseWidgetTheme({ style: 'outline', font: 'body' }) as WidgetTheme;
  assert.equal(ok.style, 'outline');
  assert.equal(ok.font, 'body');
});

test('widgetThemeFrom: bg gets a second stop only when surface differs', () => {
  const base = THEMES[0];
  const same = { ...base, palette: { ...base.palette, surface: base.palette.bg } };
  assert.equal(widgetThemeFrom(same, NOW).bg.length, 1);
  const broken = { ...base, palette: { ...base.palette, bg: 'zzz' }, widget: { ...base.widget, accent: 'oops' } };
  const w = widgetThemeFrom(broken, NOW);
  assert.equal(w.bg[0], DEFAULT_WIDGET_THEME.bg[0]);
  assert.equal(w.accent, base.palette.accent.toUpperCase());
});
