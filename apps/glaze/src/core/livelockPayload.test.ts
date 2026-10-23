import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEVICES, DEFAULT_DEVICE, MAX_LOOP_MS, lockAspect, newProject, type LoopProject } from './loop.ts';
import {
  LIVELOCK_PAYLOAD_VERSION,
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

test('builds a versioned payload with the device export settings', () => {
  const r = buildLivelockPayload([project('a')], DEFAULT_DEVICE);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.payload.version, LIVELOCK_PAYLOAD_VERSION);
  assert.equal(r.payload.export.width, DEFAULT_DEVICE.pixels.width);
  assert.equal(r.payload.export.height, DEFAULT_DEVICE.pixels.height);
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

test('crop rect is inside the source, even-sized and at the Lock Screen aspect', () => {
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
      ]) {
        const r = buildLivelockPayload([project('a', { crop, sourceWidth: w, sourceHeight: h })], device);
        assert.ok(r.ok);
        if (!r.ok) continue;
        const rect = r.payload.projects[0].cropRect;
        assert.ok(rect.x >= 0 && rect.y >= 0);
        assert.ok(rect.x + rect.width <= w && rect.y + rect.height <= h);
        assert.equal(rect.width % 2, 0);
        assert.equal(rect.height % 2, 0);
        // Within the 2 px even-rounding of cropRect.
        assert.ok(Math.abs(rect.width - rect.height * lockAspect(device)) <= 2);
      }
    }
  }
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
