// T146 (fb-1025 A): widget link check verdicts (src/core/widgetLink.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_WIDGET_LINK,
  WIDGET_LAST_READ_KEY,
  normaliseWidgetLinkStatus,
  parseWidgetLastRead,
  widgetLinkVerdict,
  widgetLinkVisible,
  type WidgetLinkStatus,
} from './widgetLink.ts';
import { serializeWidgetTheme, widgetThemeFrom } from './widgetTheme.ts';
import { THEMES } from './themes.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const APPLIED = '2026-10-25T11:59:50.000Z';
const theme = THEMES[0];
const stored = serializeWidgetTheme(widgetThemeFrom(theme, new Date(APPLIED)));
const read = (at: string, themeId: string, source = 'defaults') => JSON.stringify({ at, themeId, source });

function status(over: Partial<WidgetLinkStatus> = {}): WidgetLinkStatus {
  return {
    available: true,
    supported: true,
    containerOk: true,
    themeStored: true,
    lastRead: read('2026-10-25T11:59:52.000Z', theme.id),
    storedTheme: stored,
    ...over,
  };
}

test('key name matches the Swift extension and the bridge', () => {
  assert.equal(WIDGET_LAST_READ_KEY, 'glaze.widget.lastRead.v1');
});

test('parseWidgetLastRead accepts the extension JSON and rejects junk', () => {
  assert.deepEqual(parseWidgetLastRead(read(APPLIED, 'dusk', 'file')), { at: APPLIED, themeId: 'dusk', source: 'file' });
  assert.deepEqual(parseWidgetLastRead({ at: APPLIED, themeId: ' dusk ', source: 'fallback' }), { at: APPLIED, themeId: 'dusk', source: 'fallback' });
  for (const bad of ['', '   ', 'not json', '[]', 'null', 42, null, undefined]) assert.equal(parseWidgetLastRead(bad), null, String(bad));
  assert.equal(parseWidgetLastRead(read('yesterday-ish', 'dusk')), null, 'bad date');
  assert.equal(parseWidgetLastRead(read(APPLIED, '')), null, 'empty theme id');
  assert.equal(parseWidgetLastRead(read(APPLIED, 'dusk', 'cache')), null, 'unknown source');
});

test('normaliseWidgetLinkStatus keeps only well-typed fields', () => {
  assert.deepEqual(normaliseWidgetLinkStatus({ containerOk: true, themeStored: 'yes', lastRead: 5, storedTheme: '{}' }), {
    available: true,
    supported: true,
    containerOk: true,
    themeStored: false,
    lastRead: '',
    storedTheme: '{}',
  });
  assert.deepEqual(normaliseWidgetLinkStatus(null), { ...NO_WIDGET_LINK, available: true, supported: true });
  assert.deepEqual(normaliseWidgetLinkStatus([1]), { ...NO_WIDGET_LINK, available: true, supported: true });
});

test('Expo Go / Android / missing module: expoGo, and an older bridge: unknown; neither is shown', () => {
  assert.equal(widgetLinkVerdict(NO_WIDGET_LINK, theme.id, NOW), 'expoGo');
  assert.equal(widgetLinkVerdict({ ...NO_WIDGET_LINK, available: true }, theme.id, NOW), 'unknown');
  assert.equal(widgetLinkVisible('expoGo'), false);
  assert.equal(widgetLinkVisible('unknown'), false);
  assert.equal(widgetLinkVisible(null), false);
  for (const v of ['ok', 'noAppGroup', 'notReadYet', 'stale', 'wrongTheme'] as const) assert.equal(widgetLinkVisible(v), true, v);
});

test('no App Group container on the app side: noAppGroup, whatever else is reported', () => {
  assert.equal(widgetLinkVerdict(status({ containerOk: false }), theme.id, NOW), 'noAppGroup');
  assert.equal(widgetLinkVerdict(status({ containerOk: false, lastRead: '' }), null, NOW), 'noAppGroup');
});

test('no read the app can see yet: notReadYet', () => {
  assert.equal(widgetLinkVerdict(status({ lastRead: '' }), theme.id, NOW), 'notReadYet');
  assert.equal(widgetLinkVerdict(status({ lastRead: 'garbage' }), theme.id, NOW), 'notReadYet');
});

test('widgets read the stored theme after the apply: ok (expected id or the stored id)', () => {
  assert.equal(widgetLinkVerdict(status(), theme.id, NOW), 'ok');
  assert.equal(widgetLinkVerdict(status(), null, NOW), 'ok');
  assert.equal(widgetLinkVerdict(status({ lastRead: read('2026-10-25T11:59:55.000Z', theme.id, 'file') }), null, NOW), 'ok');
  // A read a moment before the apply timestamp (clock rounding) still counts.
  assert.equal(widgetLinkVerdict(status({ lastRead: read('2026-10-25T11:59:49.000Z', theme.id) }), null, NOW), 'ok');
});

test('owner symptom: widgets draw the fallback after the app stored a theme -> noAppGroup', () => {
  const fb = read('2026-10-25T11:59:55.000Z', 'glaze', 'fallback');
  assert.equal(widgetLinkVerdict(status({ lastRead: fb }), theme.id, NOW), 'noAppGroup');
  assert.equal(widgetLinkVerdict(status({ lastRead: fb, storedTheme: '' }), theme.id, NOW), 'noAppGroup');
});

test('fallback read before the apply is only stale; fallback with nothing stored is fine', () => {
  const early = read('2026-10-25T11:00:00.000Z', 'glaze', 'fallback');
  assert.equal(widgetLinkVerdict(status({ lastRead: early }), theme.id, NOW), 'stale');
  const fb = read('2026-10-25T11:59:55.000Z', 'glaze', 'fallback');
  assert.equal(widgetLinkVerdict(status({ lastRead: fb, themeStored: false, storedTheme: '' }), null, NOW), 'ok');
  assert.equal(widgetLinkVerdict(status({ lastRead: fb, themeStored: false, storedTheme: '' }), theme.id, NOW), 'wrongTheme');
});

test('last read before the latest apply: stale', () => {
  const old = read('2026-10-25T10:00:00.000Z', 'some-old-theme');
  assert.equal(widgetLinkVerdict(status({ lastRead: old }), theme.id, NOW), 'stale');
});

test('read after the apply but a different theme: wrongTheme', () => {
  const other = read('2026-10-25T11:59:55.000Z', 'not-' + theme.id);
  assert.equal(widgetLinkVerdict(status({ lastRead: other }), null, NOW), 'wrongTheme');
  assert.equal(widgetLinkVerdict(status(), 'not-' + theme.id, NOW), 'wrongTheme');
});

test('an apply time in the future (clock moved back) is ignored instead of reading as stale', () => {
  const future = serializeWidgetTheme(widgetThemeFrom(theme, new Date('2026-10-26T12:00:00.000Z')));
  assert.equal(widgetLinkVerdict(status({ storedTheme: future }), null, NOW), 'ok');
});

test('stored theme without a usable timestamp: decided on theme id alone', () => {
  const noTime = JSON.stringify({ v: 1, themeId: theme.id });
  assert.equal(widgetLinkVerdict(status({ storedTheme: noTime, lastRead: read('2020-01-01T00:00:00.000Z', theme.id) }), null, NOW), 'ok');
  assert.equal(widgetLinkVerdict(status({ storedTheme: 'not json', lastRead: read('2020-01-01T00:00:00.000Z', theme.id) }), theme.id, NOW), 'ok');
  assert.equal(widgetLinkVerdict(status({ storedTheme: 'not json' }), null, NOW), 'ok');
});
