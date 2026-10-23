// Outline pipeline with fake platform deps (no React Native / Expo imports here).
// The "JPEG" is a real 16x16 baseline JPEG (white 8x8 square on black, made with Pillow);
// the fake decoder checks its bytes survive the base64 hop and returns the matching RGBA.
// Decoding it for real needs jpeg-js, which is not installed offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBase64 } from '../core/base64.ts';
import { isAbortError, makeOutlinePipeline, type OutlineDeps, type Pixels } from './outlinePipeline.ts';

const FIXTURE_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5U/YY/YY/4bR/4Tb/AIrb/hDv+Ea+w/8AMJ+3faftH2j/AKbxbNv2f3zu7Y5P25/2GP8Ahi7/AIQn/itv+Ex/4SX7d/zCfsP2b7P9n/6by7932j2xt754P2GP25/+GLv+E2/4on/hMf8AhJfsP/MW+w/Zvs/2j/phLv3faPbG3vng/bn/AG5/+G0f+EJ/4on/AIQ7/hGvt3/MW+3faftH2f8A6YRbNv2f3zu7Y5AP/9k=';
const FIXTURE_BYTES = 800;

function square16(): Pixels {
  const w = 16, h = 16;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x >= 4 && x < 12 && y >= 4 && y < 12 ? 255 : 0;
      const p = (y * w + x) * 4;
      data[p] = v; data[p + 1] = v; data[p + 2] = v; data[p + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

type Calls = {
  resize: { uri: string; maxPx: number; turns: number }[];
  decode: number;
  png: { rgba: Uint8Array | Uint8ClampedArray; w: number; h: number }[];
  written: { name: string; base64: string }[];
  yields: number;
};

function fakes(over: Partial<OutlineDeps> = {}): { deps: OutlineDeps; calls: Calls } {
  const calls: Calls = { resize: [], decode: 0, png: [], written: [], yields: 0 };
  const deps: OutlineDeps = {
    async resizeToJpegBase64(uri, maxPx, turns) {
      calls.resize.push({ uri, maxPx, turns });
      return { base64: FIXTURE_JPEG_B64, width: 16, height: 16 };
    },
    decodeJpeg(bytes) {
      calls.decode++;
      assert.equal(bytes.length, FIXTURE_BYTES);
      assert.equal(bytes[0], 0xff);
      assert.equal(bytes[1], 0xd8); // SOI
      assert.equal(bytes[bytes.length - 2], 0xff);
      assert.equal(bytes[bytes.length - 1], 0xd9); // EOI
      return square16();
    },
    encodePng(rgba, w, h) {
      calls.png.push({ rgba, w, h });
      return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    },
    async writeCacheFile(name, base64) {
      calls.written.push({ name, base64 });
      return `file:///cache/${name}`;
    },
    async yieldFn() {
      calls.yields++;
    },
    ...over,
  };
  return { deps, calls };
}

const OPTS = { detail: 0.5, thickness: 1, invert: false };

test('runs end to end: progress monotonic to 1, PNG gets transparent line art of the right size', async () => {
  const { deps, calls } = fakes();
  const pipe = makeOutlinePipeline(deps);
  const progress: number[] = [];
  const res = await pipe.run('file:///photo.jpg', { ...OPTS, rotateTurns: 1 }, (p) => progress.push(p));

  assert.deepEqual(calls.resize, [{ uri: 'file:///photo.jpg', maxPx: 1024, turns: 1 }]);
  assert.equal(calls.decode, 1);
  assert.ok(progress.length > 3);
  for (let i = 1; i < progress.length; i++) assert.ok(progress[i] >= progress[i - 1], `monotonic at ${i}`);
  assert.equal(progress[0], 0);
  assert.equal(progress[progress.length - 1], 1);
  assert.ok(calls.yields > 0);

  assert.equal(calls.png.length, 1);
  const { rgba, w, h } = calls.png[0];
  assert.equal(w, 16);
  assert.equal(h, 16);
  assert.equal(rgba.length, 16 * 16 * 4);
  let line = 0, clear = 0;
  for (let p = 0; p < rgba.length; p += 4) {
    if (rgba[p + 3] > 0) {
      // Anti-aliased: coverage lives in alpha, colour stays the ink colour.
      line++;
      assert.deepEqual([rgba[p], rgba[p + 1], rgba[p + 2]], [34, 32, 28]);
    } else {
      clear++;
    }
  }
  assert.ok(line > 0, 'square edges become lines');
  assert.ok(clear > line, 'background stays transparent');
  // Corners and the square's centre are background.
  assert.equal(rgba[3], 0);
  assert.equal(rgba[(8 * 16 + 8) * 4 + 3], 0);

  assert.equal(calls.written.length, 1);
  assert.match(calls.written[0].name, /^outline-.+\.png$/);
  assert.equal(calls.written[0].base64, encodeBase64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])));
  assert.deepEqual({ uri: res.uri, width: res.width, height: res.height }, { uri: `file:///cache/${calls.written[0].name}`, width: 16, height: 16 });
  assert.ok(res.info && ['portrait', 'object', 'drawing'].includes(res.info.autoKind));
  assert.equal(res.info?.faces, 0);
});

