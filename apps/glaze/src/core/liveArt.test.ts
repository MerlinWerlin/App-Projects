// T237 (owner-1101g #2): widgets that look functional must work. Theme art of a clock, date,
// battery, countdown or focus timer gets the real value drawn over it by the Seamless widget; the
// focus piece is interactive; everything else is labelled Art.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_BADGE_RECT,
  FOCUS_MINUTES,
  KNOWN_LIVE_PIECES,
  LIVE_ART_KINDS,
  liveArtKindOf,
  liveArtPlan,
  liveArtSpec,
  parseLiveArtSpec,
  validTargetDay,
  withLiveArt,
} from './liveArt.ts';
import { addPiece, emptyLibrary, parseLibrary, serializeLibrary } from './widgetArtLibrary.ts';
import { WIDGET_OPTION_KINDS, fixedValues, placeArt, shelfKind, showsLiveBadge, widgetShelf, type WidgetOption } from './widgetOptions.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"])\/\/.*$/gm, '$1');

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
  ...extra,
});

/** Every widget option of the production packs (docs/widget_snapshots/index.json, run 208). */
function productionOptions(): { theme: string; option: WidgetOption }[] {
  const idx = JSON.parse(read('docs/widget_snapshots/index.json')) as { themes: { id: string; options: { id: string; kind: WidgetOption['kind'] }[] }[] };
  return idx.themes.flatMap((t) => t.options.map((o) => ({ theme: t.id, option: opt(o.id, o.kind) })));
}

test('audit: every production piece is either live (real value drawn) or Art', () => {
  const all = productionOptions();
  assert.ok(all.length >= 50);
  const live: Record<string, string> = {};
  for (const { theme, option } of all) {
    const plan = liveArtPlan(theme, option);
    if (plan) live[`${theme}/${option.id}`] = plan.kind;
    const [shown] = withLiveArt(theme, [option]);
    // A live piece shows "Live"; one with painted values that is not live is shown as Art; plain art is Art.
    if (plan) {
      assert.equal(showsLiveBadge(shown), true, option.id);
      assert.equal(fixedValues(shown), false, option.id);
    } else if (option.kind !== 'photo' && option.kind !== 'quote') {
      assert.equal(shelfKind(shown), 'art', `${theme}/${option.id} is not live, so it must be Art`);
      assert.equal(showsLiveBadge(shown), false, option.id);
    }
  }
  // Owner's two examples, plus dates and the battery. Countdowns need a target day; habits stay Art.
  assert.deepEqual(live, {
    'alpine-starlight/constellation-clock': 'clock',
    'cloud-atelier/cloud-date': 'date',
    'indigo-current/harbour-focus': 'focus',
    'meadowglow/meadow-date': 'date',
    'opal-abyss/abyss-battery': 'battery',
    'rainlight/rainlight-date': 'date',
  });
  // Every known piece exists in the production packs.
  const ids = new Set(all.map((x) => `${x.theme}/${x.option.id}`));
  for (const key of Object.keys(KNOWN_LIVE_PIECES)) assert.ok(ids.has(key), key);
});

test('harbour focus (listed as art) becomes a focus piece; constellation clock a live clock', () => {
  const [focus] = withLiveArt('indigo-current', [opt('harbour-focus', 'art')]);
  assert.equal(focus.kind, 'focus');
  assert.equal(focus.liveArt, true);
  assert.equal(shelfKind(focus), 'focus');
  const shelf = widgetShelf([focus, opt('ink-whale', 'art')], 'small');
  assert.equal(shelf[0].group, 'practical');
  const [clock] = withLiveArt('alpine-starlight', [opt('constellation-clock', 'clock')]);
  assert.equal(clock.liveArt, true);
  assert.equal(shelfKind(clock), 'clock');
  // The same id in another theme is not a known piece.
  assert.equal(liveArtPlan('other-theme', opt('constellation-clock', 'clock')), null);
});

test('countdown is live only with a real target day', () => {
  const o = opt('dune-countdown', 'countdown');
  assert.equal(liveArtPlan('desert-afterglow', o), null);
  assert.equal(liveArtPlan('desert-afterglow', o, { countdownTo: '2026-02-30' }), null);
  const plan = liveArtPlan('desert-afterglow', o, { countdownTo: '2026-12-25' });
  assert.equal(plan?.kind, 'countdown');
  assert.equal(plan?.target, '2026-12-25');
  assert.equal(validTargetDay('2028-02-29'), '2028-02-29');
  assert.equal(validTargetDay('2027-02-29'), null);
});

test('number-free pieces of a live kind get a badge; habits / photo / quote / art never do', () => {
  for (const kind of WIDGET_OPTION_KINDS) {
    const plan = liveArtPlan('some-theme', opt('x', kind, { numberFree: true }), { countdownTo: '2030-01-01' });
    const lk = liveArtKindOf(kind);
    assert.equal(plan?.kind ?? null, lk, kind);
    if (plan) {
      assert.equal(plan.cover, false);
      assert.deepEqual(plan.rect, DEFAULT_BADGE_RECT);
    }
    // Painted values in an unknown place: Art, never a doubled number.
    assert.equal(liveArtPlan('some-theme', opt('x', kind)), null, kind);
  }
  assert.deepEqual([...LIVE_ART_KINDS].sort(), ['battery', 'clock', 'countdown', 'date', 'focus']);
});

