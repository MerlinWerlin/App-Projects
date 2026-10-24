// T130: theme art packs: PNG checks, the validator, the Theme mapping, the generated files and the
// importer script. PNG fixtures are built here with a tiny encoder (stored, zlib-free DEFLATE
// blocks; node:zlib only for the full-size wallpaper so the fixture stays small).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  ART_ASSETS_PATH,
  ART_BYTE_BUDGET,
  ART_LIBRARY_PATH,
  ART_PACK_DIR,
  ART_PACK_FILES,
  ART_WALLPAPER_SIZE,
  HERO_FILES,
  HERO_REFERENCE_SIZES,
  HERO_SIZES,
  artPackAssetsSource,
  artPackCreditParams,
  artPackLibrarySource,
  artPackTheme,
  heroSizeOk,
  isArtPackId,
  isArtPackTheme,
  pngAlphaStats,
  readPngHeader,
  validateArtPack,
  validateMeta,
  validatePalette,
  type ArtPackData,
  type HeroSize,
} from './artPack.ts';
import { ART_PACK_THEMES, artPackOf, artPackThemeById } from './artPackThemes.ts';
import { contrastRatio, isHex } from './colour.ts';
import { isFreeMarked } from './freeMarks.ts';
import { crc32 } from './inflate.ts';
import { ALL_THEMES, getAnyTheme } from './plusThemes.ts';
import { SPACE_THEMES } from './spacePack.ts';
import { THEMES, previewSpecs } from './themes.ts';

const root = process.cwd();

// ------------------------------------------------------------------ tiny PNG encoder

function u32be(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function concat(parts: (Uint8Array | number[])[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array | number[]): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  return concat([u32be(data.length), body, u32be(crc32(body))]);
}

function adler32(b: Uint8Array): number {
  let a = 1;
  let s = 0;
  for (const x of b) {
    a = (a + x) % 65521;
    s = (s + a) % 65521;
  }
  return ((s << 16) | a) >>> 0;
}

/** zlib stream made only of stored (uncompressed) DEFLATE blocks. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const parts: (Uint8Array | number[])[] = [[0x78, 0x01]];
  let p = 0;
  do {
    const len = Math.min(65535, raw.length - p);
    const last = p + len >= raw.length ? 1 : 0;
    parts.push([last, len & 255, len >> 8, ~len & 255, (~len >> 8) & 255], raw.subarray(p, p + len));
    p += len;
  } while (p < raw.length);
  parts.push(u32be(adler32(raw)));
  return concat(parts);
}

type PngOpts = {
  width: number;
  height: number;
  colourType: 0 | 2 | 3 | 4 | 6;
  /** Pixel bytes per pixel in channel order (alpha last); for type 3 the palette index. */
  pixel: (x: number, y: number) => number[];
  palette?: number[][];
  trns?: number[];
  /** Filter type per row (0–4); default 0. */
  filter?: (y: number) => number;
  bitDepth?: number;
  interlace?: number;
  zlib?: boolean;
  /** Leave out IEND (a truncated file). */
  noEnd?: boolean;
};

const CH: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function png(o: PngOpts): Uint8Array {
  const ch = CH[o.colourType];
  const stride = o.width * ch;
  const raw = new Uint8Array((stride + 1) * o.height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < o.height; y++) {
    const row = new Uint8Array(stride);
    for (let x = 0; x < o.width; x++) row.set(o.pixel(x, y).slice(0, ch), x * ch);
    const f = o.filter ? o.filter(y) : 0;
    raw[y * (stride + 1)] = f;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? row[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
      raw[y * (stride + 1) + 1 + i] = (row[i] - pred) & 255;
    }
    prev = row;
  }
  const ihdr = [...u32be(o.width), ...u32be(o.height), o.bitDepth ?? 8, o.colourType, 0, 0, o.interlace ?? 0];
  const parts: (Uint8Array | number[])[] = [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk('IHDR', ihdr)];
  if (o.palette) parts.push(chunk('PLTE', o.palette.flat()));
  if (o.trns) parts.push(chunk('tRNS', o.trns));
  const z = o.zlib ? new Uint8Array(deflateSync(raw)) : zlibStored(raw);
  parts.push(chunk('IDAT', z));
  if (!o.noEnd) parts.push(chunk('IEND', []));
  return concat(parts);
}

