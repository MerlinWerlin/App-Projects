// T103: photo packs (Space / Webb). Manifest validation, download over a fake Transport, and the
// bundled Space data. No real network: the fake transport records every URL it is asked for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex, utf8Encode } from './bytes.ts';
import { PackError } from './packDownloader.ts';
import {
  FREE_PHOTO_PACK_IDS,
  HttpStatusError,
  MAX_PHOTO_BYTES,
  PHOTO_FAILURES,
  PHOTO_FAILURE_KEYS,
  PhotoError,
  downloadedPhotoRows,
  photoCreditParams,
  photoDownloadView,
  wallpaperSourceFor,
  photoFailureOf,
  photoPaths,
  photoTempFile,
  type PhotoFailure,
  type PhotoTransport,
  PHOTO_IMAGE_HOSTS,
  PHOTO_LICENCES,
  PHOTO_PAGE_HOSTS,
  downloadPhoto,
  httpsHost,
  isAllowedImageUrl,
  isAllowedPageUrl,
  isImageContentType,
  isPhotoTheme,
  parseAnyPackManifest,
  parsePhotoPackManifest,
  photoFile,
  photoMetaFile,
  photoSourceErrors,
  photoThemeFromData,
  photoThemeToData,
  readPhotoMeta,
  removePhoto,
  removePhotoPack,
  sniffImage,
  type PhotoPackManifest,
  type PhotoRangeResponse,
  type PhotoTheme,
} from './photoPack.ts';
import { SPACE_MANIFEST_PATH, SPACE_PACK_ID, SPACE_PACK_MANIFEST, SPACE_THEMES, spaceThemeById } from './spacePack.ts';
import { parsePackManifest } from './themePack.ts';
import { THEMES } from './themes.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const good = (): PhotoPackManifest => clone(SPACE_PACK_MANIFEST);

function errorsOf(m: unknown): string[] {
  const r = parsePhotoPackManifest(m);
  return r.ok ? [] : r.errors;
}

// ------------------------------------------------------------ validation

test('the bundled Space manifest is valid', () => {
  assert.deepEqual(errorsOf(good()), []);
  assert.equal(SPACE_PACK_MANIFEST.plus, false);
  assert.ok(FREE_PHOTO_PACK_IDS.includes(SPACE_PACK_ID));
});

test('rejects image hosts that are not on the allowlist', () => {
  for (const url of [
    'https://example.com/weic2216b.jpg',
    'https://cdn.esawebb.org.evil.com/a.jpg',
    'https://evil.com/cdn.esawebb.org/a.jpg',
    'https://user@cdn.esawebb.org/a.jpg',
    'https://cdn.esawebb.org:8443/a.jpg',
    'https://cdn.esawebb.org/a.jpg?x=1',
    'https://cdn.esawebb.org/archives/images/original/weic2216b.tif',
  ]) {
    const m = good();
    m.themes[0].photo.imageUrl = url;
    assert.ok(errorsOf(m).some((e) => e.includes('imageUrl')), url);
  }
});

test('rejects page hosts that are not on the allowlist', () => {
  const m = good();
  m.themes[1].photo.pageUrl = 'https://not-webb.example/images/weic2205a/';
  assert.ok(errorsOf(m).some((e) => e.includes('pageUrl host not allowed')));
});

test('rejects http URLs', () => {
  const m = good();
  m.themes[0].photo.imageUrl = 'http://cdn.esawebb.org/archives/images/publicationjpg/weic2216b.jpg';
  m.themes[0].photo.pageUrl = 'http://esawebb.org/images/weic2216b/';
  const e = errorsOf(m);
  assert.ok(e.some((x) => x.includes('imageUrl must be https')));
  assert.ok(e.some((x) => x.includes('pageUrl must be https')));
});

test('rejects a missing or blank credit', () => {
  const m = good();
  m.themes[0].photo.credit = '   ';
  assert.ok(errorsOf(m).some((e) => e.includes('missing credit')));
  const m2 = good() as unknown as { themes: { photo: Record<string, unknown> }[] };
  delete m2.themes[2].photo.credit;
  assert.ok(errorsOf(m2).some((e) => e.includes('missing credit')));
});