test('spec rect maps the art rect into the composed image (placeArt geometry), inside 0..1', () => {
  const plan = liveArtPlan('indigo-current', opt('harbour-focus', 'art'))!;
  for (const composed of [{ w: 510, h: 510 }, { w: 1092, h: 510 }, { w: 1092, h: 1146 }]) {
    const spec = liveArtSpec(plan, { w: 1024, h: 1024 }, composed, 'fit', { bg: '#0b1a3a', ink: '#f4efe6' })!;
    const place = placeArt({ w: 1024, h: 1024 }, composed, 'fit').rect;
    const [x, y, w, h] = spec.rect;
    assert.ok(Math.abs(x * composed.w - (place.x + 0.24 * place.w)) < 1);
    assert.ok(Math.abs(y * composed.h - (place.y + 0.19 * place.h)) < 1);
    assert.ok(Math.abs(w * composed.w - 0.5 * place.w) < 1);
    assert.ok(x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1);
    assert.equal(spec.kind, 'focus');
    assert.equal(spec.minutes, FOCUS_MINUTES);
    assert.equal(spec.plate, '#0B1A3A');
    assert.equal(spec.cover, true);
    assert.deepEqual(parseLiveArtSpec(JSON.parse(JSON.stringify(spec))), spec);
  }
  assert.equal(liveArtSpec(plan, { w: 1024, h: 1024 }, { w: 0, h: 0 }, 'fit', { bg: '#000000', ink: '#ffffff' }), null);
});

test('parseLiveArtSpec is tolerant: broken specs are dropped', () => {
  const ok = { kind: 'clock', rect: [0.1, 0.1, 0.5, 0.5], shape: 'circle', cover: true, plate: '#000000', ink: '#FFFFFF' };
  assert.ok(parseLiveArtSpec(ok));
  for (const bad of [null, [], 'x', { ...ok, kind: 'habits' }, { ...ok, rect: [0.1, 0.1, 0.5] }, { ...ok, rect: [0.8, 0, 0.5, 0.5] }, { ...ok, rect: [0, 0, 0, 0.5] }, { ...ok, kind: 'countdown' }]) {
    assert.equal(parseLiveArtSpec(bad), null, JSON.stringify(bad));
  }
  assert.equal(parseLiveArtSpec({ ...ok, plate: 'red' })?.plate, '#000000');
});

test('widget-art index keeps a valid `live` spec and stays backward compatible', () => {
  const live = { kind: 'date', rect: [0.1, 0.1, 0.6, 0.5], shape: 'plate', cover: true, plate: '#112233', ink: '#FFFFFF' } as const;
  const base = { id: 't-cloud-atelier-cloud-date-small', name: 'Cloud date', themeName: 'Cloud Atelier', themeId: 'cloud-atelier', source: 'theme' as const, created: 5, aspect: 1, size: 'small' as const };
  const lib = addPiece(emptyLibrary(), { ...base, live: { ...live, rect: [...live.rect] as [number, number, number, number] } }).lib;
  const back = parseLibrary(serializeLibrary(lib));
  assert.equal(back.pieces[0].live?.kind, 'date');
  // Old records (no live) and broken live values read as plain art.
  const old = parseLibrary(JSON.stringify({ v: 1, pieces: [{ ...base }, { ...base, id: 'b', live: { kind: 'nope' } }] }));
  assert.equal(old.pieces.length, 2);
  assert.ok(old.pieces.every((p) => p.live === undefined));
  assert.ok(!('live' in old.pieces[0]));
});

test('Swift guards: interactive focus, live timer, battery guard, no fake numbers', () => {
  const overlay = strip(read('targets/widget/LiveArtOverlay.swift'));
  const focus = strip(read('targets/widget/FocusIntents.swift'));
  assert.match(overlay, /Button\(intent: ToggleFocusIntent\(\)\)/);
  assert.match(overlay, /Text\(timerInterval:/);
  assert.match(overlay, /Text\(date, style: \.time\)/);
  assert.match(overlay, /isBatteryMonitoringEnabled = true/);
  assert.match(overlay, /guard level >= 0/);
  assert.match(overlay, /@available\(iOS 17\.0, \*\)\s*struct LiveArtLayer/);
  // No value is hard-coded: digits only come from the date, the store or the battery.
  assert.doesNotMatch(overlay, /"\d+%"|"\d{1,2}:\d{2}"|"\d+ ?(days|DAYS)"/);
  assert.match(focus, /struct ToggleFocusIntent: AppIntent/);
  assert.match(focus, /@available\(iOS 17\.0, \*\)\s*struct ToggleFocusIntent/);
  assert.match(focus, /UserDefaults\(suiteName: GlazeShared\.appGroup\)/);
  assert.match(focus, /reloadTimelines\(ofKind: "GlazeSeamless"\)/);
  assert.match(focus, new RegExp(`static let minutes: Double = ${FOCUS_MINUTES}\\b`));
  assert.doesNotMatch(focus, /ActivityKit|Activity</);
  // Wired into the Seamless widget and its timeline.
  const seamless = strip(read('targets/widget/SeamlessWidget.swift'));
  assert.match(seamless, /LiveArtLayer\(pieceID: pieceID, imageSize: image\.size, theme: t, date: date\)/);
  assert.match(seamless, /SeamlessWidgetView\(theme: entry\.theme, pieceID: entry\.pieceID, (layout: entry\.layout, )?date: entry\.date/);
  assert.match(strip(read('targets/widget/WidgetArtLibrary.swift')), /LiveArtSchedule\.plan\(pieceID:/);
});

test('app: the menu labels every non-live card "Art" and saves the live spec with the piece', () => {
  const menu = strip(read('src/ui/WidgetArtMenu.tsx'));
  assert.match(menu, /tabs\.widgetsTab\.art\.artBadge/);
  const art = strip(read('src/ui/ThemeWidgetArt.tsx'));
  assert.match(art, /withLiveArt\(theme\.id/);
  assert.match(art, /liveArtSpec\(plan/);
  assert.match(art, /\.\.\.\(live \? \{ live \} : \{\}\)/);
});