const HERO_CACHE = new Map<string, Uint8Array>();

/** Hero art: RGBA, a centred opaque disc on a transparent background (cached by size). */
function heroPng(size: { width: number; height: number }): Uint8Array {
  const key = `${size.width}x${size.height}`;
  const hit = HERO_CACHE.get(key);
  if (hit) return hit;
  const { width, height } = size;
  const r = Math.min(width, height) * 0.4;
  const b = png({
    width,
    height,
    colourType: 6,
    pixel: (x, y) => {
      const inside = (x - width / 2) ** 2 + (y - height / 2) ** 2 < r * r;
      return inside ? [230, 220, 200, 255] : [0, 0, 0, 0];
    },
    filter: (y) => y % 5,
  });
  HERO_CACHE.set(key, b);
  return b;
}

let WALLPAPER: Uint8Array | null = null;
function wallpaperPng(): Uint8Array {
  if (!WALLPAPER) {
    WALLPAPER = png({
      ...ART_WALLPAPER_SIZE,
      colourType: 3,
      palette: [
        [10, 15, 36],
        [20, 30, 70],
      ],
      pixel: (_x, y) => [y < 1400 ? 0 : 1],
      zlib: true,
    });
  }
  return WALLPAPER;
}

const half = (s: HeroSize) => ({ width: HERO_REFERENCE_SIZES[s].width / 2, height: HERO_REFERENCE_SIZES[s].height / 2 });

const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
const PALETTE = { bg: '#0A0F24', tile: '#161C2E', glyph: '#FFFFFF', accent: '#F4D58D', text: '#EEF1FF' };
const META = {
  name: 'Test Night',
  mood: 'A quiet test sky.',
  tags: ['dark', 'stars'],
  credits: 'Glaze (original procedural art)',
  licence: 'original',
  generator: 'procedural',
  prompt: '',
};

function goodFiles(over: Record<string, Uint8Array | undefined> = {}): Record<string, Uint8Array | undefined> {
  return {
    'wallpaper.png': wallpaperPng(),
    'widget-small.png': heroPng(half('small')),
    'widget-medium.png': heroPng(half('medium')),
    'widget-large.png': heroPng(half('large')),
    'palette.json': enc(PALETTE),
    'meta.json': enc(META),
    ...over,
  };
}

// ------------------------------------------------------------------ PNG reading

test('readPngHeader reads IHDR and tRNS', () => {
  const h = readPngHeader(png({ width: 7, height: 3, colourType: 2, pixel: () => [1, 2, 3], trns: [0, 1, 0, 2, 0, 3] }));
  assert.ok(h.ok);
  if (h.ok) assert.deepEqual(h.header, { width: 7, height: 3, bitDepth: 8, colourType: 2, interlace: 0, hasTrns: true });
});

test('readPngHeader rejects broken files with a clear message', () => {
  const ok = png({ width: 2, height: 2, colourType: 0, pixel: () => [9] });
  const bad = ok.slice();
  bad[1] = 0;
  assert.match((readPngHeader(bad) as { error: string }).error, /signature/);
  assert.match((readPngHeader(png({ width: 2, height: 2, colourType: 0, pixel: () => [9], noEnd: true })) as { error: string }).error, /truncated/);
  assert.match((readPngHeader(new Uint8Array(4)) as { error: string }).error, /too short/);
  assert.match((readPngHeader(ok.slice(0, ok.length - 20)) as { error: string }).error, /past the end|truncated/);
});

test('pngAlphaStats unfilters every filter type and counts transparent pixels (RGBA)', () => {
  // 10 x 10; left 3 columns transparent = 30 %.
  const b = png({ width: 10, height: 10, colourType: 6, pixel: (x, y) => [x * 20, y * 20, 100, x < 3 ? 0 : 255], filter: (y) => y % 5 });
  const s = pngAlphaStats(b);
  assert.ok(s.ok);
  if (s.ok) assert.deepEqual(s.stats, { pixels: 100, transparent: 30, share: 0.3 });
  const sampled = pngAlphaStats(b, 2);
  assert.ok(sampled.ok && sampled.stats.pixels === 50 && sampled.stats.transparent === 15);
});

