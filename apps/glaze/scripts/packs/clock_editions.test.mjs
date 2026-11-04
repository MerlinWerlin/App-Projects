// T275 (owner-1102a A3 / A4): build_packs.mjs turns Codex's per-theme widget exports (themed clock
// profile, clean runtime faces, themes 101-146 widget-options.json) into remote-art v2 widget options.
// Offline; fixtures are tiny PNGs made here. Run: node --test "scripts/packs/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPacks, packIdOfFolder, pickEncoder, readWidgetEditions } from './build_packs.mjs';
import { encodePng } from './png.mjs';

process.removeAllListeners('warning');
const { parseRemoteArtManifest } = await import('../../src/core/packCatalog.ts');
const { validateWidgetOptions } = await import('../../src/core/widgetOptions.ts');
const { liveArtPlan, withLiveArt } = await import('../../src/core/liveArt.ts');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const quiet = () => {};
const tmp = (p) => mkdtempSync(join(tmpdir(), `glaze-${p}-`));
const APP_THEMES = fileURLToPath(new URL('../../themes', import.meta.url));

/** A small opaque PNG of one colour (each colour gives different bytes). */
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

/** A theme folder like Codex's exports: deep-sea's pack files + widgets/ with the export files. */
function makeEditionTheme(root, folder, { profileSource, runtime = ['clock', 'date', 'focus', 'battery'], list, missing = [], badSha = [] } = {}) {
  const dir = join(root, folder);
  cpSync(join(APP_THEMES, 'deep-sea'), dir, { recursive: true });
  const wdir = join(dir, 'widgets');
  mkdirSync(wdir, { recursive: true });
  const widgets = runtime.map((kind, i) => {
    const image = `runtime-${kind}-face-20261101.png`;
    const bytes = facePng(10 + i * 30, 40, 90);
    if (!missing.includes(kind)) writeFileSync(join(wdir, image), bytes);
    const label = { clock: 'Live clock', date: 'Today', focus: 'Focus session', battery: 'Battery level' }[kind];
    return { id: `live-${kind}`, kind, image, sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'theme', label, numberFree: true, liveFrame: FRAMES[kind], sha256: badSha.includes(kind) ? '0'.repeat(64) : sha(bytes), bytes: bytes.length };
  });
  if (runtime.length) writeFileSync(join(wdir, 'runtime-options-20261101.json'), JSON.stringify({ theme: folder, widgets }, null, 2));
  if (profileSource !== undefined) {
    const art = facePng(200, 120, 30, 96, 80);
    writeFileSync(join(wdir, 'decorative.png'), art);
    // As prepare-themed-clocks.mjs writes it: the image is the absolute path on the PC that ran it.
    const option = { id: 'themed-live-clock', kind: 'clock', image: `C:\\Users\\jared\\glaze-theme-reviews\\${folder}\\widgets\\decorative.png`, sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur', label: 'Art clock · live', numberFree: true, liveFrame: { rect: [0.12, 0.81, 0.76, 0.14], shape: 'plate', clockStyle: 'digital', ink: '#F5F3EC' } };
    writeFileSync(join(wdir, 'themed-clock-20261102.json'), JSON.stringify({ id: folder, source: profileSource, sourceSha256: sha(art), option }, null, 2));
  }
  if (list) {
    for (const o of list) writeFileSync(join(wdir, o.image), facePng(o.r ?? 1, 2, 3));
    writeFileSync(join(wdir, 'widget-options.json'), JSON.stringify({ widgets: list.map(({ r, ...o }) => o) }, null, 2));
  }
  return dir;
}

test('clock editions: themed clock first, live runtime faces, fallback label, v2 manifest that parses', async () => {
  const root = tmp('editions');
  const out = tmp('editions-out');
  try {
    makeEditionTheme(root, '101-alpine-starlight', { profileSource: '101-alpine-starlight/widgets/decorative.png' });
    const logs = [];
    const r = await buildPacks({ themesDir: root, outDir: out, versionsFile: null, log: (l) => logs.push(l), encoder: 'png' });
    assert.deepEqual(r.failed, []);
    assert.deepEqual(r.built.map((b) => b.id), ['alpine-starlight']);
    const m = JSON.parse(readFileSync(join(out, 'art/alpine-starlight/v1/manifest.json'), 'utf8'));
    assert.equal(m.version, 2);
    const pm = parseRemoteArtManifest(m, 'alpine-starlight');
    assert.equal(pm.ok, true, pm.ok ? '' : pm.error);
    assert.deepEqual(validateWidgetOptions(m.widgets, m.assets), []);
    assert.deepEqual(m.widgets.map((w) => w.id), ['themed-live-clock', 'live-clock', 'live-date', 'live-focus', 'live-battery', 'hero-small', 'hero-medium', 'hero-large']);
    const [themed, plain] = m.widgets;
    assert.equal(themed.background, 'blur');
    assert.equal(themed.label, 'Art clock · live');
    assert.deepEqual(themed.liveFrame, { rect: [0.12, 0.81, 0.76, 0.14], shape: 'plate', clockStyle: 'digital', ink: '#F5F3EC' });
    assert.equal(plain.label, 'Plain clock (fallback)');
    assert.equal(m.widgets[2].label, 'Today');
    for (const w of m.widgets.slice(0, 5)) {
      assert.equal(w.numberFree, true);
      assert.ok(w.liveFrame, w.id);
      assert.ok(!('sha256' in w) && !('bytes' in w), 'export-only fields are dropped');
      const a = m.assets.find((x) => x.path === w.image);
      assert.equal(a.role, 'widget-art');
      assert.equal(sha(readFileSync(join(out, 'art/alpine-starlight/v1', a.path))), a.sha256);
    }
    const live = withLiveArt('alpine-starlight', pm.value.widgets);
    const clocks = live.filter((w) => liveArtPlan('alpine-starlight', w)?.kind === 'clock');
    assert.deepEqual(clocks.map((w) => w.id), ['themed-live-clock', 'live-clock']);
    assert.equal(liveArtPlan('alpine-starlight', pm.value.widgets[0]).clockStyle, 'digital');
    assert.equal(live.filter((w) => w.liveArt).length, 5);
    assert.ok(!logs.some((l) => /warning: alpine/.test(l)), logs.join('\n'));
    // Folder ids: NNN- is stripped; --only takes either form.
    assert.equal(packIdOfFolder('101-alpine-starlight'), 'alpine-starlight');
    assert.equal(packIdOfFolder('deep-sea'), 'deep-sea');
    const r2 = await buildPacks({ themesDir: root, outDir: out, versionsFile: null, log: quiet, encoder: 'png', only: new Set(['101-alpine-starlight']) });
    assert.deepEqual(r2.built.map((b) => b.id), ['alpine-starlight']);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test('clock editions: the profile image resolves via the theme folder; missing / changed images are skipped with a warning', () => {
  const root = tmp('editions-resolve');
  try {
    // Plain-id folder while the profile names the review folder: falls back to the theme folder.
    const plain = makeEditionTheme(root, 'opal-abyss', { profileSource: '012-opal-abyss/widgets/decorative.png', missing: ['battery'], badSha: ['date'] });
    const e = readWidgetEditions(plain, root);
    assert.deepEqual(e.errors, []);
    assert.deepEqual(e.items.map((i) => i.option.id), ['themed-live-clock', 'live-clock', 'live-focus']);
    assert.equal(e.items[0].src, join(plain, 'widgets', 'decorative.png'));
    assert.equal(e.warnings.length, 2, e.warnings.join('\n'));
    assert.ok(e.warnings.some((w) => /live-battery.*not found/.test(w)));
    assert.ok(e.warnings.some((w) => /live-date.*sha256/.test(w)));
    // The source path relative to the reviews root wins when it exists.
    const review = makeEditionTheme(root, '013-crimson-reverie', { profileSource: '013-crimson-reverie/widgets/decorative.png' });
    assert.equal(readWidgetEditions(review, root).items[0].src, join(root, '013-crimson-reverie/widgets/decorative.png'));
    // Profile image gone everywhere: a warning, not a crash.
    rmSync(join(plain, 'widgets', 'decorative.png'));
    const e2 = readWidgetEditions(plain, root);
    assert.deepEqual(e2.items.map((i) => i.option.id), ['live-clock', 'live-focus']);
    assert.ok(e2.warnings.some((w) => /themed-live-clock.*not found/.test(w)));
    // No widgets folder / no export files: nothing to do.
    const bare = join(root, 'bare');
    cpSync(join(APP_THEMES, 'deep-sea'), bare, { recursive: true });
    assert.equal(readWidgetEditions(bare, root), null);
    mkdirSync(join(bare, 'widgets'));
    writeFileSync(join(bare, 'widgets', 'notes.txt'), 'x');
    assert.equal(readWidgetEditions(bare, root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('A4: widget-options.json kind aliases are written as canonical kinds; an unknown kind fails only that pack', async () => {
  const root = tmp('editions-alias');
  const out = tmp('editions-alias-out');
  try {
    const frame = { rect: [0.2, 0.2, 0.6, 0.6], shape: 'circle' };
    makeEditionTheme(root, '101-glass-harbour', {
      runtime: [],
      list: [
        { id: 'harbour-digital', kind: 'digitalClock', image: 'a.png', sizes: ['small'], numberFree: true, liveFrame: frame, r: 11 },
        { id: 'harbour-analog', kind: 'analog clock', image: 'b.png', sizes: ['small'], numberFree: true, liveFrame: frame, r: 22 },
        { id: 'harbour-analog-2', kind: 'Analog-Clock', image: 'c.png', sizes: ['small'], numberFree: true, r: 33 },
        { id: 'harbour-date', kind: 'dateCalendar', image: 'd.png', sizes: ['small', 'medium'], numberFree: true, r: 44 },
        { id: 'harbour-focus', kind: 'focusTimer', image: 'e.png', sizes: ['small'], numberFree: true, r: 55 },
        { id: 'harbour-countdown', kind: 'countdown', image: 'f.png', sizes: ['small'], numberFree: true, r: 66 },
        { id: 'harbour-battery', kind: 'battery', image: 'g.png', sizes: ['small'], numberFree: true, r: 77 },
        { id: 'harbour-art', kind: 'art', image: 'h.png', sizes: ['large'], r: 88 },
      ],
    });
    makeEditionTheme(root, '102-bad-kinds', { runtime: [], list: [{ id: 'weird', kind: 'stopwatch', image: 'z.png', sizes: ['small'] }] });
    const logs = [];
    const r = await buildPacks({ themesDir: root, outDir: out, versionsFile: null, log: (l) => logs.push(l), encoder: 'png' });
    assert.deepEqual(r.failed, ['bad-kinds']);
    assert.ok(logs.some((l) => /unknown kind stopwatch/.test(l)));
    const m = JSON.parse(readFileSync(join(out, 'art/glass-harbour/v1/manifest.json'), 'utf8'));
    const kinds = Object.fromEntries(m.widgets.map((w) => [w.id, w.kind]));
    assert.deepEqual(kinds, {
      'harbour-digital': 'clock',
      'harbour-analog': 'clock',
      'harbour-analog-2': 'clock',
      'harbour-date': 'date',
      'harbour-focus': 'focus',
      'harbour-countdown': 'countdown',
      'harbour-battery': 'battery',
      'harbour-art': 'art',
      'hero-small': 'art',
      'hero-medium': 'art',
      'hero-large': 'art',
    });
    assert.equal(m.widgets[0].liveFrame.clockStyle, 'digital');
    assert.equal(m.widgets[1].liveFrame.clockStyle, 'analog');
    assert.equal(m.widgets[2].liveFrame, undefined);
    // Every kind written is one the app parser knows: nothing is dropped.
    const pm = parseRemoteArtManifest(m, 'glass-harbour');
    assert.equal(pm.ok, true);
    assert.equal(pm.value.widgets.length, m.widgets.length);
    assert.deepEqual(validateWidgetOptions(m.widgets, m.assets), []);
    assert.ok(!existsSync(join(out, 'art/bad-kinds')));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test('clock editions: a theme with no export files builds byte-identical output to before', async () => {
  const root = tmp('editions-same');
  const a = tmp('editions-same-a');
  const b = tmp('editions-same-b');
  try {
    cpSync(join(APP_THEMES, 'deep-sea'), join(root, 'deep-sea'), { recursive: true });
    mkdirSync(join(root, 'deep-sea', 'widgets'));
    writeFileSync(join(root, 'deep-sea', 'widgets', 'README.txt'), 'no exports');
    makeEditionTheme(root, '101-alpine-starlight', { profileSource: '101-alpine-starlight/widgets/decorative.png' });
    const now = new Date('2026-11-02T00:00:00Z');
    await buildPacks({ outDir: a, versionsFile: null, log: quiet, encoder: 'png', only: new Set(['deep-sea']), now });
    await buildPacks({ themesDir: root, outDir: b, versionsFile: null, log: quiet, encoder: 'png', now });
    const files = readdirSync(join(a, 'art/deep-sea/v1')).sort();
    assert.deepEqual(readdirSync(join(b, 'art/deep-sea/v1')).sort(), files);
    for (const f of files) assert.ok(readFileSync(join(a, 'art/deep-sea/v1', f)).equals(readFileSync(join(b, 'art/deep-sea/v1', f))), f);
    assert.equal(JSON.parse(readFileSync(join(b, 'art/deep-sea/v1/manifest.json'), 'utf8')).widgets, undefined);
    assert.ok(existsSync(join(b, 'art/alpine-starlight/v1/manifest.json')));
  } finally {
    for (const d of [root, a, b]) rmSync(d, { recursive: true, force: true });
  }
});

test('clock editions: the WebP encoder writes widget-art at source size (when Pillow or sharp is present)', async (t) => {
  const enc = await pickEncoder('auto');
  if (enc.kind === 'png') return t.skip('no WebP encoder');
  const root = tmp('editions-webp');
  const out = tmp('editions-webp-out');
  try {
    makeEditionTheme(root, '101-alpine-starlight', { profileSource: '101-alpine-starlight/widgets/decorative.png' });
    const r = await buildPacks({ themesDir: root, outDir: out, versionsFile: null, log: quiet });
    assert.deepEqual(r.failed, []);
    const m = JSON.parse(readFileSync(join(out, 'art/alpine-starlight/v1/manifest.json'), 'utf8'));
    const themed = m.assets.find((x) => x.path === m.widgets[0].image);
    assert.equal(themed.mime, 'image/webp');
    assert.deepEqual([themed.width, themed.height], [96, 80]);
    assert.equal(parseRemoteArtManifest(m, 'alpine-starlight').ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});
