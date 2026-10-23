import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  MAX_OPACITY,
  MIN_OPACITY,
  baseSize,
  cameraAutofocus,
  clampOpacity,
  TOUCH_LOCK_HOLD_MS,
  TRACE_COPY,
  gridCaption,
  gridLabel,
  initialTraceState,
  lockToast,
  toastDuration,
  parseDim,
  toCentre,
  traceReducer,
  type TraceState,
} from './traceState.ts';

const s0 = (): TraceState => initialTraceState();

test('initial state: defaults and options', () => {
  assert.deepEqual(s0(), {
    opacity: 0.5,
    locked: false,
    torch: false,
    gridPreset: 'off',
    mirror: false,
    touchLocked: false,
  });
  const s = initialTraceState({ opacity: 3, grid: '4x4' });
  assert.equal(s.opacity, 1);
  assert.equal(s.gridPreset, '4x4');
  assert.equal(initialTraceState({ grid: 'bogus' }).gridPreset, 'off');
});

test('opacity clamps to 0.05..1', () => {
  assert.equal(clampOpacity(0), MIN_OPACITY);
  assert.equal(clampOpacity(-4), MIN_OPACITY);
  assert.equal(clampOpacity(2), MAX_OPACITY);
  assert.equal(clampOpacity(0.3), 0.3);
  assert.equal(clampOpacity(NaN), 0.5);
  assert.equal(clampOpacity(Infinity), 1);
  assert.equal(clampOpacity(-Infinity), 0.05);
  assert.equal(traceReducer(s0(), { type: 'setOpacity', value: 0 }).opacity, 0.05);
  assert.equal(traceReducer(s0(), { type: 'setOpacity', value: 9 }).opacity, 1);
});

test('nudgeOpacity steps without float drift and clamps', () => {
  let s = s0();
  s = traceReducer(s, { type: 'nudgeOpacity', delta: 0.1 });
  s = traceReducer(s, { type: 'nudgeOpacity', delta: 0.2 });
  assert.equal(s.opacity, 0.8);
  s = traceReducer(s, { type: 'nudgeOpacity', delta: 1 });
  assert.equal(s.opacity, 1);
  const same = traceReducer(s, { type: 'nudgeOpacity', delta: 0.1 });
  assert.equal(same, s, 'no change returns the same object');
  assert.equal(traceReducer(s, { type: 'nudgeOpacity', delta: NaN }), s);
});

test('toggle lock / torch / touch-lock', () => {
  let s = traceReducer(s0(), { type: 'toggleLock' });
  assert.equal(s.locked, true);
  s = traceReducer(s, { type: 'toggleLock' });
  assert.equal(s.locked, false);
  s = traceReducer(s, { type: 'toggleTorch' });
  assert.equal(s.torch, true);
  s = traceReducer(s, { type: 'setTorch', value: false });
  assert.equal(s.torch, false);
  s = traceReducer(s, { type: 'toggleTouchLock' });
  assert.equal(s.touchLocked, true);
  s = traceReducer(s, { type: 'setTouchLock', value: false });
  assert.equal(s.touchLocked, false);
  assert.equal(traceReducer(s, { type: 'setLocked', value: false }), s);
});

test('grid cycles off → 3x3 → 4x4 → off', () => {
  let s = s0();
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    s = traceReducer(s, { type: 'cycleGrid' });
    seen.push(s.gridPreset);
  }
  assert.deepEqual(seen, ['3x3', '4x4', 'off', '3x3']);
  assert.equal(traceReducer(s, { type: 'setGrid', value: 'nope' }).gridPreset, 'off');
  assert.equal(gridLabel('off'), 'Grid off');
  assert.equal(gridLabel('3x3'), 'Grid 3×3');
});

test('grid captions are short', () => {
  assert.equal(gridCaption('off'), 'Grid');
  assert.equal(gridCaption('3x3'), '3×3');
  assert.equal(gridCaption('4x4'), '4×4');
});

test('lock toast explains what the lock does', () => {
  assert.match(lockToast(true), /locked in place/i);
  assert.match(lockToast(true), /pinch and drag are off/i);
  assert.match(lockToast(false), /unlocked/i);
  assert.match(lockToast(false), /move it again/i);
});

test('touch lock copy always says how to exit', () => {
  assert.equal(TOUCH_LOCK_HOLD_MS, 1000);
  for (const t of [TRACE_COPY.touchLockIntro, TRACE_COPY.touchLockBanner]) {
    assert.match(t, /press and hold/i);
    assert.match(t, /1 second/);
    assert.match(t, /exit/i);
  }
  assert.match(TRACE_COPY.hint, /Lock/);
  assert.match(TRACE_COPY.hint, /Touch lock/);
});

test('toastDuration scales with length, 1.6 s to 6 s', () => {
  assert.equal(toastDuration('Grid off'), 1600);
  assert.equal(toastDuration(''), 1600);
  assert.equal(toastDuration('x'.repeat(1000)), 6000);
  const lock = toastDuration(lockToast(true));
  assert.ok(lock >= 4000 && lock <= 6000, `lock toast ${lock} ms`);
  assert.ok(toastDuration(lockToast(false)) < lock);
  assert.equal(toastDuration(undefined as unknown as string), 1600);
});