test('pngAlphaStats: grey + alpha, palette + tRNS and colour-key tRNS', () => {
  const ga = pngAlphaStats(png({ width: 4, height: 4, colourType: 4, pixel: (x) => [200, x === 0 ? 4 : 255], filter: () => 4 }));
  assert.ok(ga.ok && ga.stats.transparent === 4);
  const pal = pngAlphaStats(
    png({ width: 4, height: 2, colourType: 3, palette: [[0, 0, 0], [255, 0, 0]], trns: [0], pixel: (x) => [x % 2], filter: () => 1 }),
  );
  assert.ok(pal.ok && pal.stats.transparent === 4);
  const key = pngAlphaStats(png({ width: 3, height: 3, colourType: 2, trns: [0, 1, 0, 2, 0, 3], pixel: (x) => (x === 1 ? [1, 2, 3] : [9, 9, 9]) }));
  assert.ok(key.ok && key.stats.transparent === 3);
  const grey = pngAlphaStats(png({ width: 2, height: 2, colourType: 0, trns: [0, 7], pixel: (x) => [x ? 7 : 8] }));
  assert.ok(grey.ok && grey.stats.transparent === 2);
});

test('pngAlphaStats rejects 16-bit and interlaced PNGs with a clear message', () => {
  const deep = png({ width: 2, height: 2, colourType: 6, pixel: () => [0, 0, 0, 0], bitDepth: 16 });
  assert.match((pngAlphaStats(deep) as { error: string }).error, /bit depth 16 .*8-bit/);
  const inter = png({ width: 2, height: 2, colourType: 6, pixel: () => [0, 0, 0, 0], interlace: 1 });
  assert.match((pngAlphaStats(inter) as { error: string }).error, /interlaced/);
});

test('pngAlphaStats rejects corrupt image data', () => {
  const b = png({ width: 4, height: 4, colourType: 6, pixel: () => [1, 2, 3, 4], zlib: true });
  // Flip bytes in the middle of the compressed stream.
  const idat = b.indexOf(0x49, 33); // 'I' of IDAT
  const bad = b.slice();
  for (let i = idat + 8; i < idat + 14; i++) bad[i] ^= 0xff;
  const r = pngAlphaStats(bad);
  assert.equal(r.ok, false);
});

// ------------------------------------------------------------------ size rules

test('hero sizes: exact, same aspect ±1 % at least half size, never smaller or distorted', () => {
  for (const s of HERO_SIZES) {
    const ref = HERO_REFERENCE_SIZES[s];
    assert.ok(heroSizeOk(s, ref), s);
    assert.ok(heroSizeOk(s, half(s)), `${s} half`);
    assert.ok(heroSizeOk(s, { width: ref.width * 2, height: ref.height * 2 }), `${s} double`);
    assert.ok(!heroSizeOk(s, { width: ref.width / 2 - 2, height: Math.round((ref.height / ref.width) * (ref.width / 2 - 2)) }), `${s} too small`);
    assert.ok(!heroSizeOk(s, { width: ref.width, height: Math.round(ref.height * 1.03) }), `${s} aspect off 3 %`);
  }
  assert.deepEqual(HERO_REFERENCE_SIZES.small, { width: 510, height: 510 });
  assert.deepEqual(HERO_REFERENCE_SIZES.medium, { width: 1092, height: 510 });
  assert.deepEqual(HERO_REFERENCE_SIZES.large, { width: 1092, height: 1146 });
  assert.ok(heroSizeOk('medium', { width: 1100, height: 510 }), 'within 1 %');
});

test('pack ids are lower-case slugs', () => {
  for (const id of ['starry-night', 'abc', 'a1-b2']) assert.ok(isArtPackId(id), id);
  for (const id of ['ab', 'Starry', 'a--b', '-ab', 'ab-', '../x', 'a b', 'x'.repeat(41), 'é-pack']) assert.ok(!isArtPackId(id), id);
});

// ------------------------------------------------------------------ the validator

test('a complete pack validates, with its sizes and bytes', () => {
  const r = validateArtPack('test-night', goodFiles());
  assert.deepEqual(r.errors, []);
  assert.ok(r.ok && r.pack);
  assert.deepEqual(r.pack!.wallpaper, ART_WALLPAPER_SIZE);
  assert.deepEqual(r.pack!.heroes.medium, half('medium'));
  assert.equal(r.pack!.palette.tile, '#161C2E');
  assert.equal(r.pack!.meta.licence, 'original');
  assert.deepEqual(Object.keys(r.pack!.bytes).sort(), [...ART_PACK_FILES].sort());
});

