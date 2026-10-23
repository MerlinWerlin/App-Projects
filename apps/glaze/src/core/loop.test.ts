import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DEVICE,
  DEVICES,
  LOCK_SAFE_AREAS,
  MAX_LOOP_MS,
  MIN_TRIM_MS,
  addToPlaylist,
  applyPan,
  clampCrop,
  clampTrim,
  cropDisplayLayout,
  cropRect,
  deviceForScreen,
  exportSettings,
  formatSeconds,
  lockAspect,
  loopDurationMs,
  maxTrimMs,
  movePlaylistItem,
  msAtX,
  newProject,
  nextLoopName,
  nextPlaylistIndex,
  parseLoopsState,
  playlistDurationMs,
  removeFromPlaylist,
  sanitizeProject,
  serializeLoopsState,
  xAtMs,
} from './loop.ts';
import type { Crop, LoopProject } from './loop.ts';

const PORTRAIT = 1206 / 2622;

// --- trim -------------------------------------------------------------------

test('clampTrim keeps a valid range unchanged', () => {
  assert.deepEqual(clampTrim({ startMs: 1000, endMs: 4000 }, 20_000), { startMs: 1000, endMs: 4000 });
});

test('clampTrim caps length at 15 s', () => {
  assert.deepEqual(clampTrim({ startMs: 0, endMs: 60_000 }, 60_000), { startMs: 0, endMs: MAX_LOOP_MS });
  // moving the end handle keeps the end and pulls the start along
  assert.deepEqual(clampTrim({ startMs: 0, endMs: 30_000 }, 60_000, { anchor: 'end' }), { startMs: 15_000, endMs: 30_000 });
});

test('clampTrim enforces the 0.5 s minimum', () => {
  assert.deepEqual(clampTrim({ startMs: 2000, endMs: 2100 }, 10_000), { startMs: 2000, endMs: 2500 });
  assert.deepEqual(clampTrim({ startMs: 2000, endMs: 2100 }, 10_000, { anchor: 'end' }), { startMs: 1600, endMs: 2100 });
  // start handle dragged to the very end leaves room for the minimum
  assert.deepEqual(clampTrim({ startMs: 10_000, endMs: 10_000 }, 10_000), { startMs: 9500, endMs: 10_000 });
});

test('clampTrim stays inside the source', () => {
  assert.deepEqual(clampTrim({ startMs: -500, endMs: 99_000 }, 8000), { startMs: 0, endMs: 8000 });
  assert.deepEqual(clampTrim({ startMs: 0, endMs: 100 }, 8000, { anchor: 'end' }), { startMs: 0, endMs: MIN_TRIM_MS });
});

test('clampTrim handles tiny, unknown and junk durations', () => {
  assert.deepEqual(clampTrim({ startMs: 100, endMs: 200 }, 300), { startMs: 0, endMs: 300 });
  assert.deepEqual(clampTrim({ startMs: 100, endMs: 200 }, 0), { startMs: 0, endMs: 0 });
  assert.deepEqual(clampTrim({ startMs: Number.NaN, endMs: Number.NaN }, 5000), { startMs: 0, endMs: 5000 });
});

test('speed limits the source length so the loop stays within 15 s', () => {
  assert.equal(maxTrimMs(0.5), 7500);
  assert.equal(maxTrimMs(1), 15_000);
  assert.equal(maxTrimMs(1.5), 15_000);
  const t = clampTrim({ startMs: 0, endMs: 20_000 }, 30_000, { speed: 0.5 });
  assert.deepEqual(t, { startMs: 0, endMs: 7500 });
  assert.equal(loopDurationMs(t, 0.5), 15_000);
  assert.equal(loopDurationMs({ startMs: 0, endMs: 15_000 }, 1.5), 10_000);
});

test('track position helpers round-trip', () => {
  assert.equal(msAtX(150, 300, 10_000), 5000);
  assert.equal(msAtX(-20, 300, 10_000), 0);
  assert.equal(msAtX(999, 300, 10_000), 10_000);
  assert.equal(xAtMs(5000, 300, 10_000), 150);
  assert.equal(msAtX(10, 0, 10_000), 0);
  assert.equal(xAtMs(10, 300, 0), 0);
});

test('formatSeconds', () => {
  assert.equal(formatSeconds(15_000), '15 s');
  assert.equal(formatSeconds(4500), '4.5 s');
  assert.equal(formatSeconds(-1), '0 s');
});

