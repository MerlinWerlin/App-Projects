// T275b: build_packs.mjs --themes <glaze-theme-reviews> builds Codex's review folders directly
// (wallpapers/wallpaper.png, catalogue palette, generated meta, decorative widgets as art), the way
// scripts/prepare-reviewed-packs.mjs reads them. Offline; tiny PNG fixtures made here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPacks, isReviewLayout, pickEncoder, reviewMeta, reviewOptionId } from './build_packs.mjs';
import { encodePng } from './png.mjs';

process.removeAllListeners('warning');
const { parseRemoteArtManifest } = await import('../../src/core/packCatalog.ts');
const { validateWidgetOptions } = await import('../../src/core/widgetOptions.ts');
const { liveArtPlan, withLiveArt } = await import('../../src/core/liveArt.ts');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const quiet = () => {};
const tmp = (p) => mkdtempSync(join(tmpdir(), `glaze-${p}-`));
const APP_THEMES = fileURLToPath(new URL('../../themes', import.meta.url));

function facePng(r, g, b, w = 64, h = 64) {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([r, g, b, 255], i * 4);
  return encodePng(w, h, rgba);
}

const FRAMES = {
  clock: { rect: [0.18, 0.18, 0.64, 0.64], shape: 'circle' },
  date: { rect: [0.18, 0.16, 0.64, 0.68], shape: 'plate' },
  focus: { rect: [0.2, 0.2, 0.6, 0.6], shape: 'circle' },
  battery: { rect: [0.22, 0.27, 0.56, 0.46], shape: 'plate' },
};

