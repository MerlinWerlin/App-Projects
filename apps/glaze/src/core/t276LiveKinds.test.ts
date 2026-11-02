// T276 (owner-1102a A4): every practical widget piece really works in the native widget. Pins the
// contract per live kind end to end: the spec the app builds (liveArt.ts) -> the record saved in
// widget-art/index.json (widgetArtLibrary.ts) -> what LiveArtOverlay.swift decodes and how the
// timeline refreshes (live time per minute, date/countdown entry AT midnight, battery every 15 min
// with monitoring on, focus via an AppIntent and a self-counting timer). Swift can't be compiled
// here, so these are source guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOCUS_MINUTES, LIVE_ART_KINDS, liveArtPlan, liveArtSpec, parseLiveArtSpec, type LiveArtKind, type LiveArtSpec } from './liveArt.ts';
import { addPiece, emptyLibrary, parseLibrary, serializeLibrary } from './widgetArtLibrary.ts';
import type { WidgetOption } from './widgetOptions.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"])\/\/.*$/gm, '$1');
const overlay = () => strip(read('targets/widget/LiveArtOverlay.swift'));

const opt = (id: string, kind: WidgetOption['kind'], extra: Partial<WidgetOption> = {}): WidgetOption => ({
  id,
  kind,
  image: 'a.webp',
  sizes: ['small', 'medium', 'large'],
  fit: 'fit',
  background: 'blur',
  label: id,
  width: 1024,
  height: 1024,
  derived: false,
  numberFree: true,
  ...extra,
});

/** One spec per live kind, with every optional field the app can write. */
function specs(): Record<LiveArtKind, LiveArtSpec> {
  const out = {} as Record<LiveArtKind, LiveArtSpec>;
  const frame = (clockStyle?: 'analog' | 'digital' | 'stacked') => ({
    rect: [0.2, 0.2, 0.6, 0.6] as [number, number, number, number],
    shape: 'circle' as const,
    ink: '#EEECE3',
    ...(clockStyle ? { clockStyle } : {}),
  });
  const kinds: Record<LiveArtKind, WidgetOption['kind']> = { clock: 'clock', date: 'calendar', countdown: 'countdown', battery: 'battery', focus: 'focus' };
  for (const kind of LIVE_ART_KINDS) {
    const option = opt(`p-${kind}`, kinds[kind], { liveFrame: frame(kind === 'clock' ? 'stacked' : undefined) });
    const plan = liveArtPlan('t276', option, { countdownTo: '2026-12-25' });
    assert.ok(plan, kind);
    assert.equal(plan.kind, kind);
    const spec = liveArtSpec(plan, { w: 1024, h: 1024 }, { w: 364, h: 170 }, 'bleed', { bg: '#102030', ink: '#F0E0D0' });
    assert.ok(spec, kind);
    out[kind] = spec;
  }
  return out;
}

test('every live kind gets a spec, survives index.json, and Swift decodes every key TS writes', () => {
  const all = specs();
  const src = overlay();
  // Swift case names = the TS kinds.
  assert.match(src, /enum Kind: String \{\s*case clock, date, countdown, battery, focus\s*\}/);
  // Keys LiveArtOverlay.swift deliberately ignores: `art` (Fit plate of the raw art, the native Fit
  // path uses the composed image) and `minutes` (FocusStore.minutes, pinned below).
  const unused = new Set(['art', 'minutes']);
  for (const [kind, spec] of Object.entries(all)) {
    // Through the library record (the exact JSON the widget reads).
    const { lib } = addPiece(emptyLibrary(), { id: `t-x-${kind}`, name: 'n', themeName: 't', themeId: 't276', source: 'theme', created: 1, aspect: 2, size: 'medium', live: spec });
    const json = JSON.parse(serializeLibrary(lib)) as { pieces: { live?: Record<string, unknown> }[] };
    const live = json.pieces[0].live;
    assert.ok(live, kind);
    assert.deepEqual(parseLibrary(serializeLibrary(lib)).pieces[0].live, parseLiveArtSpec(spec));
    for (const key of Object.keys(live)) {
      if (unused.has(key)) continue;
      assert.match(src, new RegExp(`r\\["${key}"\\]`), `LiveArtOverlay.swift must decode "${key}" (${kind})`);
    }
  }
  // The new art-clock fields reach the record.
  assert.equal(all.clock.clockStyle, 'stacked');
  assert.equal(all.clock.cleanFace, true);
  assert.equal(all.clock.ink, '#EEECE3');
  assert.equal(all.countdown.target, '2026-12-25');
  assert.equal(all.focus.minutes, FOCUS_MINUTES);
  // Swift knows the same clock styles as TS, and an unknown / missing one is the legacy layout.
  for (const s of ['analog', 'digital', 'stacked']) assert.match(src, new RegExp(`case "${s}":`));
  assert.match(src, /\["analog", "digital", "stacked"\]\.contains/);
  assert.match(src, /: "legacy"/);
  assert.match(src, /if !spec\.cleanFace \{ plate \}/);
});