test('rejects unknown licences and a licence link that does not match', () => {
  const m = good() as unknown as { themes: { photo: Record<string, unknown> }[] };
  m.themes[0].photo.licence = 'All-rights-reserved';
  assert.ok(errorsOf(m).some((e) => e.includes('unknown licence')));
  const m2 = good();
  m2.themes[0].photo.licenceUrl = 'https://creativecommons.org/licenses/by-nc/4.0/';
  assert.ok(errorsOf(m2).some((e) => e.includes('licenceUrl')));
});

test('photo packs must be free and themes must belong to the pack', () => {
  const m = good() as unknown as Record<string, unknown> & { themes: Record<string, unknown>[] };
  m.plus = true;
  m.themes[0].plus = true;
  m.themes[1].packId = 'other';
  const e = errorsOf(m);
  assert.ok(e.includes('photo packs are free (plus: false)'));
  assert.ok(e.some((x) => x.startsWith('themes[0]') && x.includes('plus: false')));
  assert.ok(e.some((x) => x.startsWith('themes[1]') && x.includes('packId')));
});

test('rejects junk, other formats, versions, duplicate ids and bad sizes', () => {
  assert.deepEqual(errorsOf('nope'), ['manifest is not JSON']);
  assert.ok(errorsOf({ ...good(), format: 'glaze-pack' })[0].startsWith('unknown format'));
  assert.ok(errorsOf({ ...good(), version: 2 })[0].startsWith('unsupported version'));
  const m = good();
  m.themes[1].id = m.themes[0].id;
  assert.ok(errorsOf(m).some((e) => e.includes('duplicate id')));
  const m2 = good();
  m2.themes[0].photo.approxBytes = MAX_PHOTO_BYTES + 1;
  assert.ok(errorsOf(m2).some((e) => e.includes('approxBytes')));
  const m3 = good();
  m3.themes[0].photo.sha256 = 'abc';
  assert.ok(errorsOf(m3).some((e) => e.includes('sha256')));
});

test('parseAnyPackManifest keeps v1 art packs on the unchanged parser', () => {
  const aurora = readFileSync(join(process.cwd(), 'src/core/__fixtures__/packs/pack-aurora-2026/manifest.json'), 'utf8');
  const a = parseAnyPackManifest(aurora);
  assert.ok(a.ok && a.value.kind === 'art');
  assert.ok(parsePackManifest(aurora).ok);
  const p = parseAnyPackManifest(JSON.stringify(SPACE_PACK_MANIFEST));
  assert.ok(p.ok && p.value.kind === 'photo');
  // The art-pack parser still refuses a photo manifest (no silent cross-over).
  assert.equal(parsePackManifest(clone(SPACE_PACK_MANIFEST)).ok, false);
  assert.equal(parseAnyPackManifest({ format: 'x' }).ok, false);
});

test('URL helpers', () => {
  assert.equal(httpsHost('https://cdn.esawebb.org/archives/images/large/weic2218a.jpg'), 'cdn.esawebb.org');
  assert.equal(httpsHost('ftp://cdn.esawebb.org/x.jpg'), null);
  assert.ok(isAllowedPageUrl('https://esawebb.org/images/weic2216b/'));
  assert.ok(!isAllowedPageUrl('https://cdn.esawebb.org/images/weic2216b/'));
  assert.ok(isAllowedImageUrl('https://cdn.esawebb.org/archives/images/publicationjpg/weic2216b.jpg'));
  assert.ok(!isAllowedImageUrl('https://esawebb.org/media/archives/images/original/weic2216b.tif'));
});

// ------------------------------------------------------------ Space data