/** A review root like glaze-theme-reviews: release-simulation/catalogue.json + NNN-<id> folders. */
function makeReviewRoot() {
  const root = tmp('reviews');
  const theme = '001-alpine-starlight';
  const dir = join(root, theme);
  const wdir = join(dir, 'widgets');
  mkdirSync(join(dir, 'wallpapers'), { recursive: true });
  mkdirSync(join(wdir, 'reviewed'), { recursive: true });
  writeFileSync(join(dir, 'wallpapers', 'wallpaper.png'), facePng(15, 18, 23, 60, 130));
  writeFileSync(join(dir, 'source-and-prompts.json'), JSON.stringify({ set: '001 Alpine Starlight', source: { photographer: 'Ana Lee', page: 'https://example.com/p' } }));
  // Runtime faces + themed clock profile, as the export scripts write them.
  const runtime = ['clock', 'date', 'focus', 'battery'].map((kind, i) => {
    const image = `runtime-${kind}-face-20261101.png`;
    const bytes = facePng(10 + i * 30, 40, 90);
    writeFileSync(join(wdir, image), bytes);
    return { id: `live-${kind}`, kind, image, sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'theme', label: kind, numberFree: true, liveFrame: FRAMES[kind], sha256: sha(bytes), bytes: bytes.length };
  });
  writeFileSync(join(wdir, 'runtime-options-20261101.json'), JSON.stringify({ theme, widgets: runtime }));
  const clockBg = facePng(5, 5, 5, 80, 80);
  writeFileSync(join(wdir, 'native-clock-background-20261102.png'), clockBg);
  const option = { id: 'themed-live-clock', kind: 'clock', image: `C:\\reviews\\${theme}\\widgets\\native-clock-background-20261102.png`, sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur', label: 'Art clock · live', numberFree: true, liveFrame: { rect: [0.105, 0.075, 0.79, 0.79], shape: 'circle', clockStyle: 'analog', ink: '#EEECE3' } };
  writeFileSync(join(wdir, 'themed-clock-20261102.json'), JSON.stringify({ id: theme, source: `${theme}/widgets/native-clock-background-20261102.png`, sourceSha256: sha(clockBg), option }));
  // Decorative pieces: a painted clock concept, a duplicate, an overridden file, a prefixed preview.
  writeFileSync(join(wdir, 'constellation-clock-preview.png'), facePng(120, 130, 140));
  writeFileSync(join(wdir, 'aurora.png'), facePng(150, 160, 170));
  writeFileSync(join(wdir, 'zz-same-as-aurora.png'), facePng(150, 160, 170));
  writeFileSync(join(wdir, 'glasswing.png'), facePng(1, 1, 1));
  writeFileSync(join(wdir, 'reviewed', 'glasswing.png'), facePng(200, 210, 220));
  writeFileSync(join(wdir, 'production-20261101-moon-gate-preview.png'), facePng(60, 70, 80));
  // Two broken review folders: no palette anywhere; no widget at all.
  for (const f of ['002-no-palette', '003-no-widgets']) {
    mkdirSync(join(root, f, 'wallpapers'), { recursive: true });
    writeFileSync(join(root, f, 'wallpapers', 'wallpaper.png'), facePng(30, 30, 30, 60, 130));
    writeFileSync(join(root, f, 'source-and-prompts.json'), '{}');
  }
  mkdirSync(join(root, '002-no-palette', 'widgets'));
  writeFileSync(join(root, '002-no-palette', 'widgets', 'piece.png'), facePng(9, 9, 9));
  mkdirSync(join(root, 'release-simulation'), { recursive: true });
  writeFileSync(
    join(root, 'release-simulation', 'catalogue.json'),
    JSON.stringify({
      themes: [
        { id: theme, background: '#0f1217', foreground: '#eeece3', widgets: [{ file: `${theme}/widgets/reviewed/glasswing.png`, originalFile: `${theme}/widgets/glasswing.png` }] },
        { id: '003-no-widgets', background: '#000000', foreground: '#ffffff', widgets: [] },
      ],
    }),
  );
  // A normal-layout theme next to them builds exactly as before.
  cpSync(join(APP_THEMES, 'deep-sea'), join(root, 'deep-sea'), { recursive: true });
  return root;
}

test('T275b: helpers mirror prepare-reviewed-packs.mjs (option ids, meta)', () => {
  assert.equal(reviewOptionId('production-20261101-moon-gate-preview.png'), 'moon-gate');
  assert.equal(reviewOptionId('audit-20261101-foam-feather.png'), 'foam-feather');
  assert.equal(reviewOptionId('extra-20261029-Paper_Boat.png'), 'paper-boat');
  assert.ok(reviewOptionId('x'.repeat(39) + '-y.png').length <= 40);
  assert.ok(!reviewOptionId('x'.repeat(39) + '-y.png').endsWith('-'));
  const m = reviewMeta('001-alpine-starlight', { set: '001 Alpine Starlight', source: { photographer: 'Ana Lee', page: 'https://example.com/p' } });
  assert.equal(m.name, 'Alpine Starlight');
  assert.equal(m.credits, 'Glaze theme artwork; reference photograph by Ana Lee (https://example.com/p).');
  assert.equal(m.licence, 'openai-output-owned');
  assert.equal(reviewMeta('004-desert-afterglow', {}).name, 'desert afterglow');
  assert.equal(reviewMeta('004-desert-afterglow', {}).credits, 'Glaze generated theme artwork and original UI geometry.');
});

test('T275b: --themes <reviews root> builds review folders directly; normal folders unchanged', async () => {
  const root = makeReviewRoot();
  const out = tmp('reviews-out');
  const ref = tmp('reviews-ref');
  try {
    assert.equal(isReviewLayout(join(root, '001-alpine-starlight')), true);
    assert.equal(isReviewLayout(join(root, 'deep-sea')), false);
    const logs = [];
    const now = new Date('2026-11-02T00:00:00Z');
    const r = await buildPacks({ themesDir: root, outDir: out, versionsFile: null, log: (l) => logs.push(l), encoder: 'png', now });
    assert.deepEqual(r.failed.sort(), ['no-palette', 'no-widgets']);
    assert.ok(logs.some((l) => /no palette\.json and no 002-no-palette entry/.test(l)), logs.join('\n'));
    assert.ok(logs.some((l) => /no widget option/.test(l)));
    assert.ok(!logs.some((l) => /(FAILED|OK) +release-simulation/.test(l)), 'the snapshot folder is not a theme');
    assert.deepEqual(r.built.map((b) => b.id).sort(), ['alpine-starlight', 'deep-sea']);

    const m = JSON.parse(readFileSync(join(out, 'art/alpine-starlight/v1/manifest.json'), 'utf8'));
    assert.equal(m.version, 2);
    assert.equal(m.name, 'Alpine Starlight');
    assert.deepEqual(m.palette, { bg: '#0F1217', tile: '#0F1217', glyph: '#EEECE3', accent: '#EEECE3', text: '#EEECE3' });
    assert.equal(m.meta.addedAt, '2026-11-01');
    assert.deepEqual(m.assets.filter((a) => /^widget-(small|medium|large)$/.test(a.role)), [], 'no hero files needed');
    assert.deepEqual(m.widgets.map((w) => w.id), ['themed-live-clock', 'live-clock', 'live-date', 'live-focus', 'live-battery', 'aurora', 'constellation-clock-concept', 'glasswing', 'moon-gate']);
    const glass = m.widgets.find((w) => w.id === 'glasswing');
    assert.equal(m.assets.find((a) => a.path === glass.image).sha256, sha(facePng(200, 210, 220)), 'catalogue override file is used');
    assert.equal(m.widgets.find((w) => w.id === 'moon-gate').kind, 'art');
    assert.equal(m.widgets.find((w) => w.id === 'moon-gate').label, 'moon gate');
    assert.equal(m.widgets[1].label, 'Plain clock (fallback)');
    const pm = parseRemoteArtManifest(m, 'alpine-starlight');
    assert.equal(pm.ok, true, pm.ok ? '' : pm.error);
    assert.deepEqual(validateWidgetOptions(m.widgets, m.assets), []);
    const plan = liveArtPlan('alpine-starlight', pm.value.widgets[0]);
    assert.equal(plan.kind, 'clock');
    assert.equal(plan.clockStyle, 'analog');
    assert.equal(withLiveArt('alpine-starlight', pm.value.widgets).filter((w) => w.liveArt).length, 5);
    assert.deepEqual(r.catalog.packs.find((p) => p.id === 'alpine-starlight').tags, ['review-candidate']);

    // deep-sea next to review folders: byte-identical to a build of the repo's themes/deep-sea.
    await buildPacks({ outDir: ref, versionsFile: null, log: quiet, encoder: 'png', only: new Set(['deep-sea']), now });
    const files = readdirSync(join(ref, 'art/deep-sea/v1')).sort();
    assert.deepEqual(readdirSync(join(out, 'art/deep-sea/v1')).sort(), files);
    for (const f of files) assert.ok(readFileSync(join(ref, 'art/deep-sea/v1', f)).equals(readFileSync(join(out, 'art/deep-sea/v1', f))), f);
  } finally {
    for (const d of [root, out, ref]) rmSync(d, { recursive: true, force: true });
  }
});

test('T275b: review folders with the WebP encoder (when Pillow or sharp is present)', async (t) => {
  const enc = await pickEncoder('auto');
  if (enc.kind === 'png') return t.skip('no WebP encoder');
  const root = makeReviewRoot();
  const out = tmp('reviews-webp');
  try {
    const r = await buildPacks({ themesDir: root, outDir: out, versionsFile: null, log: quiet, only: new Set(['001-alpine-starlight']) });
    assert.deepEqual(r.failed, []);
    const m = JSON.parse(readFileSync(join(out, 'art/alpine-starlight/v1/manifest.json'), 'utf8'));
    assert.deepEqual(m.assets.filter((a) => a.role === 'wallpaper').map((a) => `${a.width}x${a.height}`), ['1290x2796', '1179x2556', '750x1334']);
    assert.ok(m.assets.every((a) => a.mime === 'image/webp'));
    assert.equal(parseRemoteArtManifest(m, 'alpine-starlight').ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});
