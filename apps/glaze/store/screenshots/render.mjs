#!/usr/bin/env node
// T267: render the App Store screenshots from template.html + shots.json.
//
//   node --no-warnings store/screenshots/render.mjs [--out DIR] [--only 1,3] [--offline]
//
// Output (outside the repo by default): DIR/6.9/0N-<slug>.jpg (1320 x 2868) and
// DIR/6.5/0N-<slug>.jpg (1284 x 2778), JPEG, no alpha. DIR defaults to /home/claude/store-screens.
// Needs Node 22.18+ (imports src/**/*.ts directly) and Playwright with Chromium (require('playwright')).
//
// Where the content comes from:
//   - bundled themes: themes/<id>/ (wallpaper.png, widget-*.png, palette.json, meta.json)
//   - catalogue themes: the production pack release (PACK_BASE_URL in src/config/packs.ts):
//     catalog.json, catalogue thumbs and one wallpaper, cached in DIR/cache (never in the repo).
//     --offline (or no network) uses the cache, else only the bundled themes.
//   - icon colours / texture: themedTextureSpec in src/core/iconLook.ts (the app's Themed look);
//     icon outline: shapePath in src/core/shapes.ts; in-house glyphs: src/render/inhouse.ts.
//   - Themes tab chips and rails: browseThemes / groupByCategory / browseChips (src/core/themeBrowse.ts).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const OUT = resolve(opt('--out') ?? '/home/claude/store-screens');
const ONLY = opt('--only')?.split(',').map(Number);
const OFFLINE = args.includes('--offline');
const CACHE = join(OUT, 'cache');
mkdirSync(CACHE, { recursive: true });

const src = (p) => pathToFileURL(join(ROOT, p)).href;
const { themedTextureSpec } = await import(src('src/core/iconLook.ts'));
const { mix, relativeLuminance } = await import(src('src/core/colour.ts'));
const { shapePath, gradientVector } = await import(src('src/core/shapes.ts'));
const { INHOUSE_GLYPH_PATHS } = await import(src('src/render/inhouse.ts'));
const { PACK_BASE_URL } = await import(src('src/config/packs.ts'));
const { flatAssetName } = await import(src('src/core/packHost.ts'));
const { GALLERY_STARTER_IDS } = await import(src('src/core/gallery.ts')).catch(() => ({ GALLERY_STARTER_IDS: ['deep-sea', 'starry-night', 'sunset-dunes'] }));
let browse = null;
try {
  browse = await import(src('src/core/themeBrowse.ts'));
} catch (e) {
  console.warn('themeBrowse.ts did not load (' + e.message + '); using the same order by hand');
}

const cfg = JSON.parse(readFileSync(join(HERE, 'shots.json'), 'utf8'));

// ---------- downloads (cached outside the repo) ----------
async function fetchTo(rel, file) {
  const dest = join(CACHE, file);
  if (existsSync(dest) && statSync(dest).size > 0 && (OFFLINE || !file.endsWith('catalog.json'))) return dest;
  if (OFFLINE) return existsSync(dest) ? dest : null;
  const url = `${PACK_BASE_URL}/${flatAssetName(rel)}`;
  // curl first (honours the machine's proxy settings), then Node's fetch.
  try {
    execFileSync('curl', ['-sSfL', '--max-time', '60', '-o', dest + '.part', url], { stdio: 'pipe' });
    renameSync(dest + '.part', dest);
    return dest;
  } catch {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return dest;
    } catch (e) {
      console.warn(`download failed: ${rel} (${e.message})`);
      return existsSync(dest) ? dest : null;
    }
  }
}
const catalogPath = await fetchTo('catalog.json', 'catalog.json');
const catalog = catalogPath ? JSON.parse(readFileSync(catalogPath, 'utf8')) : { packs: [] };
const packs = catalog.packs ?? [];