test('invert gives white lines, still on transparent', async () => {
  const { deps, calls } = fakes();
  await makeOutlinePipeline(deps).run('a.jpg', { ...OPTS, invert: true, thickness: 2 });
  const { rgba } = calls.png[0];
  let line = 0;
  for (let p = 0; p < rgba.length; p += 4) {
    if (rgba[p + 3] === 0) continue;
    line++;
    assert.deepEqual([rgba[p], rgba[p + 1], rgba[p + 2]], [255, 255, 255]);
  }
  assert.ok(line > 0);
  assert.equal(rgba[3], 0);
});

test('reuses the decoded source when only outline settings change', async () => {
  const { deps, calls } = fakes();
  const pipe = makeOutlinePipeline(deps);
  const a = await pipe.run('a.jpg', OPTS);
  const b = await pipe.run('a.jpg', { ...OPTS, thickness: 3 });
  assert.equal(calls.resize.length, 1);
  assert.equal(calls.decode, 1);
  assert.notEqual(a.uri, b.uri, 'each run writes a fresh file');
  await pipe.run('a.jpg', { ...OPTS, rotateTurns: 2 });
  await pipe.run('b.jpg', OPTS);
  assert.equal(calls.resize.length, 3);
  pipe.clear();
  await pipe.run('b.jpg', OPTS);
  assert.equal(calls.resize.length, 4);
});

test('passes maxPx and normalises turns', async () => {
  const { deps, calls } = fakes();
  await makeOutlinePipeline(deps).run('a.jpg', { ...OPTS, rotateTurns: -1, maxPx: 512 });
  assert.deepEqual(calls.resize[0], { uri: 'a.jpg', maxPx: 512, turns: 3 });
});

test('abort mid-outline rejects with AbortError and writes nothing', async () => {
  const token = { aborted: false };
  let n = 0;
  const { deps, calls } = fakes({
    async yieldFn() {
      n++;
      if (n === 3) token.aborted = true;
    },
  });
  await assert.rejects(makeOutlinePipeline(deps).run('a.jpg', OPTS, undefined, token), (e: unknown) => {
    assert.ok(isAbortError(e));
    return true;
  });
  assert.equal(calls.png.length, 0);
  assert.equal(calls.written.length, 0);
});

test('abort before start and abort during resize', async () => {
  const { deps, calls } = fakes();
  await assert.rejects(makeOutlinePipeline(deps).run('a.jpg', OPTS, undefined, { aborted: true }), (e: unknown) => isAbortError(e));
  assert.equal(calls.resize.length, 0);

  const token = { aborted: false };
  const f = fakes({
    async resizeToJpegBase64() {
      token.aborted = true;
      return { base64: FIXTURE_JPEG_B64, width: 16, height: 16 };
    },
  });
  await assert.rejects(makeOutlinePipeline(f.deps).run('a.jpg', OPTS, undefined, token), (e: unknown) => isAbortError(e));
  assert.equal(f.calls.decode, 0);
});

