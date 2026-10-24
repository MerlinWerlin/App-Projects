import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEVICES, DEFAULT_DEVICE, MAX_LOOP_MS, cropRect, lockAspect, newProject, type LoopProject } from './loop.ts';
import {
  ARTWORK_EXPORT_HEIGHT,
  ARTWORK_EXPORT_WIDTH,
  LIVELOCK_PAYLOAD_VERSION,
  artworkCropRect,
  artworkExport,
  isThreeByFour,
  MAX_LIVELOCK_PROJECTS,
  buildLivelockPayload,
  isLocalSourceUri,
  parseLivelockPayload,
} from './livelockPayload.ts';

function project(id: string, over: Partial<LoopProject> = {}): LoopProject {
  return {
    ...newProject({
      id,
      sourceUri: `file:///var/mobile/Containers/Data/tmp/${id}.mov`,
      kind: 'video',
      sourceDurationMs: 20_000,
      sourceWidth: 1080,
      sourceHeight: 1920,
      now: 1,
    }),
    ...over,
  };
}

test('builds a versioned payload with the 3:4 animated artwork export (T135)', () => {
  const r = buildLivelockPayload([project('a')], DEFAULT_DEVICE);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.payload.version, LIVELOCK_PAYLOAD_VERSION);
  // Never the screen size: Apple ignores animated artwork whose aspect doesn't match the key.
  assert.equal(r.payload.export.width, 1080);
  assert.equal(r.payload.export.height, 1440);
  assert.equal(r.payload.export.width * 4, r.payload.export.height * 3);
  for (const d of DEVICES) {
    const rd = buildLivelockPayload([project('a')], d);
    assert.ok(rd.ok && rd.payload.export.width === ARTWORK_EXPORT_WIDTH && rd.payload.export.height === ARTWORK_EXPORT_HEIGHT, d.id);
  }
  assert.equal(r.payload.export.fps, 30);
  assert.equal(r.payload.export.codec, 'hevc');
  assert.equal(r.payload.export.maxDurationMs, MAX_LOOP_MS);
  assert.ok(r.payload.export.bitrate > 0);
  assert.equal(r.payload.projects.length, 1);
  assert.deepEqual(JSON.parse(r.json), r.payload);
});

test('h264 codec option is passed through', () => {
  const r = buildLivelockPayload([project('a')], DEFAULT_DEVICE, { codec: 'h264' });
  assert.ok(r.ok && r.payload.export.codec === 'h264');
});

test('crop rect is inside the source, even-sized, exactly 3:4 and covers the user crop (T135)', () => {
  for (const device of DEVICES) {
    for (const crop of [
      { scale: 1, offsetX: 0, offsetY: 0 },
      { scale: 2.5, offsetX: 1, offsetY: -1 },
      { scale: 4, offsetX: -0.3, offsetY: 0.7 },
    ]) {
      for (const [w, h] of [
        [1920, 1080],
        [1080, 1920],
        [640, 640],
        [3840, 2160],
        [721, 1279],
      ]) {
        const r = buildLivelockPayload([project('a', { crop, sourceWidth: w, sourceHeight: h })], device);
        assert.ok(r.ok);
        if (!r.ok) continue;
        const rect = r.payload.projects[0].cropRect;
        assert.ok(rect.x >= 0 && rect.y >= 0);
        assert.ok(rect.x + rect.width <= w && rect.y + rect.height <= h);
        assert.equal(rect.width % 2, 0);
        assert.equal(rect.height % 2, 0);
        assert.ok(isThreeByFour(rect.width, rect.height), `${rect.width}x${rect.height} is 3:4`);
        const user = cropRect({ width: w, height: h }, lockAspect(device), crop);
        // Covers the user's height whenever a 3:4 rect that tall fits in the source.
        if (user.height * 0.75 <= w && user.height <= h) assert.ok(rect.height >= user.height, `${w}x${h} ${device.id}`);
        // Otherwise it is the largest 3:4 rect that fits (within one 6x8 step).
        else assert.ok(rect.width > w - 6 || rect.height > h - 8);
      }
    }
  }
});

test('artworkCropRect keeps the user crop centre and clamps inside the source', () => {
  const src = { width: 3840, height: 2160 };
  // Small user crop in the middle: same centre, covers its height.
  const user = { x: 1800, y: 900, width: 200, height: 400 };
  const r = artworkCropRect(src, user);
  assert.ok(isThreeByFour(r.width, r.height));
  assert.ok(r.height >= 400 && r.height < 408);
  assert.ok(Math.abs(r.x + r.width / 2 - 1900) <= 1);
  assert.ok(Math.abs(r.y + r.height / 2 - 1100) <= 1);
  // Crop at the left edge: moved right just enough to stay inside.
  const edge = artworkCropRect(src, { x: 0, y: 0, width: 994, height: 2160 });
  assert.deepEqual(edge, { x: 0, y: 0, width: 1620, height: 2160 });
  // Portrait 1080x1920 at full frame: the largest 3:4 is 1080x1440, centred.
  assert.deepEqual(artworkCropRect({ width: 1080, height: 1920 }, { x: 98, y: 0, width: 884, height: 1920 }), {
    x: 0,
    y: 240,
    width: 1080,
    height: 1440,
  });
  // Bad input falls back to the whole source; tiny sources don't crash.
  assert.ok(isThreeByFour(artworkCropRect(src, { x: NaN, y: 0, width: 0, height: 0 }).width, 2160));
  assert.deepEqual(artworkCropRect({ width: 4, height: 4 }, { x: 0, y: 0, width: 4, height: 4 }), { x: 0, y: 0, width: 4, height: 4 });
});

