// T153 (owner brief 25 Oct 21:29, run 120): build the Live Photo in the shape iPhone's Live
// Photo wallpapers need, per docs/LIVEPHOTO.md "Wallpaper recipe (run 120)". Source guards only:
// the Swift cannot be compiled here and nothing here is tested on a device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_DEVICE, DEVICES, newProject } from './loop.ts';
import {
  LIVE_PHOTO_CODEC,
  LIVE_PHOTO_FPS,
  LIVE_PHOTO_MAX_MS,
  LIVE_PHOTO_MIN_MS,
  LIVE_PHOTO_STILL_MIN_MS,
  LIVE_PHOTO_WALLPAPER_SIZE,
  buildLivePhotoPayload,
  fillCrop,
  validateLivePhotoPayload,
} from './livephoto.ts';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const swift = read('modules/glaze-livephoto/ios/GlazeLivePhotoModule.swift');

const project = (over: Record<string, unknown> = {}) => ({
  ...newProject({
    id: 'p1', sourceUri: 'file:///clip.mov', kind: 'video', sourceDurationMs: 20_000,
    sourceWidth: 1920, sourceHeight: 1080, now: 1,
  }),
  ...over,
});

test('T153: JS constants match the recipe (1080 x 1920, 30 fps, HEVC, 1 to 3 s, still >= 0.5 s)', () => {
  assert.deepEqual({ ...LIVE_PHOTO_WALLPAPER_SIZE }, { width: 1080, height: 1920 });
  assert.equal(LIVE_PHOTO_FPS, 30);
  assert.equal(LIVE_PHOTO_CODEC, 'hevc');
  assert.equal(LIVE_PHOTO_MAX_MS, 3000);
  assert.equal(LIVE_PHOTO_MIN_MS, 1000);
  assert.equal(LIVE_PHOTO_STILL_MIN_MS, 500);
});

test('T153: payloads are 1080 x 1920 with a 9:16 crop, even from a landscape source', () => {
  for (const d of DEVICES) {
    for (const crop of [undefined, { scale: 2, offsetX: 1, offsetY: -1 }, { scale: 1.3, offsetX: -1, offsetY: 1 }]) {
      const r = buildLivePhotoPayload(project(crop ? { crop } : {}) as never, d);
      assert.ok(r.ok, d.id);
      if (!r.ok) continue;
      const p = r.payload;
      assert.equal(p.width, 1080);
      assert.equal(p.height, 1920);
      assert.ok(Math.abs(p.crop.width / p.crop.height - 9 / 16) < 0.01, `${d.id} crop ${JSON.stringify(p.crop)}`);
      assert.ok(p.crop.x >= 0 && p.crop.y >= 0);
      assert.ok(p.crop.x + p.crop.width <= p.source.width && p.crop.y + p.crop.height <= p.source.height);
      assert.ok(p.stillTimeMs >= LIVE_PHOTO_STILL_MIN_MS && p.stillTimeMs <= p.durationMs);
      assert.ok(p.durationMs >= LIVE_PHOTO_MIN_MS && p.durationMs <= LIVE_PHOTO_MAX_MS);
      assert.deepEqual(validateLivePhotoPayload(p), [], d.id);
    }
  }
});

test('T153: fillCrop keeps the centre and stays inside the source', () => {
  const src = { width: 1000, height: 1000 };
  assert.deepEqual(fillCrop({ x: 0, y: 0, width: 1000, height: 1000 }, src, 0.5), { x: 250, y: 0, width: 500, height: 1000 });
  const tall = fillCrop({ x: 0, y: 0, width: 400, height: 1000 }, src, 0.5);
  assert.deepEqual(tall, { x: 0, y: 100, width: 400, height: 800 });
});