test('every Space theme has a credit, a known licence and allowlisted https URLs', () => {
  assert.ok(SPACE_THEMES.length >= 6 && SPACE_THEMES.length <= 8);
  for (const t of SPACE_THEMES) {
    assert.deepEqual(photoSourceErrors(t.photo), [], t.id);
    assert.ok(t.photo.credit.trim().length > 0, t.id);
    assert.ok(t.photo.credit.includes('NASA') || t.photo.credit.includes('ESA'), t.id);
    assert.ok(t.photo.pageUrl.startsWith('https://') && PHOTO_PAGE_HOSTS.includes(httpsHost(t.photo.pageUrl)!), t.id);
    assert.ok(t.photo.imageUrl.startsWith('https://') && PHOTO_IMAGE_HOSTS.includes(httpsHost(t.photo.imageUrl)!), t.id);
    assert.ok(t.photo.pageUrl.includes(t.photo.releaseId) && t.photo.imageUrl.includes(t.photo.releaseId), t.id);
    assert.equal(t.photo.licenceUrl, PHOTO_LICENCES[t.photo.licence].url);
    assert.ok(t.photo.approxBytes <= 5_000_000, `${t.id} should be a phone-sized file`);
    assert.equal(t.plus, false);
    assert.equal(t.packId, SPACE_PACK_ID);
    assert.ok(isPhotoTheme(t));
  }
  assert.equal(new Set(SPACE_THEMES.map((t) => t.photo.releaseId)).size, SPACE_THEMES.length, 'no image twice');
});

test('Space themes are whole themes: icon style, widget, palette and fallback art', () => {
  for (const t of SPACE_THEMES) {
    assert.equal(t.iconStyle.glyphColour, t.palette.glyph);
    assert.ok(t.iconStyle.art && t.wallpaper.art, t.id);
    assert.equal(t.widget.accent, t.palette.accent);
    assert.ok(t.categories?.includes('dark'));
    assert.ok(t.tags?.includes('space'));
    assert.equal(spaceThemeById(t.id), t);
  }
});

test('Space theme ids do not clash with bundled themes', () => {
  const ids = new Set(THEMES.map((t) => t.id));
  for (const t of SPACE_THEMES) assert.ok(!ids.has(t.id), t.id);
});

test('data round-trips and the generated JSON is current', () => {
  for (const d of SPACE_PACK_MANIFEST.themes) assert.deepEqual(photoThemeToData(photoThemeFromData(d)), d);
  const disk = JSON.parse(readFileSync(join(process.cwd(), SPACE_MANIFEST_PATH), 'utf8'));
  assert.deepEqual(disk, clone(SPACE_PACK_MANIFEST), `${SPACE_MANIFEST_PATH} is stale: run node ops/build-photo-pack.ts`);
});

