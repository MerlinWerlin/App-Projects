import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../i18n/locales/en.ts';
import { CATALOGUES, TRANSLATIONS } from '../i18n/locales/index.ts';
import { translate, type Locale } from './i18n.ts';
import { LOOP_NOTES, LOOP_STEPS, LOOP_TEXT, liveLockView, type LoopAvailability, type LoopStatus } from './liveLockView.ts';

const ON: LoopAvailability = { available: true, reason: null };
const idle: LoopStatus = { state: 'idle', prepared: 0, total: 0 };
const st = (over: Partial<LoopStatus>): LoopStatus => ({ ...idle, ...over });

test('checking: nothing decided yet', () => {
  const v = liveLockView({ availability: null, status: idle, projectId: 'a' });
  assert.equal(v.mode, 'checking');
  assert.equal(v.canStart, false);
  assert.equal(v.showStop, false);
});

test('unavailable: the Live Photo way, with the right one-line notice', () => {
  const v = (reason: LoopAvailability['reason']) => liveLockView({ availability: { available: false, reason }, status: idle, projectId: 'a' });
  assert.equal(v('ios-version').mode, 'live-photo');
  assert.equal(v('ios-version').fallback, 'needs-ios26');
  assert.equal(v('not-built').fallback, 'not-built');
  assert.equal(v('expo-go').fallback, null); // the guide has its own Expo Go notice
  assert.equal(v('android').fallback, null);
  for (const r of ['ios-version', 'not-built', 'expo-go', 'android'] as const) {
    assert.equal(v(r).canStart, false);
    assert.equal(v(r).showStop, false);
    assert.deepEqual(v(r).steps, []);
  }
});

test('ready: Start when there is a loop; honest notes always visible', () => {
  const v = liveLockView({ availability: ON, status: idle, projectId: 'a' });
  assert.equal(v.mode, 'loop');
  assert.equal(v.phase, 'ready');
  assert.equal(v.canStart, true);
  assert.equal(v.showStop, false);
  assert.deepEqual(v.notes, [...LOOP_NOTES]);
  assert.deepEqual(v.notes, ['ios', 'controls', 'stops', 'still', 'battery']);
  assert.equal(liveLockView({ availability: ON, status: idle, projectId: null }).canStart, false);
});

test('preparing: progress and Stop (cancel), no Start', () => {
  const v = liveLockView({ availability: ON, status: st({ state: 'preparing', prepared: 0, total: 1 }), projectId: 'a' });
  assert.equal(v.phase, 'preparing');
  assert.deepEqual(v.progress, { done: 0, total: 1 });
  assert.equal(v.showStop, true);
  assert.equal(v.canStart, false);
  // Before the first native event, the app's own "starting" flag shows the same state.
  const w = liveLockView({ availability: ON, status: idle, projectId: 'a', starting: true });
  assert.equal(w.phase, 'preparing');
  assert.equal(w.progress, null);
});

test('playing: three numbered steps and Stop', () => {
  const v = liveLockView({ availability: ON, status: st({ state: 'playing', projectId: 'a', artwork: 'animated-3x4' }), projectId: 'a' });
  assert.equal(v.phase, 'playing');
  assert.deepEqual(v.steps, ['lock', 'wake', 'tap']);
  assert.deepEqual(v.steps, [...LOOP_STEPS]);
  assert.equal(v.showStop, true);
  assert.equal(v.canStart, false);
  assert.equal(v.notice, null);
  assert.equal(v.runningOther, false);
});

test('static artwork: the honest still-picture message', () => {
  const v = liveLockView({ availability: ON, status: st({ state: 'playing', projectId: 'a', artwork: 'static' }), projectId: 'a' });
  assert.equal(v.notice, 'static-artwork');
  // Older native builds send no artwork field: no claim either way.
  assert.equal(liveLockView({ availability: ON, status: st({ state: 'playing', projectId: 'a' }), projectId: 'a' }).notice, null);
});