test('formatSeconds puts the number into a translated unit', () => {
  assert.equal(formatSeconds(4500, (v) => `${v}秒`), '4.5秒');
  assert.equal(formatSeconds(4449, (v) => `${v} ث`), '4.4 ث');
  assert.equal(formatSeconds(15_000, (v) => `${v.toLocaleString('de')} s`), '15 s');
  assert.equal(formatSeconds(4500, (v) => `${v.toLocaleString('de')} s`), '4,5 s');
  assert.equal(formatSeconds(-1, (v) => `[${v}]`), '[0]');
});

// --- crop -------------------------------------------------------------------

function inside(r: { x: number; y: number; width: number; height: number }, w: number, h: number) {
  assert.ok(r.x >= 0 && r.y >= 0, `origin ${r.x},${r.y}`);
  assert.ok(r.x + r.width <= w, `x overflow ${r.x}+${r.width} > ${w}`);
  assert.ok(r.y + r.height <= h, `y overflow ${r.y}+${r.height} > ${h}`);
  assert.ok(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.width) && Number.isInteger(r.height));
}

test('cropRect centres a full-height portrait crop on a landscape video', () => {
  const r = cropRect({ width: 1920, height: 1080 }, PORTRAIT, { scale: 1, offsetX: 0, offsetY: 0 });
  assert.equal(r.height, 1080);
  assert.ok(Math.abs(r.width / r.height - PORTRAIT) < 0.01);
  assert.equal(r.width % 2, 0);
  assert.ok(Math.abs(r.x - (1920 - r.width) / 2) <= 1);
  assert.equal(r.y, 0);
  inside(r, 1920, 1080);
});

test('cropRect offsets reach the edges', () => {
  const left = cropRect({ width: 1920, height: 1080 }, PORTRAIT, { scale: 1, offsetX: -1, offsetY: 0 });
  const right = cropRect({ width: 1920, height: 1080 }, PORTRAIT, { scale: 1, offsetX: 1, offsetY: 0 });
  assert.equal(left.x, 0);
  assert.equal(right.x + right.width, 1920);
});

test('cropRect on a portrait source wider than the screen aspect uses full height', () => {
  const r = cropRect({ width: 1080, height: 1920 }, PORTRAIT, { scale: 1, offsetX: 0, offsetY: 0 });
  assert.equal(r.height, 1920);
  inside(r, 1080, 1920);
});

test('cropRect on a very tall source uses full width', () => {
  const r = cropRect({ width: 600, height: 2000 }, PORTRAIT, { scale: 1, offsetX: 0, offsetY: 1 });
  assert.equal(r.width, 600);
  assert.equal(r.y + r.height, 2000);
  inside(r, 600, 2000);
});

test('cropRect zoom shrinks the rect and stays inside for every offset', () => {
  for (const scale of [1, 1.7, 2, 4, 9]) {
    for (const ox of [-1, -0.3, 0, 0.5, 1, 7]) {
      for (const oy of [-1, 0, 1, -4]) {
        const r = cropRect({ width: 1280, height: 720 }, PORTRAIT, { scale, offsetX: ox, offsetY: oy });
        inside(r, 1280, 720);
      }
    }
  }
  const z = cropRect({ width: 1280, height: 720 }, PORTRAIT, { scale: 2, offsetX: 0, offsetY: 0 });
  assert.equal(z.height, 360);
});

test('cropRect survives degenerate sources', () => {
  inside(cropRect({ width: 1, height: 1 }, PORTRAIT, { scale: 3, offsetX: 1, offsetY: 1 }), 1, 1);
  inside(cropRect({ width: 0, height: Number.NaN }, PORTRAIT, { scale: 1, offsetX: 0, offsetY: 0 }), 1, 1);
});

test('clampCrop limits scale and offsets and fixes junk', () => {
  assert.deepEqual(clampCrop({ scale: 0.2, offsetX: -3, offsetY: 3 }), { scale: 1, offsetX: -1, offsetY: 1 });
  assert.deepEqual(clampCrop({ scale: 10 }), { scale: 4, offsetX: 0, offsetY: 0 });
  assert.deepEqual(clampCrop(null), { scale: 1, offsetX: 0, offsetY: 0 });
  assert.deepEqual(clampCrop({ scale: Number.NaN, offsetX: Infinity }), { scale: 1, offsetX: 0, offsetY: 0 });
});