test('no Webb image is bundled in the repo', () => {
  assert.deepEqual(readdirSync(join(process.cwd(), 'packs', SPACE_PACK_ID)), ['manifest.json']);
  const src = readFileSync(join(process.cwd(), 'src/core/spacePack.ts'), 'utf8');
  assert.ok(!/require\(|\bimport\b[^\n]*\.(jpe?g|png)/.test(src));
});

// ------------------------------------------------------------ download flow (fake Transport)

const JPEG = (n: number) => {
  const b = new Uint8Array(n);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  for (let i = 4; i < n; i++) b[i] = i % 251;
  return b;
};

type Serve = {
  body: Uint8Array;
  contentType?: string | null;
  offset?: number;
  chunk?: number;
  /** fetch rejects: true = like RN fetch offline (TypeError), or the error to throw. */
  fail?: boolean | Error;
  /** The body stream breaks after this many bytes (connection dropped mid-download). */
  dropAfter?: number;
  /** The Nth writeAppend (1-based) writes half its chunk, then throws (disk full / app killed). */
  failWriteAt?: number;
  /** move() throws. */
  failMove?: boolean;
};

function fakeTransport(serve: Serve) {
  const files = new Map<string, Uint8Array>();
  const requests: string[] = [];
  let writes = 0;
  const append = (path: string, chunk: Uint8Array) => {
    const prev = files.get(path);
    const next = new Uint8Array((prev?.length ?? 0) + chunk.length);
    if (prev) next.set(prev);
    next.set(chunk, prev?.length ?? 0);
    files.set(path, next);
  };
  const t: PhotoTransport = {
    async fetchRange(url, start): Promise<PhotoRangeResponse> {
      requests.push(url);
      if (serve.fail) throw serve.fail instanceof Error ? serve.fail : new TypeError('Network request failed');
      const size = serve.chunk ?? serve.body.length;
      const body = serve.body;
      const dropAfter = serve.dropAfter;
      return {
        offset: serve.offset ?? start,
        contentType: serve.contentType === undefined ? 'image/jpeg' : serve.contentType,
        chunks: (async function* () {
          for (let i = 0; i < body.length; i += size) {
            if (dropAfter !== undefined && i >= dropAfter) throw new TypeError('Network request failed');
            yield body.subarray(i, i + size);
          }
        })(),
      };
    },
    async writeAppend(path, chunk) {
      writes += 1;
      if (serve.failWriteAt === writes) {
        append(path, chunk.subarray(0, Math.floor(chunk.length / 2)));
        throw new Error('ENOSPC: no space left on device');
      }
      append(path, chunk);
    },
    async readFile(path) {
      return files.get(path) ?? null;
    },
    async remove(path) {
      for (const k of [...files.keys()]) if (k === path || k.startsWith(`${path}/`)) files.delete(k);
    },
    async move(from, to) {
      if (serve.failMove) throw new Error('rename failed');
      const b = files.get(from);
      if (!b) throw new Error(`no such file ${from}`);
      files.delete(from);
      files.set(to, b);
    },
  };
  return { t, files, requests };
}

const THEME: PhotoTheme = SPACE_THEMES[0];

async function rejectsWith(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof PackError && e.code === code);
}

test('download is disabled unless the person tapped Download: no request at all', async () => {
  const f = fakeTransport({ body: JPEG(100) });
  await rejectsWith(downloadPhoto({ allowNetwork: false, theme: THEME, transport: f.t }), 'disabled');
  assert.deepEqual(f.requests, []);
});

test('only free photo packs may download', async () => {
  const f = fakeTransport({ body: JPEG(100) });
  await rejectsWith(downloadPhoto({ allowNetwork: true, theme: { ...THEME, packId: 'pack-aurora-2026' }, transport: f.t }), 'disabled');
  assert.deepEqual(f.requests, []);
});

test('a bad source URL is refused before any request', async () => {
  const f = fakeTransport({ body: JPEG(100) });
  const theme = { ...THEME, photo: { ...THEME.photo, imageUrl: 'https://example.com/x.jpg' } };
  await rejectsWith(downloadPhoto({ allowNetwork: true, theme, transport: f.t }), 'bad-url');
  assert.deepEqual(f.requests, []);
});

test('allowed download: exactly one GET to the manifest URL, stored, verified, removable', async () => {
  const body = JPEG(5000);
  const f = fakeTransport({ body, chunk: 700 });
  const progress: number[] = [];
  const meta = await downloadPhoto({ allowNetwork: true, theme: THEME, transport: f.t, onProgress: (p) => progress.push(p.doneBytes), now: () => new Date('2026-10-22T00:00:00Z') });
  assert.deepEqual(f.requests, [THEME.photo.imageUrl]);
  assert.equal(meta.kind, 'jpeg');
  assert.equal(meta.bytes, 5000);
  assert.equal(meta.sha256, sha256Hex(body));
  assert.equal(meta.path, photoFile(SPACE_PACK_ID, THEME.id, 'jpeg'));
  assert.equal(meta.credit, THEME.photo.credit);
  assert.deepEqual(f.files.get(meta.path), body);
  assert.equal(progress.at(-1), 5000);
  assert.deepEqual(await readPhotoMeta(f.t, THEME, true), meta);

  await removePhoto(f.t, THEME);
  assert.equal(await readPhotoMeta(f.t, THEME), null);
  assert.equal(f.files.size, 0);
});

