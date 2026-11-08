// T275 (owner-1102a A4): kind names of the theme exports (themes 101-146) map to Glaze kinds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWidgetKind, parseWidgetOptions, WIDGET_OPTION_KINDS, type OptionAsset } from './widgetOptions.ts';
import { liveArtPlan, withLiveArt } from './liveArt.ts';

const assets: OptionAsset[] = [{ path: 'a.webp', role: 'widget-art', width: 1024, height: 1024 }];
const base = { id: 'piece', image: 'a.webp', sizes: ['small'], numberFree: true };
const frame = { rect: [0.2, 0.2, 0.6, 0.6], shape: 'circle' };

test('aliases: every export kind name resolves, whatever its case, spaces or hyphens', () => {
  const cases: [string, string, string?][] = [
    ['digitalClock', 'clock', 'digital'],
    ['DigitalClock', 'clock', 'digital'],
    ['digital clock', 'clock', 'digital'],
    ['digital-clock', 'clock', 'digital'],
    ['analogClock', 'clock', 'analog'],
    ['analog clock', 'clock', 'analog'],
    ['analog-clock', 'clock', 'analog'],
    ['Analog_Clock', 'clock', 'analog'],
    ['dateCalendar', 'date'],
    ['date calendar', 'date'],
    ['focusTimer', 'focus'],
    ['focus-timer', 'focus'],
    ['countdown', 'countdown'],
    ['Countdown', 'countdown'],
    ['battery', 'battery'],
    ['BATTERY', 'battery'],
  ];
  for (const [raw, kind, style] of cases) {
    const n = normalizeWidgetKind(raw);
    assert.ok(n, raw);
    assert.equal(n.kind, kind, raw);
    assert.equal(n.clockStyle, style, raw);
  }
  for (const k of WIDGET_OPTION_KINDS) assert.deepEqual(normalizeWidgetKind(k), { kind: k });
});

test('aliases: unknown kinds stay unknown (dropped by the app parser, never a crash)', () => {
  for (const raw of ['stopwatch', 'clocks', '', ' ', 'weather', 42, null, undefined, {}, 'constructor', '__proto__', 'toString']) {
    assert.equal(normalizeWidgetKind(raw), null, String(raw));
  }
  const r = parseWidgetOptions([{ ...base, kind: 'stopwatch' }, { ...base, id: 'ok', kind: 'focusTimer' }], assets);
  assert.equal(r.options.length, 1);
  assert.equal(r.options[0].kind, 'focus');
  assert.match(r.errors[0], /unknown kind stopwatch/);
});

test('aliases: digitalClock / analogClock set the clock style of a frame that has none', () => {
  const d = parseWidgetOptions([{ ...base, kind: 'digitalClock', liveFrame: frame }], assets);
  assert.deepEqual(d.errors, []);
  assert.equal(d.options[0].kind, 'clock');
  assert.equal(d.options[0].liveFrame?.clockStyle, 'digital');
  assert.equal(liveArtPlan('t', d.options[0])?.clockStyle, 'digital');
  const a = parseWidgetOptions([{ ...base, kind: 'analog clock', liveFrame: frame }], assets);
  assert.equal(a.options[0].liveFrame?.clockStyle, 'analog');
  // An explicit style wins over the alias.
  const s = parseWidgetOptions([{ ...base, kind: 'analog-clock', liveFrame: { ...frame, clockStyle: 'stacked' } }], assets);
  assert.equal(s.options[0].liveFrame?.clockStyle, 'stacked');
  // No frame: nothing invented.
  const n = parseWidgetOptions([{ ...base, kind: 'digitalClock' }], assets);
  assert.equal(n.options[0].kind, 'clock');
  assert.equal(n.options[0].liveFrame, undefined);
});

test('aliases: date, focus, countdown and battery pieces go live like their canonical kinds', () => {
  const r = parseWidgetOptions(
    [
      { ...base, id: 'd', kind: 'dateCalendar', liveFrame: { rect: [0.1, 0.1, 0.8, 0.8], shape: 'plate' } },
      { ...base, id: 'f', kind: 'focusTimer' },
      { ...base, id: 'b', kind: 'Battery' },
      { ...base, id: 'c', kind: 'countdown' },
    ],
    assets,
  );
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.options.map((o) => o.kind), ['date', 'focus', 'battery', 'countdown']);
  const live = withLiveArt('t', r.options, { countdownTo: '2026-12-25' });
  assert.ok(live.every((o) => o.liveArt === true));
  assert.equal(liveArtPlan('t', r.options[0])?.kind, 'date');
});