test('applyPan moves the crop opposite to the finger and clamps', () => {
  const src = { width: 1920, height: 1080 };
  const c0: Crop = { scale: 1, offsetX: 0, offsetY: 0 };
  const right = applyPan(c0, 50, 0, src, PORTRAIT, 200);
  assert.ok(right.offsetX < 0, 'drag right shows more of the left');
  assert.equal(right.offsetY, 0, 'no vertical room at scale 1');
  const far = applyPan(c0, -10_000, 0, src, PORTRAIT, 200);
  assert.equal(far.offsetX, 1);
  // zoomed in, vertical panning works
  const zoomed = applyPan({ scale: 2, offsetX: 0, offsetY: 0 }, 0, 40, src, PORTRAIT, 200);
  assert.ok(zoomed.offsetY < 0);
  assert.deepEqual(applyPan(c0, 10, 10, src, PORTRAIT, 0), c0);
});

test('cropDisplayLayout shows exactly the crop rect in the frame', () => {
  const src = { width: 1920, height: 1080 };
  const crop: Crop = { scale: 1.5, offsetX: 0.4, offsetY: -0.2 };
  const frameW = 240;
  const r = cropRect(src, PORTRAIT, crop);
  const l = cropDisplayLayout(src, PORTRAIT, crop, frameW);
  const k = l.width / src.width;
  assert.ok(Math.abs(l.height / src.height - k) < 1e-9, 'uniform scale');
  assert.ok(Math.abs(-l.left / k - r.x) <= 2, 'left edge matches');
  assert.ok(Math.abs(-l.top / k - r.y) <= 2, 'top edge matches');
  assert.ok(Math.abs(frameW / k - r.width) <= 2, 'width matches');
});

// --- devices / export ------------------------------------------------------

test('device table is portrait, 3x and covers iPhone 12–17 including Pro Max', () => {
  assert.ok(DEVICES.length >= 7);
  for (const d of DEVICES) {
    assert.ok(d.pixels.height > d.pixels.width);
    // Native pixels equal points x scale, except the minis, which downsample (1080 x 2340).
    assert.ok(Math.abs(d.pixels.width / (d.points.width * d.scale) - 1) < 0.05, d.name);
    assert.ok(Math.abs(d.pixels.height / (d.points.height * d.scale) - 1) < 0.05, d.name);
  }
  const names = DEVICES.map((d) => d.name).join(' | ');
  for (const n of ['iPhone 12', '13 Pro Max', '14 Pro', '15 Pro Max', '16 Pro Max', '17 Pro Max', 'iPhone 17']) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
  assert.equal(new Set(DEVICES.map((d) => d.id)).size, DEVICES.length);
});

test('deviceForScreen picks exact and nearest devices', () => {
  assert.equal(deviceForScreen(440, 956).id, '6.9');
  assert.equal(deviceForScreen(956, 440).id, '6.9');
  assert.equal(deviceForScreen(390, 844).id, '6.1');
  assert.equal(deviceForScreen(393, 852).id, '6.1-di');
  assert.equal(deviceForScreen(376, 815).id, 'mini');
  assert.equal(deviceForScreen(0, 0), DEFAULT_DEVICE);
  assert.ok(Math.abs(lockAspect(DEFAULT_DEVICE) - PORTRAIT) < 1e-9);
});

test('exportSettings: portrait native size, 30 fps, no audio, max 15 s', () => {
  const s = exportSettings(DEFAULT_DEVICE);
  assert.equal(s.width, 1206);
  assert.equal(s.height, 2622);
  assert.equal(s.fps, 30);
  assert.equal(s.codec, 'hevc');
  assert.equal(s.audio, false);
  assert.equal(s.maxDurationMs, 15_000);
  assert.ok(s.bitrate > 1_000_000 && s.bitrate < 20_000_000);
  const h = exportSettings(DEFAULT_DEVICE, { codec: 'h264' });
  assert.equal(h.codec, 'h264');
  assert.ok(h.bitrate > s.bitrate);
});

test('lock safe areas are ordered and on screen', () => {
  const { date, clock, controls } = LOCK_SAFE_AREAS;
  assert.ok(date.top + date.height <= clock.top + 0.01);
  assert.ok(clock.top + clock.height < 1 - controls.bottom - controls.height);
});

// --- projects ---------------------------------------------------------------

test('newProject defaults: first 15 s, centred crop, 1x', () => {
  const p = newProject({ id: 'a', sourceUri: 'file:///v.mov', kind: 'video', sourceDurationMs: 42_000, sourceWidth: 1920, sourceHeight: 1080, now: 5 });
  assert.deepEqual(p.trim, { startMs: 0, endMs: 15_000 });
  assert.deepEqual(p.crop, { scale: 1, offsetX: 0, offsetY: 0 });
  assert.equal(p.speed, 1);
  assert.equal(p.name, 'Loop');
  assert.equal(p.createdAt, 5);
  assert.equal(p.updatedAt, 5);
  const g = newProject({ id: 'g', sourceUri: 'file:///a.gif', kind: 'gif', sourceDurationMs: null, sourceWidth: 400, sourceHeight: 400, name: ' Cat ' });
  assert.deepEqual(g.trim, { startMs: 0, endMs: 0 });
  assert.equal(g.name, 'Cat');
});