test('integrity: wrong content type, wrong magic bytes or a pinned hash mismatch are rejected and leave nothing', async () => {
  const html = fakeTransport({ body: utf8Encode('<html>nope</html>'), contentType: 'text/html; charset=utf-8' });
  await rejectsWith(downloadPhoto({ allowNetwork: true, theme: THEME, transport: html.t }), 'integrity');
  assert.equal(html.files.size, 0);

  const notImage = fakeTransport({ body: utf8Encode('GIF89a not allowed either'), contentType: 'image/jpeg' });
  await rejectsWith(downloadPhoto({ allowNetwork: true, theme: THEME, transport: notImage.t }), 'integrity');
  assert.equal(notImage.files.size, 0);

  const pinned = { ...THEME, photo: { ...THEME.photo, sha256: '0'.repeat(64) } };
  const hash = fakeTransport({ body: JPEG(300) });
  await rejectsWith(downloadPhoto({ allowNetwork: true, theme: pinned, transport: hash.t }), 'integrity');
  assert.equal(hash.files.size, 0);
});

test('size cap: a file over the cap is cut off and rejected', async () => {
  const f = fakeTransport({ body: JPEG(10_000), chunk: 1000 });
  await rejectsWith(downloadPhoto({ allowNetwork: true, theme: THEME, transport: f.t, maxBytes: 4000 }), 'integrity');
  assert.equal(f.files.size, 0);
  // The caller can never raise the cap above MAX_PHOTO_BYTES.
  const g = fakeTransport({ body: JPEG(200) });
  await downloadPhoto({ allowNetwork: true, theme: THEME, transport: g.t, maxBytes: MAX_PHOTO_BYTES * 10 });
});

test('network errors and range surprises surface as network errors', async () => {
  await rejectsWith(downloadPhoto({ allowNetwork: true, theme: THEME, transport: fakeTransport({ body: JPEG(10), fail: true }).t }), 'network');
  await rejectsWith(downloadPhoto({ allowNetwork: true, theme: THEME, transport: fakeTransport({ body: JPEG(10), offset: 5 }).t }), 'network');
});

test('PNG is accepted and a re-download replaces the old file; tampering hides the photo', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const f = fakeTransport({ body: png, contentType: 'image/png' });
  const meta = await downloadPhoto({ allowNetwork: true, theme: THEME, transport: f.t });
  assert.equal(meta.kind, 'png');
  await downloadPhoto({ allowNetwork: true, theme: THEME, transport: f.t });
  assert.deepEqual(f.files.get(meta.path), png, 'not appended twice');
  f.files.get(meta.path)![9] = 9;
  assert.equal(await readPhotoMeta(f.t, THEME, true), null);
  f.files.set(photoMetaFile(SPACE_PACK_ID, THEME.id), utf8Encode('{junk'));
  assert.equal(await readPhotoMeta(f.t, THEME), null);
  await removePhotoPack(f.t, SPACE_PACK_ID);
  assert.equal(f.files.size, 0);
});

test('ui.photoCredit strings exist in all 11 locales with the same placeholders', async () => {
  const ns = await import('../i18n/ns/ui/index.ts');
  const en = ns.en.photoCredit as Record<string, string>;
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const loc of ['es', 'fr', 'de', 'it', 'ptBR', 'ja', 'ko', 'zhHans', 'hi', 'ar'] as const) {
    const m = (ns[loc] as { photoCredit?: Record<string, string> }).photoCredit;
    assert.ok(m, loc);
    for (const k of Object.keys(en)) {
      assert.ok(typeof m[k] === 'string' && m[k].length > 0, `${loc}.${k}`);
      assert.equal(ph(m[k]), ph(en[k]), `${loc}.${k} placeholders`);
    }
  }
});

// ------------------------------------------------------------ T108: failures never leave a file

/** Nothing of THEME is on disk and it does not count as downloaded. */
async function nothingLeft(f: ReturnType<typeof fakeTransport>, msg: string) {
  for (const p of photoPaths(SPACE_PACK_ID, THEME.id)) assert.equal(f.files.has(p), false, `${msg}: ${p} left behind`);
  assert.equal(f.files.size, 0, `${msg}: no files at all`);
  assert.equal(await readPhotoMeta(f.t, THEME), null, `${msg}: not downloaded`);
}