test('paused by another app or a call vs. from the Lock Screen', () => {
  const a = liveLockView({ availability: ON, status: st({ state: 'paused', reason: 'interrupted', projectId: 'a' }), projectId: 'a' });
  assert.equal(a.notice, 'interrupted');
  assert.equal(a.showStop, true);
  const b = liveLockView({ availability: ON, status: st({ state: 'paused', projectId: 'a' }), projectId: 'a' });
  assert.equal(b.notice, 'paused');
});

test('another loop running: show it with Stop and offer this one instead', () => {
  const v = liveLockView({ availability: ON, status: st({ state: 'playing', projectId: 'b' }), projectId: 'a' });
  assert.equal(v.runningOther, true);
  assert.equal(v.canStart, true);
  assert.equal(v.showStop, true);
  // The tab with no loops still shows the running state and Stop.
  const t = liveLockView({ availability: ON, status: st({ state: 'playing', projectId: 'b' }), projectId: null });
  assert.equal(t.runningOther, false);
  assert.equal(t.showStop, true);
});

test('errors and stops: Low Power Mode, failures, user stop', () => {
  const lp = liveLockView({ availability: ON, status: st({ state: 'error', reason: 'low-power' }), projectId: 'a' });
  assert.equal(lp.notice, 'low-power');
  assert.equal(lp.canStart, true);
  assert.equal(liveLockView({ availability: ON, status: st({ state: 'error', reason: 'export failed' }), projectId: 'a' }).notice, 'failed');
  assert.equal(liveLockView({ availability: ON, status: st({ state: 'stopped', reason: 'low-power' }), projectId: 'a' }).notice, 'low-power');
  assert.equal(liveLockView({ availability: ON, status: st({ state: 'stopped', reason: 'user' }), projectId: 'a' }).notice, null);
  assert.equal(liveLockView({ availability: ON, status: st({ state: 'stopped', reason: 'media-reset' }), projectId: 'a' }).notice, 'stopped');
});

test('copy is honest and every catalogue has it (non-English translated)', () => {
  assert.match(LOOP_TEXT.start, /^Start on Lock Screen$/);
  assert.match(LOOP_TEXT.stepLock, /Lock your iPhone/);
  assert.match(LOOP_TEXT.stepWake, /full screen behind the clock/);
  assert.match(LOOP_TEXT.stepTap, /small player, tap the artwork/);
  assert.match(LOOP_TEXT.staticArtwork, /still picture instead of the moving loop/);
  assert.match(LOOP_TEXT.noteIos, /iOS 26/);
  assert.match(LOOP_TEXT.noteControls, /playback controls/);
  assert.match(LOOP_TEXT.noteStops, /another app plays sound or a call/);
  assert.match(LOOP_TEXT.noteStill, /Low Power Mode, Reduce Motion or Auto-Play Animated Images/);
  assert.match(LOOP_TEXT.noteBattery, /battery/);
  assert.match(LOOP_TEXT.needsIos26, /Live Photo/);
  assert.match(LOOP_TEXT.needsIos26, /not in a constant loop/);
  assert.match(LOOP_TEXT.notBuilt, /not in a constant loop/);
  const g = (en as unknown as { liveUi: { loop: Record<string, string> } }).liveUi.loop;
  for (const [k, v] of Object.entries(LOOP_TEXT)) assert.equal(g[k], v, `liveUi.loop.${k}`);
  assert.deepEqual(Object.keys(g).sort(), Object.keys(LOOP_TEXT).sort());
  for (const l of Object.keys(TRANSLATIONS) as Locale[]) {
    for (const k of ['intro', 'start', 'stepLock', 'stepWake', 'stepTap', 'staticArtwork', 'noteStill', 'needsIos26']) {
      assert.notEqual(translate(CATALOGUES, l, `liveUi.loop.${k}`), g[k], `${l} liveUi.loop.${k} is English`);
    }
  }
});
