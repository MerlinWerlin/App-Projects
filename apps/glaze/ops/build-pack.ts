// Build a Glaze theme pack (T46, docs/THEME_PACKS.md).
//
//   node ops/build-pack.ts                      # writes the test fixtures for every downloadable pack
//   node ops/build-pack.ts --out dist/packs     # writes dist/packs/<pack id>/ for publishing
//
// Packs: pack-aurora-2026 (T46) and pack-storyplay-2026 (T104).
//
// Output: <out>/<pack id>/manifest.json, art/<theme id>.json.gz and thumbs/<theme id>.png. Upload the <pack id> folder
// as-is under PACK_BASE_URL (see "How to publish" in docs/THEME_PACKS.md). Pure Node, no installs.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { deflateSync, gzipSync } from 'node:zlib';
import { hexToRgb } from '../src/core/colour.ts';
import { crc32 } from '../src/core/inflate.ts';
import type { Theme } from '../src/core/themes.ts';
import { AURORA_PACK_ID, NEW_PLUS_THEMES } from '../src/core/themesNew.ts';
import { STORYPLAY_PACK_ID, STORYPLAY_PACK_NAME, STORYPLAY_PLUS_THEMES } from '../src/core/themesStoryPlay.ts';
import { MANIFEST_FILE, buildPack, formatBytes, manifestBytes } from '../src/core/themePack.ts';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outRoot = resolve(outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : 'src/core/__fixtures__/packs');
const minIdx = args.indexOf('--min-app');
const minAppVersion = minIdx >= 0 && args[minIdx + 1] ? args[minIdx + 1] : '0.1.0';

// ------------------------------------------------------------ tiny PNG encoder (thumbnails)

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** A small phone-shaped preview: the wallpaper colours as a vertical gradient, accent icon dots. */
function thumbnail(t: Theme): Uint8Array {
  const W = 48;
  const H = 104;
  const stops = t.wallpaper.colours.map((c) => hexToRgb(c));
  const accent = hexToRgb(t.palette.accent);
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const f = (y / (H - 1)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(f));
    const k = f - i;
    const a = stops[i];
    const b = stops[i + 1];
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      let r = a.r + (b.r - a.r) * k;
      let g = a.g + (b.g - a.g) * k;
      let bl = a.b + (b.b - a.b) * k;
      // A 4 x 3 grid of "icons" in the top half.
      const cx = (x % 12) - 6;
      const cy = ((y - 14) % 14) - 5;
      if (y >= 14 && y < 56 && cx * cx + cy * cy <= 12) {
        r = accent.r;
        g = accent.g;
        bl = accent.b;
      }
      raw[row + 1 + x * 3] = Math.round(r);
      raw[row + 2 + x * 3] = Math.round(g);
      raw[row + 3 + x * 3] = Math.round(bl);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

const PACKS: { id: string; name: string; themes: readonly Theme[] }[] = [
  { id: AURORA_PACK_ID, name: 'Aurora', themes: NEW_PLUS_THEMES },
  { id: STORYPLAY_PACK_ID, name: STORYPLAY_PACK_NAME, themes: STORYPLAY_PLUS_THEMES },
];

for (const p of PACKS) {
  const built = buildPack({ id: p.id, name: p.name, minAppVersion, themes: p.themes, thumbnail }, (b) => gzipSync(b, { level: 9 }));
  const dir = join(outRoot, built.manifest.id);
  rmSync(dir, { recursive: true, force: true });
  for (const f of built.files) {
    const fp = join(dir, f.path);
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, f.bytes);
  }
  const manifest = manifestBytes(built.manifest);
  writeFileSync(join(dir, MANIFEST_FILE), manifest);
  console.log(
    `${built.manifest.id}: ${built.manifest.themes.length} themes, ${built.files.length} assets, ` +
      `${formatBytes(built.manifest.totalBytes, 'en')} + ${formatBytes(manifest.length, 'en')} manifest -> ${dir}`,
  );
}