test('missing and extra files', () => {
  const r = validateArtPack('test-night', goodFiles({ 'widget-small.png': undefined, 'notes.txt': new Uint8Array([1]) }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes('missing widget-small.png'));
  assert.ok(r.warnings.some((w) => w.includes('notes.txt')));
  assert.ok(validateArtPack('Bad Id', goodFiles()).errors.some((e) => e.includes('pack id')));
});

test('the wallpaper must be exactly 1290 x 2796', () => {
  const small = png({ width: 645, height: 1398, colourType: 2, pixel: () => [1, 2, 3], zlib: true });
  const r = validateArtPack('test-night', goodFiles({ 'wallpaper.png': small }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /wallpaper\.png: must be exactly 1290 x 2796, is 645 x 1398/.test(e)), r.errors.join('\n'));
  const notPng = validateArtPack('test-night', goodFiles({ 'wallpaper.png': new TextEncoder().encode('JFIF not a png at all, really not one') }));
  assert.ok(notPng.errors.some((e) => e.startsWith('wallpaper.png: not a PNG')));
});

test('hero art must be transparent: an alpha channel and actually transparent pixels', () => {
  const rgb = png({ ...half('small'), colourType: 2, pixel: () => [200, 10, 10] });
  const r1 = validateArtPack('test-night', goodFiles({ 'widget-small.png': rgb }));
  assert.ok(r1.errors.some((e) => /widget-small\.png: hero art must have transparency/.test(e)), r1.errors.join('\n'));
  const opaque = png({ ...half('small'), colourType: 6, pixel: () => [200, 10, 10, 255] });
  const r2 = validateArtPack('test-night', goodFiles({ 'widget-small.png': opaque }));
  assert.ok(r2.errors.some((e) => /widget-small\.png: no transparent background/.test(e)), r2.errors.join('\n'));
  // Palette art with tRNS counts.
  const pal = png({ ...half('small'), colourType: 3, palette: [[0, 0, 0], [250, 80, 40]], trns: [0], pixel: (x) => [x > 100 ? 1 : 0] });
  assert.deepEqual(validateArtPack('test-night', goodFiles({ 'widget-small.png': pal })).errors, []);
});

test('hero art with the wrong shape or bit depth is refused', () => {
  const wide = heroPng({ width: 400, height: 255 });
  const r = validateArtPack('test-night', goodFiles({ 'widget-small.png': wide }));
  assert.ok(r.errors.some((e) => /widget-small\.png: 400 x 255 must be 510 x 510/.test(e)), r.errors.join('\n'));
  const deep = png({ ...half('large'), colourType: 6, bitDepth: 16, pixel: () => [0, 0, 0, 0] });
  const r2 = validateArtPack('test-night', goodFiles({ 'widget-large.png': deep }));
  assert.ok(r2.errors.some((e) => /widget-large\.png: PNG bit depth 16/.test(e)));
});

test('palette: hex colours and contrast (glyph on tile, text on bg ≥ 4.5:1)', () => {
  assert.deepEqual(validatePalette(PALETTE).errors, []);
  assert.equal(validatePalette({ ...PALETTE, bg: '0A0F24' }).palette, null);
  assert.ok(validatePalette({ ...PALETTE, glyph: '#abc' }).errors.some((e) => e.includes('"glyph"')));
  assert.ok(validatePalette({ ...PALETTE, glyph: '#2A3048' }).errors.some((e) => /glyph on tile contrast/.test(e)));
  assert.ok(validatePalette({ ...PALETTE, text: '#3A3F60' }).errors.some((e) => /text on bg contrast/.test(e)));
  assert.equal(validatePalette({ ...PALETTE, glyph: '#ffffff' }).palette?.glyph, '#FFFFFF');
  assert.ok(validatePalette('nope').errors.length > 0);
  const r = validateArtPack('test-night', goodFiles({ 'palette.json': new TextEncoder().encode('{bad json') }));
  assert.ok(r.errors.includes('palette.json is not valid JSON'));
});

test('meta: required fields, licence allowlist, tags', () => {
  assert.deepEqual(validateMeta(META).errors, []);
  for (const k of ['name', 'mood', 'generator', 'licence', 'tags', 'credits', 'prompt']) {
    const m: Record<string, unknown> = { ...META };
    delete m[k];
    assert.ok(validateMeta(m).errors.length > 0, `missing ${k}`);
  }
  assert.ok(validateMeta({ ...META, licence: 'all-rights-reserved' }).errors.some((e) => e.includes('"licence"')));
  assert.ok(validateMeta({ ...META, tags: ['Dark'] }).errors.some((e) => e.includes('lower case')));
  assert.ok(validateMeta({ ...META, addedAt: 'yesterday' }).errors.length > 0);
  assert.equal(validateMeta({ ...META, addedAt: '2026-10-24' }).meta?.addedAt, '2026-10-24');
  for (const licence of ['original', 'CC0-1.0', 'public-domain', 'CC-BY-4.0', 'openai-output-owned']) {
    assert.deepEqual(validateMeta({ ...META, licence, generator: licence === 'openai-output-owned' ? 'openai-image' : 'procedural', prompt: 'x' }).errors, [], licence);
  }
  assert.ok(validateMeta({ ...META, generator: 'openai-image' }).warnings.some((w) => w.includes('prompt')));
  assert.ok(validateMeta({ ...META, generator: 'mystery' }).warnings.some((w) => w.includes('unknown generator')));
});

test('meta: space agency imagery needs a credit naming the agency', () => {
  for (const where of [{ tags: ['nasa'] }, { prompt: 'in the style of a Hubble deep field' }, { name: 'Webb Glow' }, { mood: 'JPL mission colours' }]) {
    const m = { ...META, credits: '', ...where };
    assert.ok(validateMeta(m).errors.some((e) => /must name the agency/.test(e)), JSON.stringify(where));
    const vague = { ...META, credits: 'Space people', ...where };
    assert.ok(validateMeta(vague).errors.some((e) => /does not name the agency/.test(e)), JSON.stringify(where));
    assert.deepEqual(validateMeta({ ...META, credits: 'NASA, ESA, CSA, STScI', ...where }).errors, [], JSON.stringify(where));
  }
  assert.ok(validateMeta({ ...META, licence: 'CC-BY-4.0', credits: '' }).errors.some((e) => e.includes('CC-BY-4.0 needs "credits"')));
  // "esa" inside another word does not count.
  assert.deepEqual(validateMeta({ ...META, mood: 'A mesa at dusk' }).errors, []);
});

test('meta: no brand or competitor names anywhere', () => {
  for (const where of [{ name: 'Widgetsmith Night' }, { tags: ['spotify'] }, { prompt: 'a Pokémon sky' }, { credits: 'Disney' }, { mood: 'like Themify' }]) {
    assert.ok(validateMeta({ ...META, ...where }).errors.some((e) => /brand or competitor name/.test(e)), JSON.stringify(where));
  }
  // Ordinary words are fine.
  assert.deepEqual(validateMeta({ ...META, mood: 'Apple orchard, a peach sky and a frozen lake halo', tags: ['apple', 'peach'] }).errors, []);
});

test('the validator never throws', () => {
  assert.equal(validateArtPack('test-night', {}).ok, false);
  assert.equal(validateArtPack('test-night', { 'wallpaper.png': new Uint8Array(0) }).ok, false);
  assert.equal(validateArtPack(undefined as unknown as string, goodFiles()).ok, false);
});

// ------------------------------------------------------------------ pack -> Theme

function samplePack(): ArtPackData {
  const r = validateArtPack('test-night', goodFiles());
  assert.ok(r.pack);
  return r.pack!;
}

test('artPackTheme maps the palette, keeps vector glyph icons and flags the image wallpaper', () => {
  const t = artPackTheme(samplePack());
  assert.equal(t.id, 'test-night');
  assert.equal(t.name, 'Test Night');
  assert.equal(t.tagline, 'A quiet test sky.');
  assert.equal(t.plus, false);
  assert.deepEqual(t.palette, { bg: '#0A0F24', surface: '#161C2E', accent: '#F4D58D', ink: '#EEF1FF', glyph: '#FFFFFF' });
  assert.deepEqual(t.iconStyle.background, { kind: 'solid', colour: '#161C2E' });
  assert.equal(t.iconStyle.glyphColour, '#FFFFFF');
  assert.equal(t.iconStyle.glyphSet, 'feather');
  assert.equal(t.iconStyle.art?.stickers.length, 0);
  assert.equal(t.iconStyle.art?.texture, 'none');
  assert.equal(t.widget.accent, '#F4D58D');
  assert.equal(t.widget.style, 'glass');
  assert.ok(t.wallpaper.colours.length >= 2 && t.wallpaper.colours.every(isHex));
  assert.equal(t.wallpaper.kind, 'gradient');
  assert.ok(t.categories?.includes('dark'));
  assert.ok(t.tags?.includes('art') && t.tags?.includes('stars'));
  assert.deepEqual(t.artPack, {
    id: 'test-night',
    wallpaperImage: true,
    heroes: ['small', 'medium', 'large'],
    credits: 'Glaze (original procedural art)',
    licence: 'original',
    generator: 'procedural',
  });
  assert.ok(isArtPackTheme(t));
  assert.ok(!isArtPackTheme(THEMES[0]));
  assert.ok(contrastRatio(t.iconStyle.glyphColour, '#161C2E') >= 4.5);
  // Icons resolve through the normal icon path (vector glyphs).
  const specs = previewSpecs(t, 4);
  assert.equal(specs.length, 4);
  for (const s of specs) {
    assert.equal(s.overrideImage, undefined);
    assert.deepEqual(s.background, { kind: 'solid', colour: '#161C2E' });
  }
  assert.deepEqual(artPackCreditParams(t.artPack), { credit: 'Glaze (original procedural art)', licence: 'Original artwork' });
});

// ------------------------------------------------------------------ the shipped packs

function packDirs(): string[] {
  const dir = join(root, ART_PACK_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => !n.startsWith('.') && statSync(join(dir, n)).isDirectory())
    .sort();
}

function readPack(id: string): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  for (const f of readdirSync(join(root, ART_PACK_DIR, id))) files[f] = new Uint8Array(readFileSync(join(root, ART_PACK_DIR, id, f)));
  return files;
}