test('T153: clips under 1 s are refused, and the validator rejects a still at 0 s or a long side over 1920', () => {
  assert.deepEqual(
    buildLivePhotoPayload(project({ trim: { startMs: 0, endMs: 900 } }) as never, DEFAULT_DEVICE),
    { ok: false, error: 'too-short' },
  );
  const r = buildLivePhotoPayload(project() as never, DEFAULT_DEVICE);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(validateLivePhotoPayload({ ...r.payload, stillTimeMs: 0 }).some((e) => e.includes('at least 500')));
  assert.ok(validateLivePhotoPayload({ ...r.payload, width: 1440, height: 2560 }).some((e) => e.includes('1920')));
});

test('T153: the Swift export writes the wallpaper recipe with its sources', () => {
  // Size and frame rate.
  assert.match(swift, /wallpaperWidth = 1080/);
  assert.match(swift, /wallpaperHeight = 1920/);
  assert.match(swift, /wallpaperFps: Int32 = 30/);
  assert.match(swift, /p\.withSize\(width: wallpaperWidth, height: wallpaperHeight/);
  // HEVC, Main profile, no frame reordering, key frame every second.
  assert.match(swift, /AVVideoCodecType\.hevc/);
  assert.match(swift, /kVTProfileLevel_HEVC_Main_AutoLevel/);
  assert.match(swift, /AVVideoAllowFrameReorderingKey\] = false/);
  assert.match(swift, /AVVideoMaxKeyFrameIntervalKey\] = Int\(fpsValue\)/);
  // HEIC still with the MakerApple identifier, JPEG fallback.
  assert.match(swift, /UTType\.heic/);
  assert.match(swift, /\["17":\s*identifier\]/);
  // still-image-time -1 in the 600 timescale, with the identity still-image-transform.
  assert.match(swift, /static let wallpaper = Recipe\(name: "wallpaper", hevc: true, heic: true, stillValue: -1,/);
  assert.match(swift, /metadataTimescale: Int32 = 600/);
  assert.match(swift, /metadataInput\.mediaTimeScale = metadataTimescale/);
  assert.match(swift, /"com\.apple\.quicktime\.live-photo-still-image-transform"/);
  assert.match(swift, /kCMMetadataBaseDataType_AffineTransformF64/);
  assert.match(swift, /NSValue\(cgAffineTransform: \.identity\)/);
  // Key photo: a frame of the video, never before 0.5 s.
  assert.match(swift, /stillEarliest = CMTime\(value: 300, timescale: 600\)/);
  assert.match(swift, /static func keyPhotoTime/);
  // The metadata track references the video (cdsc).
  assert.match(swift, /AssociationType\.metadataReferent/);
  assert.match(swift, /addTrackAssociation\(withTrackOf: videoInput/);
  // Fallbacks keep saving working; the T127 recipe stays last.
  assert.match(swift, /\[Recipe\.wallpaper, Recipe\.wallpaperNoTransform, Recipe\.legacy\]/);
  // Every recipe item names its source.
  for (const src of [
    'https://github.com/Yuyang16Z/LivePaper/blob/main/docs/FINDINGS.md',
    'https://github.com/deepratna-awale/open-wallpaper-engine-mac/pull/288',
    'https://forums.macrumors.com/threads/ios-17-live-photos-motion-not-available-lock-screen.2403161/page-3',
  ]) assert.ok(swift.includes(src), src);
  // Honest about the one missing piece.
  assert.match(swift, /NOT DONE: the per-frame mdta\/com\.apple\.quicktime\.live-photo-info track/);
  assert.doesNotMatch(swift, /UIBackgroundModes/);
});

test('T153: docs carry the recipe table, stay "not verified on a device" and promise no loop', () => {
  const doc = read('docs/LIVEPHOTO.md');
  assert.match(doc, /## Wallpaper recipe \(run 120\)/);
  for (const item of ['1080 x 1920', 'HEVC', 'still-image-time', 'live-photo-still-image-transform', 'live-photo-info', 'vitality-score', '600']) {
    assert.ok(doc.includes(item), `LIVEPHOTO.md mentions ${item}`);
  }
  assert.match(doc, /not verified on a device/i);
  assert.doesNotMatch(doc, /loops forever|looping wallpaper that/i);
  const lic = read('docs/LICENSES.md');
  assert.match(lic, /LivePaper/);
});