// ---------- themes ----------
function lookTheme(id, palette, tags) {
  // The fields iconLook reads, built the way artPackTheme() (src/core/artPack.ts) builds them.
  const p = palette;
  const dark = relativeLuminance(p.bg) < 0.25;
  return {
    id,
    palette: { bg: p.bg, surface: p.tile, accent: p.accent, ink: p.text, glyph: p.glyph },
    iconStyle: { shape: 'squircle', background: { kind: 'solid', colour: p.tile }, glyphColour: p.glyph, glyphSet: 'feather', showLabel: true, glyphScale: 0.46 },
    wallpaper: { colours: [mix(p.bg, '#000000', dark ? 0.25 : 0.05), p.bg, mix(p.bg, p.accent, 0.3)], angle: 180 },
    tags: ['art', ...(tags ?? [])],
  };
}
function iconOf(lt) {
  const s = themedTextureSpec(lt, 'glaze-store');
  const bg = s.background.kind === 'gradient'
    ? { kind: 'gradient', from: s.background.from, to: s.background.to, vec: gradientVector(s.background.angle) }
    : { kind: 'solid', colour: s.background.colour ?? s.background.tint };
  return { shape: 'squircle', bg, glyph: s.glyphColour, mark: s.markColour, texture: s.texture, seed: s.seed, glyphScale: 0.46 };
}
const themes = {};
const rel = (abs) => abs; // the template is opened as file://, so absolute file paths work as-is
for (const id of GALLERY_STARTER_IDS) {
  const dir = join(ROOT, 'themes', id);
  if (!existsSync(dir)) continue;
  const palette = JSON.parse(readFileSync(join(dir, 'palette.json'), 'utf8'));
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const lt = lookTheme(id, palette, meta.tags);
  themes[id] = {
    id, name: meta.name, mood: meta.mood, category: meta.category, palette, wallColours: lt.wallpaper.colours,
    wall: rel(pathToFileURL(join(dir, 'wallpaper.png')).href),
    widgets: Object.fromEntries(['small', 'medium', 'large'].map((s) => [s, pathToFileURL(join(dir, `widget-${s}.png`)).href])),
    icon: iconOf(lt),
  };
}
async function remoteTheme(id) {
  const p = packs.find((x) => x.id === id);
  if (!p) return null;
  const lt = lookTheme(id, p.palette, p.tags);
  const t = { id, name: p.name, mood: p.mood, category: p.category, palette: p.palette, wallColours: lt.wallpaper.colours, wall: null, widgets: null, icon: iconOf(lt) };
  const base = p.manifest.replace(/manifest\.json$/, '');
  const mPath = await fetchTo(p.manifest, `${id}.manifest.json`);
  if (mPath) {
    const m = JSON.parse(readFileSync(mPath, 'utf8'));
    const walls = (m.assets ?? []).filter((a) => a.role === 'wallpaper').sort((a, b) => b.width - a.width);
    if (walls[0]) {
      const f = await fetchTo(base + walls[0].path, `${id}.${walls[0].path}`);
      if (f) t.wall = pathToFileURL(f).href;
    }
  }
  return t;
}
for (const s of cfg.shots) {
  if (s.theme && !themes[s.theme]) {
    const t = await remoteTheme(s.theme);
    if (t) themes[s.theme] = t;
    else {
      console.warn(`theme ${s.theme} not available; using sunset-dunes for shot ${s.n}`);
      s.theme = 'sunset-dunes';
    }
  }
}