test('errors from each stage propagate (not as aborts)', async () => {
  const boom = (msg: string) => () => {
    throw new Error(msg);
  };
  const cases: [Partial<OutlineDeps>, RegExp][] = [
    [{ resizeToJpegBase64: async () => Promise.reject(new Error('resize failed')) }, /resize failed/],
    [{ decodeJpeg: boom('bad jpeg') }, /bad jpeg/],
    [{ encodePng: boom('png failed') }, /png failed/],
    [{ writeCacheFile: async () => Promise.reject(new Error('disk full')) }, /disk full/],
    [{ resizeToJpegBase64: async () => ({ base64: 'not base64!', width: 1, height: 1 }) }, /base64/],
    [{ decodeJpeg: () => ({ width: 4, height: 4, data: new Uint8Array(10) }) }, /Couldn’t read/],
    [{ decodeJpeg: () => ({ width: 2000, height: 10, data: new Uint8Array(2000 * 10 * 4) }) }, /larger than/],
  ];
  for (const [over, re] of cases) {
    const { deps } = fakes(over);
    await assert.rejects(makeOutlinePipeline(deps).run('a.jpg', OPTS), (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, re);
      assert.equal(isAbortError(e), false);
      return true;
    });
  }
  await assert.rejects(makeOutlinePipeline(fakes().deps).run('', OPTS), /No image/);
});

test('a failed decode is not cached', async () => {
  let fail = true;
  const { deps, calls } = fakes({
    decodeJpeg() {
      if (fail) throw new Error('bad');
      return square16();
    },
  });
  const pipe = makeOutlinePipeline(deps);
  await assert.rejects(pipe.run('a.jpg', OPTS));
  fail = false;
  await pipe.run('a.jpg', OPTS);
  assert.equal(calls.resize.length, 2);
});

function square64(): Pixels {
  const w = 64, h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x >= 16 && x < 48 && y >= 16 && y < 48 ? 255 : 0;
      const p = (y * w + x) * 4;
      data[p] = v; data[p + 1] = v; data[p + 2] = v; data[p + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

test('D7-1: quick preview runs on a small copy, then the full run reuses the same decode', async () => {
  const { deps, calls } = fakes({ decodeJpeg: () => { calls.decode++; return square64(); } });
  const pipe = makeOutlinePipeline(deps);
  const pv = await pipe.run('file:///photo.jpg', { ...OPTS, previewPx: 16 });
  assert.equal(pv.preview, true);
  assert.equal(pv.width, 16);
  assert.equal(pv.height, 16);
  const full = await pipe.run('file:///photo.jpg', OPTS);
  assert.equal(full.preview, undefined);
  assert.equal(full.width, 64);
  assert.equal(calls.decode, 1);
  assert.equal(calls.resize.length, 1);
  // a previewPx at or above the image size is just a full run
  const same = await pipe.run('file:///photo.jpg', { ...OPTS, previewPx: 64 });
  assert.equal(same.preview, undefined);
  assert.equal(same.width, 64);
});

test('D7-1: a newer request supersedes an older one (stale job aborts, writes nothing)', async () => {
  const { makeLatestJobs } = await import('../core/preview.ts');
  const jobs = makeLatestJobs();
  let started = 0;
  const { deps, calls } = fakes({
    decodeJpeg: () => { calls.decode++; return square64(); },
    async yieldFn() {
      calls.yields++;
      // the second change arrives while the first job is mid-outline
      if (calls.yields === 3 && started === 1) { started = 2; second = pipe.run('file:///photo.jpg', { ...OPTS, detail: 0.9 }, undefined, jobs.start()); }
    },
  });
  const pipe = makeOutlinePipeline(deps);
  let second: Promise<unknown> | null = null;
  started = 1;
  const first = pipe.run('file:///photo.jpg', OPTS, undefined, jobs.start());
  await assert.rejects(first, (e: unknown) => isAbortError(e));
  assert.ok(second);
  const r = (await second) as { width: number };
  assert.equal(r.width, 64);
  assert.equal(calls.written.length, 1);
});