test('nextLoopName finds the lowest free number', () => {
  assert.equal(nextLoopName([]), 'Loop 1');
  assert.equal(nextLoopName(['Loop 1', 'loop 2', 'Beach']), 'Loop 3');
  assert.equal(nextLoopName(['Loop 2']), 'Loop 1');
});

test('nextLoopName uses a translated name and skips names already taken', () => {
  const fr = (n: number) => `Boucle ${n}`;
  assert.equal(nextLoopName([], fr), 'Boucle 1');
  assert.equal(nextLoopName(['boucle 1', ' Boucle 2 ', 'Loop 3'], fr), 'Boucle 3');
  assert.equal(nextLoopName(['ループ1'], (n) => `ループ${n}`), 'ループ2');
});

test('sanitizeProject rejects junk and repairs fields', () => {
  assert.equal(sanitizeProject(null), null);
  assert.equal(sanitizeProject({ id: 'x' }), null);
  assert.equal(sanitizeProject({ id: '', sourceUri: 'u' }), null);
  const p = sanitizeProject({ id: 'x', sourceUri: 'u', kind: 'weird', sourceDurationMs: 9000, speed: 3, trim: { startMs: -1, endMs: 99_999 }, crop: { scale: 99 } });
  assert.ok(p);
  assert.equal(p.kind, 'video');
  assert.equal(p.speed, 1);
  assert.deepEqual(p.trim, { startMs: 0, endMs: 9000 });
  assert.equal(p.crop.scale, 4);
});

// --- playlist ---------------------------------------------------------------

test('playlist add/remove/move', () => {
  assert.deepEqual(addToPlaylist(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(addToPlaylist(['a', 'b'], 'a'), ['a', 'b']);
  assert.deepEqual(removeFromPlaylist(['a', 'b', 'c'], 'b'), ['a', 'c']);
  assert.deepEqual(movePlaylistItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(movePlaylistItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(movePlaylistItem(['a', 'b', 'c'], 1, 99), ['a', 'c', 'b']);
  assert.deepEqual(movePlaylistItem(['a', 'b'], 5, 0), ['a', 'b']);
});

test('nextPlaylistIndex wraps', () => {
  assert.equal(nextPlaylistIndex(0, 3), 1);
  assert.equal(nextPlaylistIndex(2, 3), 0);
  assert.equal(nextPlaylistIndex(-1, 3), 0);
  assert.equal(nextPlaylistIndex(0, 0), -1);
  assert.equal(nextPlaylistIndex(0, 1), 0);
});

test('playlistDurationMs sums loop lengths with speed', () => {
  const a = newProject({ id: 'a', sourceUri: 'u', kind: 'video', sourceDurationMs: 6000, sourceWidth: 10, sourceHeight: 10 });
  const b: LoopProject = { ...newProject({ id: 'b', sourceUri: 'u', kind: 'video', sourceDurationMs: 9000, sourceWidth: 10, sourceHeight: 10 }), speed: 1.5 };
  assert.equal(playlistDurationMs([a, b], ['a', 'b', 'missing']), 6000 + 6000);
});

// --- persistence -------------------------------------------------------------

test('loops state round-trips and tolerates corrupt data', () => {
  const a = newProject({ id: 'a', sourceUri: 'u', kind: 'video', sourceDurationMs: 6000, sourceWidth: 10, sourceHeight: 10, now: 1 });
  const json = serializeLoopsState({ projects: [a], playlist: ['a'] });
  assert.equal(JSON.parse(json).version, 1);
  assert.deepEqual(parseLoopsState(json), { projects: [a], playlist: ['a'] });
  const empty = { projects: [], playlist: [] };
  assert.deepEqual(parseLoopsState(null), empty);
  assert.deepEqual(parseLoopsState('{not json'), empty);
  assert.deepEqual(parseLoopsState('42'), empty);
  assert.deepEqual(parseLoopsState(JSON.stringify({ version: 99, projects: [a] })), empty);
  const messy = JSON.stringify({ version: 1, projects: [a, a, { junk: true }, 7], playlist: ['a', 'a', 'gone', 3] });
  assert.deepEqual(parseLoopsState(messy), { projects: [a], playlist: ['a'] });
});