const SHIPPED = packDirs().map((id) => ({ id, report: validateArtPack(id, readPack(id), { alphaRowStep: 2 }) }));

test('T132: the three starter packs ship and validate with no errors or warnings, within the size budget', () => {
  assert.deepEqual(
    SHIPPED.map((p) => p.id),
    ['deep-sea', 'starry-night', 'sunset-dunes'],
  );
  let total = 0;
  for (const { id, report } of SHIPPED) {
    assert.deepEqual(report.errors, [], id);
    assert.deepEqual(report.warnings, [], id);
    const b = report.pack!.bytes;
    assert.ok(b['wallpaper.png'] <= ART_BYTE_BUDGET.wallpaper, `${id} wallpaper ${b['wallpaper.png']}`);
    for (const s of HERO_SIZES) assert.ok(b[HERO_FILES[s]] <= ART_BYTE_BUDGET.hero, `${id} ${s} ${b[HERO_FILES[s]]}`);
    for (const s of HERO_SIZES) assert.deepEqual(report.pack!.heroes[s], HERO_REFERENCE_SIZES[s], `${id} ${s} at the reference size`);
    assert.equal(report.pack!.meta.licence, 'original');
    assert.equal(report.pack!.meta.generator, 'procedural');
    assert.match(report.pack!.meta.credits, /Glaze/);
    total += Object.values(b).reduce((a, n) => a + n, 0);
    // Only the format's files are in the folder.
    assert.deepEqual(readdirSync(join(root, ART_PACK_DIR, id)).sort(), [...ART_PACK_FILES].sort(), id);
  }
  assert.ok(total <= 1_800_000, `all packs ${total} bytes`);
});