async function failsAs(f: ReturnType<typeof fakeTransport>, failure: PhotoFailure, extra: Partial<Parameters<typeof downloadPhoto>[0]> = {}) {
  let caught: unknown;
  try {
    await downloadPhoto({ allowNetwork: true, theme: THEME, transport: f.t, ...extra });
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof PhotoError, `rejects with a PhotoError (${failure})`);
  assert.ok(caught instanceof PackError, 'still a PackError');
  assert.equal(caught.failure, failure);
  assert.equal(photoFailureOf(caught), failure);
  await nothingLeft(f, failure);
}

test('T108 mocked fetch failure (offline): friendly "offline", no file, not downloaded', async () => {
  const f = fakeTransport({ body: JPEG(500), fail: true });
  await failsAs(f, 'offline');
  assert.deepEqual(f.requests, [THEME.photo.imageUrl], 'one request, no retry loop');
});

test('T108 HTTP error and proxy refusal: "blocked", nothing kept', async () => {
  await failsAs(fakeTransport({ body: JPEG(500), fail: new HttpStatusError(503) }), 'blocked');
  // A proxy that refuses the host answers 403 / 407; transports may also throw a plain "HTTP 403".
  await failsAs(fakeTransport({ body: JPEG(500), fail: new Error('HTTP 403') }), 'blocked');
  await failsAs(fakeTransport({ body: JPEG(500), fail: new HttpStatusError(407) }), 'blocked');
});

test('T108 wrong content type, wrong bytes, size and sha256 mismatch: "bad-file", temp deleted', async () => {
  await failsAs(fakeTransport({ body: utf8Encode('<html>blocked by proxy</html>'), contentType: 'text/html' }), 'bad-file');
  await failsAs(fakeTransport({ body: utf8Encode('<html>proxy page</html>'), contentType: 'image/jpeg' }), 'bad-file');
  await failsAs(fakeTransport({ body: JPEG(10_000), chunk: 1000 }), 'bad-file', { maxBytes: 4000 });
  await failsAs(fakeTransport({ body: new Uint8Array(0) }), 'bad-file');
  const pinned = { ...THEME, photo: { ...THEME.photo, sha256: 'a'.repeat(64) } };
  const f = fakeTransport({ body: JPEG(3000), chunk: 1000 });
  await assert.rejects(downloadPhoto({ allowNetwork: true, theme: pinned, transport: f.t }), (e: unknown) => e instanceof PhotoError && e.failure === 'bad-file');
  await nothingLeft(f, 'sha mismatch');
  // A matching pin is accepted.
  const body = JPEG(3000);
  const ok = fakeTransport({ body, chunk: 1000 });
  const meta = await downloadPhoto({ allowNetwork: true, theme: { ...THEME, photo: { ...THEME.photo, sha256: sha256Hex(body) } }, transport: ok.t });
  assert.equal(meta.sha256, sha256Hex(body));
});

test('T108 connection drops mid-download: "offline", the partial temp file is deleted', async () => {
  const f = fakeTransport({ body: JPEG(5000), chunk: 1000, dropAfter: 3000 });
  await failsAs(f, 'offline');
});

test('T108 cancelled mid-download: "cancelled", nothing kept', async () => {
  let n = 0;
  const f = fakeTransport({ body: JPEG(5000), chunk: 1000 });
  await failsAs(f, 'cancelled', { isCancelled: () => ++n > 3 });
});

test('T108 mid-write failure: half a chunk on disk, then the write throws; no partial file remains and the photo does not count', async () => {
  // Writes: chunk 1, chunk 2 (fails halfway).
  const f = fakeTransport({ body: JPEG(4000), chunk: 1000, failWriteAt: 2 });
  await failsAs(f, 'storage');
  // The meta write failing (after the photo moved into place) also removes the photo.
  const g = fakeTransport({ body: JPEG(2000), chunk: 1000, failWriteAt: 3 });
  await failsAs(g, 'storage');
  // A failed rename leaves neither the temp nor a final file.
  await failsAs(fakeTransport({ body: JPEG(2000), failMove: true }), 'storage');
});

