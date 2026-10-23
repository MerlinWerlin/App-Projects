import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  MAX_RECORD_S,
  describeDuration,
  elapsedSeconds,
  formatClock,
  initialTimelapseState,
  permissionStep,
  showsSheet,
  spedUpSeconds,
  speedUpNote,
  spokenDuration,
  suggestedSpeed,
  timelapseReducer,
  type TimelapseAction,
  type TimelapseState,
} from './timelapse.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (actions: TimelapseAction[], s: TimelapseState = initialTimelapseState()) =>
  actions.reduce(timelapseReducer, s);

test('cap is 10 minutes', () => {
  assert.equal(MAX_RECORD_S, 600);
});

test('happy path: record, stop, review, save', () => {
  let s = run([{ type: 'start', at: 1000 }]);
  assert.equal(s.phase, 'recording');
  assert.equal(s.startedAt, 1000);
  s = run([{ type: 'stop' }], s);
  assert.equal(s.phase, 'stopping');
  s = run([{ type: 'finished', uri: 'file:///clip.mov', at: 1000 + 125_400 }], s);
  assert.equal(s.phase, 'review');
  assert.equal(s.durationS, 125);
  assert.equal(s.uri, 'file:///clip.mov');
  assert.equal(s.hitLimit, false);
  assert.equal(s.startedAt, null);
  assert.ok(showsSheet(s.phase));
  s = run([{ type: 'save' }], s);
  assert.equal(s.phase, 'saving');
  s = run([{ type: 'saved' }], s);
  assert.equal(s.phase, 'saved');
  s = run([{ type: 'discard' }], s);
  assert.deepEqual(s, initialTimelapseState());
});

test('max duration: recordAsync resolves by itself and is marked as hitting the limit', () => {
  const s = run([
    { type: 'start', at: 0 },
    { type: 'finished', uri: 'file:///a.mp4', at: 600_300 },
  ]);
  assert.equal(s.phase, 'review');
  assert.equal(s.durationS, 600);
  assert.equal(s.hitLimit, true);
});

test('duration is clamped to the cap', () => {
  const s = run([
    { type: 'start', at: 0 },
    { type: 'finished', uri: 'x', at: 700_000 },
  ]);
  assert.equal(s.durationS, MAX_RECORD_S);
});

test('no file or failure returns to idle with an error', () => {
  let s = run([{ type: 'start', at: 0 }, { type: 'finished', uri: undefined, at: 5000 }]);
  assert.equal(s.phase, 'idle');
  assert.ok(s.error);
  s = run([{ type: 'start', at: 0 }, { type: 'failed', message: 'boom' }]);
  assert.equal(s.phase, 'idle');
  assert.equal(s.error, 'boom');
  // A new start clears the error.
  s = run([{ type: 'start', at: 10 }], s);
  assert.equal(s.error, null);
});

test('permission denied, then retry and save failure keep the clip', () => {
  let s = run([
    { type: 'start', at: 0 },
    { type: 'finished', uri: 'u', at: 3000 },
    { type: 'save' },
    { type: 'denied', canAskAgain: false },
  ]);
  assert.equal(s.phase, 'denied');
  assert.equal(s.canAskAgain, false);
  assert.equal(s.uri, 'u');
  s = run([{ type: 'save' }, { type: 'saveFailed', message: 'disk' }], s);
  assert.equal(s.phase, 'error');
  assert.equal(s.error, 'disk');
  assert.equal(s.uri, 'u');
  s = run([{ type: 'save' }], s);
  assert.equal(s.phase, 'saving');
});

test('ignores out-of-order actions', () => {
  const idle = initialTimelapseState();
  assert.equal(timelapseReducer(idle, { type: 'stop' }), idle);
  assert.equal(timelapseReducer(idle, { type: 'save' }), idle);
  assert.equal(timelapseReducer(idle, { type: 'saved' }), idle);
  assert.equal(timelapseReducer(idle, { type: 'finished', uri: 'x', at: 1 }), idle);
  const rec = run([{ type: 'start', at: 0 }]);
  assert.equal(timelapseReducer(rec, { type: 'start', at: 5 }), rec);
  assert.equal(timelapseReducer(rec, { type: 'discard' }), rec, 'cannot discard while recording');
  const saving = run([{ type: 'start', at: 0 }, { type: 'finished', uri: 'u', at: 1000 }, { type: 'save' }]);
  assert.equal(timelapseReducer(saving, { type: 'discard' }), saving);
  assert.equal(timelapseReducer(saving, { type: 'save' }), saving);
});

test('elapsedSeconds floors and clamps', () => {
  assert.equal(elapsedSeconds(null, 5000), 0);
  assert.equal(elapsedSeconds(1000, 500), 0);
  assert.equal(elapsedSeconds(0, 1999), 1);
  assert.equal(elapsedSeconds(0, 10_000_000), MAX_RECORD_S);
  assert.equal(elapsedSeconds(0, 90_000, 60), 60);
});

test('clock and duration text', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(9), '0:09');
  assert.equal(formatClock(83), '1:23');
  assert.equal(formatClock(600), '10:00');
  assert.equal(formatClock(-4), '0:00');
  assert.equal(describeDuration(45), '45 s');
  assert.equal(describeDuration(125), '2 min 5 s');
  assert.equal(describeDuration(600), '10 min');
  assert.equal(spokenDuration(1), '1 second');
  assert.equal(spokenDuration(61), '1 minute 1 second');
  assert.equal(spokenDuration(120), '2 minutes');
});

test('speed-up math: a 10 min drawing at 8x is about 75 s', () => {
  assert.equal(suggestedSpeed(30), 1);
  assert.equal(suggestedSpeed(90), 1);
  assert.equal(suggestedSpeed(150), 2);
  assert.equal(suggestedSpeed(300), 4);
  assert.equal(suggestedSpeed(600), 8);
  assert.equal(suggestedSpeed(100_000), 32);
  assert.equal(spedUpSeconds(600, 8), 75);
  assert.equal(spedUpSeconds(0, 8), 0);
  assert.equal(spedUpSeconds(3, 8), 1);
  assert.match(speedUpNote(600), /8×.*10 min.*about 1 min 15 s/);
  assert.match(speedUpNote(20), /normal speed/);
});

test('permission step', () => {
  assert.equal(permissionStep({ granted: true, canAskAgain: false }), 'save');
  assert.equal(permissionStep({ granted: false, canAskAgain: true }), 'ask');
  assert.equal(permissionStep({ granted: false, canAskAgain: false }), 'settings');
  assert.equal(permissionStep(null), 'ask');
});

test('app config: save-only Photos permission, truthful camera copy, no microphone', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.dependencies['expo-media-library'], /^~(18\.2|57)\./, 'SDK 54 or SDK 57 pin');
  assert.match(app.ios.infoPlist.NSPhotoLibraryAddUsageDescription, /Nothing is uploaded/);
  assert.doesNotMatch(app.ios.infoPlist.NSCameraUsageDescription, /Nothing is recorded/);
  assert.doesNotMatch(JSON.stringify(app), /Nothing is recorded/);
  const ml = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-media-library');
  assert.ok(ml, 'expo-media-library config plugin missing');
  assert.match(ml[1].savePhotosPermission, /Nothing is uploaded/);
  assert.ok(!(app.android.permissions as string[]).includes('android.permission.RECORD_AUDIO'));
  const trace = readFileSync(join(root, 'app', 'trace.tsx'), 'utf8');
  assert.doesNotMatch(trace, /Nothing is recorded/);
  assert.match(trace, /\bmute\b/, 'CameraView must be muted so no microphone permission is needed');
});