test('the generated library and asset map are in sync with themes/ (run node scripts/import-theme-packs.mjs --regenerate)', () => {
  const packs = SHIPPED.filter((p) => p.report.ok).map((p) => p.report.pack!);
  assert.equal(readFileSync(join(root, ART_LIBRARY_PATH), 'utf8'), artPackLibrarySource(packs), `${ART_LIBRARY_PATH} is stale`);
  assert.equal(
    readFileSync(join(root, ART_ASSETS_PATH), 'utf8'),
    artPackAssetsSource(packs.map((p) => p.id)),
    `${ART_ASSETS_PATH} is stale`,
  );
  // Every require() path in the asset map exists.
  const assets = readFileSync(join(root, ART_ASSETS_PATH), 'utf8');
  for (const m of assets.matchAll(/require\('\.\.\/\.\.\/([^']+)'\)/g)) assert.ok(existsSync(join(root, m[1])), m[1]);
});

test('art-pack themes resolve everywhere: getAnyTheme, free marks, no clashes with built-in ids', () => {
  assert.deepEqual(
    ART_PACK_THEMES.map((t) => t.id),
    ['deep-sea', 'starry-night', 'sunset-dunes'],
  );
  const builtIn = new Set([...ALL_THEMES, ...SPACE_THEMES].map((t) => t.id));
  for (const t of ART_PACK_THEMES) {
    assert.ok(!builtIn.has(t.id), `${t.id} clashes with a built-in theme`);
    assert.equal(getAnyTheme(t.id), t);
    assert.equal(artPackThemeById(t.id), t);
    assert.equal(artPackOf(t.id), t);
    assert.equal(artPackOf(t), t);
    assert.ok(isFreeMarked(t.id), `${t.id} shows the Free pill`);
    assert.equal(t.plus, false);
    assert.ok(contrastRatio(t.palette.glyph, t.palette.surface) >= 4.5);
    assert.ok(contrastRatio(t.palette.ink, t.palette.bg) >= 4.5);
  }
  assert.equal(artPackOf('strawberry-dessert'), null);
  assert.equal(artPackOf(null), null);
});

test('the starter packs are original and brand-free', () => {
  const COMPETITORS = /themify|icon themer|myscreen|screenkit|widgetsmith|intolive|loopy|lockio/i;
  for (const t of ART_PACK_THEMES) {
    const text = JSON.stringify(t);
    assert.doesNotMatch(text, COMPETITORS);
    assert.doesNotMatch(text, /nasa|esa\b|hubble|webb/i);
  }
  const script = readFileSync(join(root, 'scripts', 'brand', 'make-starter-packs.py'), 'utf8');
  assert.doesNotMatch(script, /urllib|requests\.|http:\/\/|https:\/\//, 'no network images');
});

// ------------------------------------------------------------------ the importer script

function runImporter(args: string[]): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'import-theme-packs.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('the importer runs under Node: validates a folder of packs and reports (dry run writes nothing)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glaze-art-'));
  try {
    cpSync(join(root, ART_PACK_DIR, 'starry-night'), join(dir, 'starry-copy'), { recursive: true });
    mkdirSync(join(dir, 'broken'));
    writeFileSync(join(dir, 'broken', 'meta.json'), JSON.stringify({ ...META, licence: 'mine' }));
    cpSync(join(root, ART_PACK_DIR, 'deep-sea'), join(dir, 'deep-sea'), { recursive: true });
    const before = readFileSync(join(root, ART_LIBRARY_PATH), 'utf8');
    const r = runImporter([dir, '--dry-run']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /OK {5}starry-copy/);
    assert.match(r.out, /FAILED broken/);
    assert.match(r.out, /missing wallpaper\.png/);
    assert.match(r.out, /"licence" must be one of/);
    assert.match(r.out, /themes\/deep-sea already exists; pass --replace/);
    assert.match(r.out, /1 valid, 2 failed/);
    assert.ok(!existsSync(join(root, ART_PACK_DIR, 'starry-copy')), 'dry run copied nothing');
    assert.equal(readFileSync(join(root, ART_LIBRARY_PATH), 'utf8'), before);
    // A clean folder passes.
    rmSync(join(dir, 'broken'), { recursive: true });
    rmSync(join(dir, 'deep-sea'), { recursive: true });
    const ok = runImporter([dir, '--dry-run']);
    assert.equal(ok.status, 0, ok.out);
    // Bad usage.
    assert.equal(runImporter([]).status, 2);
    assert.equal(runImporter([dir, '--nope']).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the importer refuses an id that is already a built-in theme', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glaze-art-'));
  try {
    cpSync(join(root, ART_PACK_DIR, 'starry-night'), join(dir, 'strawberry-dessert'), { recursive: true });
    const r = runImporter([dir, '--dry-run']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /already a built-in theme/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--regenerate --dry-run checks themes/ without writing', () => {
  const r = runImporter(['--regenerate', '--dry-run']);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /would write .* with 3 pack\(s\)/);
});