test('T108 a failed retry after a good download leaves nothing stale; a later retry succeeds', async () => {
  const body = JPEG(2000);
  const f = fakeTransport({ body, chunk: 500 });
  await downloadPhoto({ allowNetwork: true, theme: THEME, transport: f.t });
  assert.ok(await readPhotoMeta(f.t, THEME, true));
  f.t.fetchRange = async () => {
    throw new TypeError('Network request failed');
  };
  await failsAs(f, 'offline');
  const g = fakeTransport({ body, chunk: 500, failWriteAt: 2 });
  await failsAs(g, 'storage');
  // Retry on the same store now works (the counter moved past the failing write).
  const meta = await downloadPhoto({ allowNetwork: true, theme: THEME, transport: g.t });
  assert.deepEqual(g.files.get(meta.path), body);
  assert.equal(g.files.has(photoTempFile(SPACE_PACK_ID, THEME.id)), false, 'temp moved away');
  assert.deepEqual(await readPhotoMeta(g.t, THEME, true), meta);
});

test('T108 the photo is only ever written under its temp name until it is verified', async () => {
  const body = JPEG(3000);
  const seen: string[] = [];
  const f = fakeTransport({ body, chunk: 1000 });
  const write = f.t.writeAppend;
  f.t.writeAppend = async (p, c) => {
    seen.push(p);
    await write(p, c);
  };
  const meta = await downloadPhoto({ allowNetwork: true, theme: THEME, transport: f.t });
  assert.ok(!seen.includes(meta.path), 'never appended to the final name');
  assert.ok(seen.every((p) => p.endsWith('.part')), 'only temp names are written');
});

test('T108 photoFailureOf classifies raw errors and old PackErrors', () => {
  assert.equal(photoFailureOf(new TypeError('Network request failed')), 'offline');
  assert.equal(photoFailureOf(new HttpStatusError(404)), 'blocked');
  assert.equal(photoFailureOf(new Error('HTTP 500')), 'blocked');
  assert.equal(photoFailureOf(new PackError('network', 'HTTP 403')), 'blocked');
  assert.equal(photoFailureOf(new PackError('network', 'socket hang up')), 'offline');
  assert.equal(photoFailureOf(new PackError('integrity', 'x')), 'bad-file');
  assert.equal(photoFailureOf(new PackError('cancelled', 'x')), 'cancelled');
  assert.equal(photoFailureOf('weird'), 'other');
});

test('T108 photoDownloadView: every failure shows a friendly state with Retry, never "ready"', () => {
  assert.deepEqual(photoDownloadView({ status: 'not-downloaded', progress: 0, failure: null }), { kind: 'download' });
  assert.deepEqual(photoDownloadView({ status: 'ready', progress: 1, failure: null }), { kind: 'ready' });
  assert.deepEqual(photoDownloadView({ status: 'downloading', progress: 0.426, failure: null }), { kind: 'downloading', percent: 43 });
  assert.deepEqual(photoDownloadView({ status: 'downloading', progress: Number.NaN, failure: null }), { kind: 'downloading', percent: 0 });
  for (const failure of PHOTO_FAILURES) {
    const v = photoDownloadView({ status: 'error', progress: 0, failure });
    assert.equal(v.kind, 'failed');
    if (v.kind !== 'failed') continue;
    assert.equal(v.retry, true);
    assert.equal(v.failure, failure);
    assert.deepEqual({ title: v.titleKey, body: v.bodyKey }, PHOTO_FAILURE_KEYS[failure]);
  }
  assert.equal(PHOTO_FAILURE_KEYS.offline.title, 'ui.photoCredit.offlineTitle');
  const unknown = photoDownloadView({ status: 'error', progress: 0, failure: null });
  assert.ok(unknown.kind === 'failed' && unknown.failure === 'other');
});