// Regression guard for the "touch lock turns the screen black" report: the camera preview must sit directly under
// the screen root, never inside a wrapper whose accessibility props flip with touch lock (that wrapper gets
// re-created natively and the camera preview is torn down with it).
test('trace screen keeps the camera outside the touch-lock accessibility wrapper', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const src = readFileSync(join(root, 'app', 'trace.tsx'), 'utf8');
  const start = src.indexOf('onLayout={onLayout}>');
  const cam = src.indexOf('<CameraView', start);
  assert.ok(start > 0 && cam > start);
  assert.doesNotMatch(src.slice(start, cam), /<View/, 'CameraView must be a direct child of the root view');
  assert.doesNotMatch(src, /backgroundColor:\s*['"]#000['"][^\n]*touch/i);
});

test('mirror toggles, but not while locked', () => {
  let s = traceReducer(s0(), { type: 'toggleMirror' });
  assert.equal(s.mirror, true);
  s = traceReducer(s, { type: 'toggleLock' });
  assert.equal(traceReducer(s, { type: 'toggleMirror' }), s);
});

test('reset unlocks and turns mirror off, keeps viewing aids', () => {
  let s = s0();
  s = traceReducer(s, { type: 'toggleMirror' });
  s = traceReducer(s, { type: 'toggleLock' });
  s = traceReducer(s, { type: 'toggleTorch' });
  s = traceReducer(s, { type: 'cycleGrid' });
  s = traceReducer(s, { type: 'setOpacity', value: 0.7 });
  const r = traceReducer(s, { type: 'reset' });
  assert.equal(r.locked, false);
  assert.equal(r.mirror, false);
  assert.equal(r.torch, true);
  assert.equal(r.gridPreset, '3x3');
  assert.equal(r.opacity, 0.7);
});

test('reducer never mutates its input', () => {
  const s = Object.freeze(s0());
  for (const a of [
    { type: 'toggleLock' },
    { type: 'toggleTorch' },
    { type: 'cycleGrid' },
    { type: 'toggleMirror' },
    { type: 'toggleTouchLock' },
    { type: 'reset' },
    { type: 'setOpacity', value: 0.2 },
  ] as const) {
    assert.doesNotThrow(() => traceReducer(s, a));
  }
});

test('baseSize fits inside the view with margin, keeping aspect', () => {
  const b = baseSize(2000, 1000, 400, 800);
  assert.ok(Math.abs(b.width - 360) < 1e-9);
  assert.ok(Math.abs(b.height - 180) < 1e-9);
  const t = baseSize(500, 1000, 400, 800, 1);
  assert.ok(Math.abs(t.width - 400) < 1e-9 && Math.abs(t.height - 800) < 1e-9);
  // missing natural size → 1000×1000 square
  const sq = baseSize(NaN, 0, 400, 800);
  assert.ok(Math.abs(sq.width - 360) < 1e-9 && Math.abs(sq.height - 360) < 1e-9);
  assert.deepEqual(baseSize(100, 100, 0, 800), { width: 0, height: 0 });
});

test('toCentre converts top-left coords to view-centre coords', () => {
  assert.deepEqual(toCentre(200, 400, 400, 800), { x: 0, y: 0 });
  assert.deepEqual(toCentre(0, 0, 400, 800), { x: -200, y: -400 });
});

test('parseDim reads positive numeric params', () => {
  assert.equal(parseDim('1024'), 1024);
  assert.equal(parseDim(['640', '1']), 640);
  assert.equal(parseDim(''), undefined);
  assert.equal(parseDim('0'), undefined);
  assert.equal(parseDim('abc'), undefined);
  assert.equal(parseDim(undefined), undefined);
});

// CONVENTIONS: every tracing tool is free; only src/plus may read the Plus entitlement.
test('trace screen and core never import src/plus', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = [
    ...readdirSync(join(root, 'app'))
      .filter((f) => f.startsWith('trace'))
      .map((f) => join(root, 'app', f)),
    ...(readdirSync(join(root, 'src', 'core'), { recursive: true }) as string[]).map((f) =>
      join(root, 'src', 'core', f),
    ),
  ].filter((f) => /\.tsx?$/.test(f));
  assert.ok(files.some((f) => f.endsWith('trace.tsx')));
  for (const f of files) {
    if (!existsSync(f) || f.endsWith('.test.ts')) continue;
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /from\s+['"][^'"]*\/plus(\/|['"])/, `${f} imports src/plus`);
    assert.doesNotMatch(text, /require\(\s*['"][^'"]*\/plus(\/|['"])/, `${f} requires src/plus`);
  }
});

test('T64: cameraAutofocus holds focus only while locked with focus lock on', () => {
  assert.equal(cameraAutofocus(true, true), 'off');
  assert.equal(cameraAutofocus(true, false), 'on');
  assert.equal(cameraAutofocus(false, true), 'on');
  assert.equal(cameraAutofocus(false, false), 'on');
  // Follows the reducer's lock state.
  const locked = traceReducer(s0(), { type: 'toggleLock' });
  assert.equal(cameraAutofocus(locked.locked, true), 'off');
  assert.equal(cameraAutofocus(traceReducer(locked, { type: 'reset' }).locked, true), 'on');
});

test('T64: trace screen passes autofocus from cameraAutofocus to CameraView', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'trace.tsx'), 'utf8');
  const at = src.indexOf('<CameraView');
  assert.ok(at >= 0);
  const cam = src.slice(at, src.indexOf('/>', at));
  assert.match(cam, /autofocus=\{cameraAutofocus\(state\.locked, focusLock\)\}/);
});
