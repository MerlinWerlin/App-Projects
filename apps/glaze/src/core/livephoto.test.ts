import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DEVICE, DEVICES, exportSettings, newProject } from './loop.ts';
import type { LoopProject } from './loop.ts';
import {
  LIVE_PHOTO_MAX_MS,
  buildLivePhotoPayload,
  livePhotoTrim,
  validateLivePhotoPayload,
} from './livephoto.ts';

function project(over: Partial<LoopProject> = {}): LoopProject {
  return {
    ...newProject({
      id: 'p1',
      sourceUri: 'file:///clip.mov',
      kind: 'video',
      sourceDurationMs: 20_000,
      sourceWidth: 1080,
      sourceHeight: 1920,
      now: 1,
    }),
    ...over,
  };
}

function build(over: Partial<LoopProject> = {}) {
  const r = buildLivePhotoPayload(project(over), DEFAULT_DEVICE);
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.payload;
}

test('livePhotoTrim keeps the start and cuts to 3 s of output', () => {
  assert.deepEqual(livePhotoTrim({ startMs: 2000, endMs: 12_000 }), { startMs: 2000, endMs: 5000 });
  assert.deepEqual(livePhotoTrim({ startMs: 0, endMs: 1500 }), { startMs: 0, endMs: 1500 });
});

test('livePhotoTrim scales the source window with speed', () => {
  assert.deepEqual(livePhotoTrim({ startMs: 0, endMs: 10_000 }, 1.5), { startMs: 0, endMs: 4500 });
  assert.deepEqual(livePhotoTrim({ startMs: 0, endMs: 10_000 }, 0.5), { startMs: 0, endMs: 1500 });
});

test('payload clip is at most 3 s with the still in the middle', () => {
  const p = build({ trim: { startMs: 1000, endMs: 15_000 } });
  assert.deepEqual(p.trim, { startMs: 1000, endMs: 4000 });
  assert.equal(p.durationMs, LIVE_PHOTO_MAX_MS);
  assert.equal(p.stillTimeMs, 1500);
});

test('short trims keep their length; still time is half the output length', () => {
  const p = build({ trim: { startMs: 0, endMs: 2000 }, speed: 0.5 });
  assert.equal(p.durationMs, 3000);
  assert.deepEqual(p.trim, { startMs: 0, endMs: 1500 });
  const q = build({ trim: { startMs: 0, endMs: 1200 }, speed: 1 });
  assert.equal(q.durationMs, 1200);
  assert.equal(q.stillTimeMs, 600);
});

test('sizes come from exportSettings, rounded to even', () => {
  for (const d of DEVICES) {
    const r = buildLivePhotoPayload(project(), d);
    assert.ok(r.ok);
    if (!r.ok) continue;
    const s = exportSettings(d, { codec: 'h264' });
    assert.ok(s.width - r.payload.width <= 1 && r.payload.width % 2 === 0, d.id);
    assert.ok(s.height - r.payload.height <= 1 && r.payload.height % 2 === 0, d.id);
    assert.equal(r.payload.bitrate, s.bitrate);
    assert.deepEqual(validateLivePhotoPayload(r.payload), [], d.id);
  }
});

test('crop rect stays inside the source', () => {
  const p = build({ crop: { scale: 2, offsetX: 1, offsetY: -1 } });
  assert.ok(p.crop.x + p.crop.width <= p.source.width);
  assert.ok(p.crop.y + p.crop.height <= p.source.height);
  assert.deepEqual(validateLivePhotoPayload(p), []);
});

test('GIFs, missing sources and tiny clips are refused', () => {
  assert.deepEqual(buildLivePhotoPayload(project({ kind: 'gif' }), DEFAULT_DEVICE), { ok: false, error: 'gif' });
  assert.deepEqual(buildLivePhotoPayload(project({ sourceUri: '' }), DEFAULT_DEVICE), { ok: false, error: 'no-source' });
  assert.deepEqual(
    buildLivePhotoPayload(project({ trim: { startMs: 0, endMs: 300 } }), DEFAULT_DEVICE),
    { ok: false, error: 'too-short' },
  );
  assert.deepEqual(
    buildLivePhotoPayload(project({ sourceDurationMs: 0, trim: { startMs: 0, endMs: 0 } }), DEFAULT_DEVICE),
    { ok: false, error: 'too-short' },
  );
});

test('validateLivePhotoPayload catches bad payloads', () => {
  assert.deepEqual(validateLivePhotoPayload(null), ['payload is not an object']);
  const good = build();
  assert.deepEqual(validateLivePhotoPayload(good), []);
  const long = { ...good, trim: { startMs: 0, endMs: 9000 } };
  assert.ok(validateLivePhotoPayload(long).some((e) => e.includes('longer')));
  const odd = { ...good, width: 1179 };
  assert.ok(validateLivePhotoPayload(odd).some((e) => e.includes('even')));
  const outside = { ...good, crop: { ...good.crop, x: good.source.width } };
  assert.ok(validateLivePhotoPayload(outside).some((e) => e.includes('crop')));
  const still = { ...good, stillTimeMs: good.durationMs + 1 };
  assert.ok(validateLivePhotoPayload(still).some((e) => e.includes('stillTimeMs')));
  assert.ok(validateLivePhotoPayload({ ...good, speed: 2 }).some((e) => e.includes('speed')));
});