test('T108 failure copy exists in every locale', async () => {
  const ns = await import('../i18n/ns/ui/index.ts');
  const keys = new Set<string>(['retry', 'retryA11y']);
  for (const k of Object.values(PHOTO_FAILURE_KEYS)) {
    keys.add(k.title.replace('ui.photoCredit.', ''));
    keys.add(k.body.replace('ui.photoCredit.', ''));
  }
  for (const loc of ['en', 'es', 'fr', 'de', 'it', 'ptBR', 'ja', 'ko', 'zhHans', 'hi', 'ar'] as const) {
    const m = (ns[loc] as { photoCredit?: Record<string, string> }).photoCredit ?? {};
    for (const k of keys) assert.ok(typeof m[k] === 'string' && m[k].length > 0, `${loc}.photoCredit.${k}`);
  }
});

test('T108 photoCreditParams carries every Space credit line exactly', () => {
  for (const s of SPACE_THEMES) {
    const p = photoCreditParams(s.photo);
    assert.equal(p.credit, s.photo.credit);
    assert.equal(p.licence, 'CC BY 4.0');
  }
});

// ------------------------------------------------------------ T105: apply + storage

test('T105 wallpaperSourceFor: own photo wins, Space saves the Webb photo or offers the download first', () => {
  assert.equal(wallpaperSourceFor({ ownPhoto: true, isSpace: true, spaceReady: true }), 'own-photo');
  assert.equal(wallpaperSourceFor({ ownPhoto: true, isSpace: false, spaceReady: false }), 'own-photo');
  assert.equal(wallpaperSourceFor({ ownPhoto: false, isSpace: true, spaceReady: true }), 'space-photo');
  assert.equal(wallpaperSourceFor({ ownPhoto: false, isSpace: true, spaceReady: false }), 'space-offer-download');
  assert.equal(wallpaperSourceFor({ ownPhoto: false, isSpace: false, spaceReady: true }), 'generated');
});

test('T105 downloadedPhotoRows lists only ready photos, in manifest order, with sizes, credit and total', () => {
  const [a, b, c] = SPACE_THEMES;
  const { rows, totalBytes } = downloadedPhotoRows(SPACE_THEMES, {
    [c.id]: { status: 'ready', bytes: 2_000_000 },
    [a.id]: { status: 'ready', bytes: 4_100_000 },
    [b.id]: { status: 'error', bytes: 0 },
    'not-a-theme': { status: 'ready', bytes: 9 },
  });
  assert.deepEqual(
    rows.map((r) => r.themeId),
    [a.id, c.id],
  );
  assert.equal(rows[0].bytes, 4_100_000);
  assert.equal(rows[0].name, a.name);
  assert.equal(rows[0].credit, a.photo.credit);
  assert.equal(totalBytes, 6_100_000);
  assert.deepEqual(downloadedPhotoRows(SPACE_THEMES, {}), { rows: [], totalBytes: 0 });
  assert.equal(downloadedPhotoRows(SPACE_THEMES, { [a.id]: { status: 'ready', bytes: Number.NaN } }).totalBytes, 0);
});

test('T105 a real download feeds Storage: the meta size is the listed size', async () => {
  const body = JPEG(1234);
  const f = fakeTransport({ body });
  const meta = await downloadPhoto({ allowNetwork: true, theme: THEME, transport: f.t });
  const { rows } = downloadedPhotoRows(SPACE_THEMES, { [THEME.id]: { status: 'ready', bytes: meta.bytes } });
  assert.equal(rows[0].bytes, 1234);
  await removePhoto(f.t, THEME);
  assert.equal(f.files.size, 0);
});

test('content-type helpers', () => {
  assert.ok(isImageContentType('image/jpeg'));
  assert.ok(isImageContentType('IMAGE/PNG; q=1'));
  assert.ok(isImageContentType(undefined));
  assert.ok(!isImageContentType('text/html'));
  assert.ok(!isImageContentType('image/svg+xml'));
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff])), 'jpeg');
  assert.equal(sniffImage(new Uint8Array([1, 2, 3])), null);
});