test('artworkExport: 1080x1440, ≤ 60 fps, codec and bitrate', () => {
  const e = artworkExport();
  assert.deepEqual([e.width, e.height, e.codec], [1080, 1440, 'hevc']);
  assert.ok(e.fps > 0 && e.fps <= 60);
  assert.equal(e.maxDurationMs, MAX_LOOP_MS);
  assert.ok(artworkExport('h264').bitrate > e.bitrate);
});

test('trim and speed are sanitised; trim never exceeds the 15 s loop', () => {
  const r = buildLivelockPayload(
    [project('a', { speed: 1.5, trim: { startMs: -100, endMs: 99_000 } })],
    DEFAULT_DEVICE,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  const p = r.payload.projects[0];
  assert.equal(p.speed, 1.5);
  assert.ok(p.trim.startMs >= 0);
  assert.ok(p.trim.endMs <= 20_000);
  assert.ok((p.trim.endMs - p.trim.startMs) / p.speed <= MAX_LOOP_MS);
});

test('GIFs loop in full: trim is sent as "unknown"', () => {
  const r = buildLivelockPayload([project('g', { kind: 'gif', sourceDurationMs: 0 })], DEFAULT_DEVICE);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.payload.projects[0].trim, { startMs: 0, endMs: 0 });
  assert.equal(r.payload.projects[0].kind, 'gif');
});

test('skips invalid, remote and duplicate projects, keeping playlist order', () => {
  const r = buildLivelockPayload(
    [
      project('b'),
      { nope: true },
      project('remote', { sourceUri: 'https://example.com/x.mov' }),
      project('photos', { sourceUri: 'ph://ABC' }),
      project('a'),
      project('b'),
    ],
    DEFAULT_DEVICE,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(
    r.payload.projects.map((p) => p.id),
    ['b', 'a'],
  );
  assert.deepEqual(r.skipped, ['?', 'remote', 'photos', 'b']);
});

test('empty and all-invalid inputs fail without throwing', () => {
  assert.deepEqual(buildLivelockPayload([], DEFAULT_DEVICE), { ok: false, error: 'empty', skipped: [] });
  const r = buildLivelockPayload([project('x', { sourceUri: 'https://e.com/a.mov' })], DEFAULT_DEVICE);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'no-valid-projects');
});

test('caps the playlist length', () => {
  const many = Array.from({ length: MAX_LIVELOCK_PROJECTS + 3 }, (_, i) => project(`p${i}`));
  const r = buildLivelockPayload(many, DEFAULT_DEVICE);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.payload.projects.length, MAX_LIVELOCK_PROJECTS);
  assert.equal(r.skipped.length, 3);
});

test('parseLivelockPayload accepts built payloads and rejects malformed ones', () => {
  const r = buildLivelockPayload([project('a'), project('g', { kind: 'gif' })], DEFAULT_DEVICE);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(parseLivelockPayload(r.json), r.payload);
  assert.equal(parseLivelockPayload('not json'), null);
  assert.equal(parseLivelockPayload('{}'), null);
  const bad = (mut: (o: Record<string, any>) => void) => {
    const o = JSON.parse(r.json);
    mut(o);
    return parseLivelockPayload(JSON.stringify(o));
  };
  assert.equal(bad((o) => (o.version = 2)), null);
  assert.equal(bad((o) => (o.export.codec = 'vp9')), null);
  assert.equal(bad((o) => (o.export.width = 5000)), null); // landscape
  assert.equal(bad((o) => ((o.export.width = 1170), (o.export.height = 2532))), null); // screen aspect, not 3:4
  assert.equal(bad((o) => (o.export.fps = 120)), null);
  assert.equal(bad((o) => (o.projects = [])), null);
  assert.equal(bad((o) => (o.projects[0].sourceUri = 'https://x')), null);
  assert.equal(bad((o) => (o.projects[0].speed = 2)), null);
  assert.equal(bad((o) => (o.projects[0].cropRect.width = 0)), null);
  assert.equal(bad((o) => delete o.projects[0].trim), null);
});

test('isLocalSourceUri', () => {
  assert.ok(isLocalSourceUri('file:///a.mov'));
  assert.ok(isLocalSourceUri('/var/a.mov'));
  assert.ok(!isLocalSourceUri('ph://x'));
  assert.ok(!isLocalSourceUri('http://x'));
  assert.ok(!isLocalSourceUri(''));
  assert.ok(!isLocalSourceUri(3));
});

// Guard: app code reaches the native module only through src/native/livelock.ts
// (requireOptionalNativeModule), never by importing the package, or Expo Go would break.
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test('app and src never import modules/glaze-livelock directly', () => {
  const root = process.cwd();
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))];
  assert.ok(files.length > 0);
  for (const f of files) {
    if (f.endsWith('livelockPayload.test.ts')) continue;
    const src = readFileSync(f, 'utf8');
    const re = /(?:from\s*|import\s*\(\s*|require\(\s*|import\s+)['"]([^'"\n]+)['"]/g;
    for (const m of src.matchAll(re)) {
      assert.ok(!m[1].includes('glaze-livelock'), `${f} imports ${m[1]}`);
    }
  }
});