// ---------- Themes tab: count, chips, first two rails ----------
const starters = Object.values(themes).filter((t) => GALLERY_STARTER_IDS.includes(t.id));
const remote = packs.map((p) => ({ id: p.id, name: p.name, mood: p.mood, category: p.category, thumb: p.thumb, bg: p.palette?.bg ?? '#ccc' }));
const ORDER = ['Space & Night', 'Nature', 'Ocean & Water', 'Cute & Cosy', 'Sweets & Treats', 'Dreamy & Pastel', 'Moody & Dark', 'Abstract & Art', 'Seasonal', 'City & Retro', 'More'];
let all, sections, chips;
if (browse) {
  all = browse.browseThemes(remote, starters.map((t) => ({ id: t.id, name: t.name, mood: t.mood, category: t.category, wall: t.wall, bg: t.palette.bg })));
  sections = browse.groupByCategory(all).map((s) => ({ name: browse.BROWSE_CATEGORY_NAMES[s.id], themes: s.themes }));
  chips = browse.browseChips(browse.groupByCategory(all), all.length).map((c) => ({ label: c.id === 'all' ? 'All themes' : browse.BROWSE_CATEGORY_NAMES[c.id], count: c.count }));
} else {
  const seen = new Set();
  all = [...remote, ...starters].filter((t) => !seen.has(t.id) && seen.add(t.id));
  sections = ORDER.map((name) => ({ name, themes: all.filter((t) => (ORDER.includes(t.category) ? t.category : 'More') === name) })).filter((s) => s.themes.length);
  chips = [{ label: 'All themes', count: all.length }, ...sections.map((s) => ({ label: s.name, count: s.themes.length }))];
}
const themeCount = packs.length ? all.length : cfg.fallbackThemeCount;
if (!packs.length) console.warn(`no catalogue: caption uses fallbackThemeCount ${themeCount}`);
const rails = [];
for (const s of sections.slice(0, 2)) {
  const cards = [];
  for (const t of s.themes.slice(0, 3)) {
    let thumb = t.wall ?? null;
    if (!thumb && t.thumb) {
      const f = await fetchTo(t.thumb, `${t.id}.${t.thumb.split('/').pop()}`);
      if (f) thumb = pathToFileURL(f).href;
    }
    cards.push({ name: t.name, mood: t.mood, thumb: thumb ?? '', bg: t.bg });
  }
  rails.push({ title: s.name, countLabel: `${s.themes.length} theme${s.themes.length === 1 ? '' : 's'}`, cards });
}

// ---------- render ----------
const { chromium } = require('playwright');
const browser = await chromium.launch();
const results = [];
const shapes = { squircle: shapePath('squircle', 100), circle: shapePath('circle', 100) };
for (const size of cfg.sizes) {
  const dir = join(OUT, size.id);
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  for (const shot of cfg.shots) {
    if (ONLY && !ONLY.includes(shot.n)) continue;
    await page.goto(pathToFileURL(join(HERE, 'template.html')).href);
    const data = { shot, size, themeCount, themes, rails, chips, shapes, inhouse: INHOUSE_GLYPH_PATHS };
    await page.evaluate((d) => { window.DATA = d; window.renderShot(); }, data);
    await page.evaluate(async () => {
      await document.fonts.ready;
      const urls = new Set();
      for (const el of document.querySelectorAll('*')) {
        const m = getComputedStyle(el).backgroundImage.match(/url\("(.+?)"\)/);
        if (m) urls.add(m[1]);
      }
      await Promise.all([...urls].map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; })));
    });
    await page.waitForTimeout(150);
    const file = join(dir, `${String(shot.n).padStart(2, '0')}-${shot.slug}.jpg`);
    let q = 90;
    await page.screenshot({ path: file, type: 'jpeg', quality: q });
    while (statSync(file).size > 900 * 1024 && q > 70) {
      q -= 5;
      await page.screenshot({ path: file, type: 'jpeg', quality: q });
    }
    results.push({ file, w: size.width, h: size.height, bytes: statSync(file).size, quality: q });
    console.log(`${file}  ${size.width}x${size.height}  ${(statSync(file).size / 1024).toFixed(0)} KB  q${q}`);
  }
  await page.close();
}
await browser.close();
console.log(`${results.length} images; theme count on shot 2: ${themeCount} (${packs.length} catalogue + ${starters.length} bundled starters)`);