test('clock (legacy, analog, digital, stacked): live time from the entry date, one entry per minute', () => {
  const src = overlay();
  assert.match(src, /case \.clock:\s*let minuteStart = cal\.dateInterval\(of: \.minute, for: now\)/);
  assert.match(src, /for i in 1\.\.\.60 \{\s*dates\.append\(minuteStart\.addingTimeInterval\(Double\(i\) \* 60\)\)/);
  assert.match(src, /return \(dates, \.atEnd\)/);
  // Every style draws from `date` (the timeline entry), never a fixed value.
  assert.match(src, /LiveClockHands\(date: date, ink: ink\)/);
  assert.match(src, /Text\(date, style: \.time\)/);
  assert.match(src, /Calendar\.current\.component\(\.hour, from: date\)/);
  assert.match(src, /Calendar\.current\.component\(\.minute, from: date\)/);
});

test('date / calendar and countdown: the timeline has an entry AT the next midnight', () => {
  const src = overlay();
  assert.match(src, /case \.date, \.countdown:[\s\S]*?let tomorrow = cal\.date\(byAdding: \.day, value: 1, to: cal\.startOfDay\(for: now\)\)[\s\S]*?return \(\[now, tomorrow\], \.atEnd\)/);
  assert.match(src, /date\.formatted\(\.dateTime\.day\(\)\)/);
  // Countdown counts from the entry's day to the stored target (same rule as countdownArtDays).
  assert.match(src, /cal\.dateComponents\(\[\.day\], from: cal\.startOfDay\(for: date\), to: target\)/);
  // The catalogue Date widgets (DayProvider) roll over on time too.
  const providers = strip(read('targets/widget/Providers.swift'));
  assert.match(providers, /struct DayProvider[\s\S]*?GlazeEntry\(date: tomorrow, theme: theme\)/);
});

test('battery: monitoring is enabled before the level is read, -1 is a dash, refresh every 15 min', () => {
  const src = overlay();
  const on = src.indexOf('UIDevice.current.isBatteryMonitoringEnabled = true');
  const level = src.indexOf('UIDevice.current.batteryLevel');
  assert.ok(on > 0 && level > on, 'monitoring on before batteryLevel');
  assert.match(src, /guard level >= 0, level <= 1 else \{ return nil \}/);
  assert.match(src, /case \.battery:\s*return \(\[now\], \.after\(now\.addingTimeInterval\(15 \* 60\)\)\)/);
  assert.match(src, /Text\(verbatim: "–"\)/);
});

test('focus: Start / Pause AppIntent, App Group state, self-counting timer, paused shows remaining', () => {
  const src = overlay();
  const intents = strip(read('targets/widget/FocusIntents.swift'));
  assert.match(src, /struct LiveFocusButton: View/);
  assert.match(src, /case \.focus:\s*LiveFocusButton\(date: date, theme: theme, s: s\)/);
  assert.match(src, /Button\(intent: ToggleFocusIntent\(\)\)/);
  assert.match(src, /Text\(timerInterval: min\(date, end\)\.\.\.end, countsDown: true\)/);
  assert.match(src, /case \.paused\(let remaining\):\s*Text\(verbatim: FocusStore\.clock\(remaining\)\)/);
  assert.match(src, /case \.running\(let end\):\s*return \(\[now, end\], \.atEnd\)/);
  assert.match(intents, /@available\(iOS 17\.0, \*\)\s*struct ToggleFocusIntent: AppIntent/);
  assert.match(intents, /FocusStore\.toggle\(now: Date\(\)\)/);
  assert.match(intents, /UserDefaults\(suiteName: GlazeShared\.appGroup\)/);
  assert.match(intents, new RegExp(`static let minutes: Double = ${FOCUS_MINUTES}\\b`));
  // The widget kind it reloads is the Seamless widget's.
  assert.match(strip(read('targets/widget/SeamlessWidget.swift')), /let kind = "GlazeSeamless"/);
  assert.match(intents, /reloadTimelines\(ofKind: "GlazeSeamless"\)/);
});

test('countdown without a real target day is never live (no made-up number)', () => {
  const option = opt('c', 'countdown');
  assert.equal(liveArtPlan('t276', option), null);
  assert.equal(liveArtPlan('t276', option, { countdownTo: '2026-02-30' }), null);
  assert.equal(parseLiveArtSpec({ kind: 'countdown', rect: [0, 0, 1, 1], shape: 'plate', cover: false, plate: '#000000', ink: '#FFFFFF' }), null);
  assert.match(overlay(), /if kind == \.countdown \{\s*guard let day = r\["target"\] as\? String, let d = LiveArtSpec\.day\(day\) else \{ return nil \}/);
});
