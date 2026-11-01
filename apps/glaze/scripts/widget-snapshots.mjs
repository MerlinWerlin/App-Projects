#!/usr/bin/env node
// T203 (owner-1101d #6): widget render check. Renders every widget art option of every bundled art
// theme (themes/<id>/, src/core/artPackThemes.ts) and every remote theme (pack v2 on the GitHub
// release in src/config/packs.ts) at small / medium / large, using the app's own placement code
// (src/core/widgetSnapshot.ts → widgetOptions.placeArt, seamlessWidget.seamlessCrop / heroRect), and
// writes one JPG contact sheet per theme plus index.json to docs/widget_snapshots/.
//
//   node --no-warnings scripts/widget-snapshots.mjs                 all themes (downloads remote packs)
//   node --no-warnings scripts/widget-snapshots.mjs --offline       bundled + cached remote only
//   node --no-warnings scripts/widget-snapshots.mjs --only firefly-grove,deep-sea
//   node --no-warnings scripts/widget-snapshots.mjs --staging       the staging release instead
//
// Needs Node 22.18+ (runs src/core .ts directly), Playwright with Chromium, and curl for downloads.
// Downloads are cached in .cache/widget-snapshots/ (gitignored) and checked against the manifest's
// SHA-256. Exit code 0 even with flags: read the summary (and the sheets).

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { HERO_REFERENCE_SIZES, HERO_FILES, ART_WALLPAPER_SIZE, WALLPAPER_FILE, readPngHeader } from '../src/core/artPack.ts';
import { ART_PACK_THEMES } from '../src/core/artPackThemes.ts';
import { THEMES } from '../src/core/themes.ts';
import { OPTION_SIZE_POINTS, fixedValues, optionName, shelfKind, shelfOptions, showsLiveBadge, widgetOptionsFromV1 } from '../src/core/widgetOptions.ts';
import { DEFAULT_DEVICE_ID, WIDGET_CORNER_PT, deviceById } from '../src/core/seamlessWidget.ts';
import { parseCatalog, parseRemoteArtManifest, pickWallpaper, packFolder, CATALOG_FILE } from '../src/core/packCatalog.ts';
import { PACK_BASE_URLS, packObjectUrl } from '../src/config/packs.ts';
import { edgeFlags, pixelFlags, snapshotPlan, worstSeverity } from '../src/core/widgetSnapshot.ts';
import { menuCaptionLayout } from '../src/core/widgetPreview.ts';
import { spaceV2, typeV2 } from '../src/core/designV2.ts';
import { en as tabsEn } from '../src/i18n/ns/tabs/en.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'widget_snapshots');
const CACHE = join(ROOT, '.cache', 'widget-snapshots');
const SIZES = ['small', 'medium', 'large'];
/** ops/bundle-check.sh flags new images over 100 KB; the brief asks ≲ 150 KB per sheet, 1.5 MB total. */
const SHEET_MAX_BYTES = 98_000;
const TOTAL_MAX_BYTES = 1_500_000;
/** Contact sheet scales (CSS px per point) and JPG qualities tried in order until a sheet fits. */
const SCALES = [1, 0.8, 0.65, 0.5];
const QUALITIES = [70, 60, 50];
/** Below this quality, a smaller scale is tried first (50 only at the smallest scale). */
const MIN_QUALITY_BEFORE_SCALING = 60;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? '' : null;
};
const OFFLINE = flag('--offline');
const ENV = flag('--staging') ? 'staging' : 'production';
const ONLY = (valueOf('--only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const wanted = (id) => ONLY.length === 0 || ONLY.includes(id);

const device = deviceById(DEFAULT_DEVICE_ID);

// ------------------------------------------------------------------ downloads

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** curl honours the proxy / CA settings of the machine; fetch is the fallback. */
async function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  try {
    execFileSync('curl', ['-fsSL', '--retry', '2', '-o', dest, url], { stdio: ['ignore', 'ignore', 'pipe'] });
    return readFileSync(dest);
  } catch (e) {
    const res = await fetch(url).catch(() => null);
    if (!res || !res.ok) throw new Error(`download failed: ${url} (${res ? res.status : String(e.message ?? e).trim()})`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    return buf;
  }
}

async function cachedJson(rel, url, refresh) {
  const dest = join(CACHE, ENV, rel);
  if (!refresh && existsSync(dest)) return JSON.parse(readFileSync(dest, 'utf8'));
  if (OFFLINE) return existsSync(dest) ? JSON.parse(readFileSync(dest, 'utf8')) : null;
  return JSON.parse((await download(url, dest)).toString('utf8'));
}

async function cachedAsset(rel, url, hash) {
  const dest = join(CACHE, ENV, rel);
  if (existsSync(dest) && sha256(readFileSync(dest)) === hash) return dest;
  if (OFFLINE) return null;
  const buf = await download(url, dest);
  if (sha256(buf) !== hash) {
    rmSync(dest, { force: true });
    throw new Error(`sha256 mismatch: ${rel}`);
  }
  return dest;
}

// ------------------------------------------------------------------ themes

const MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' };
const dataUrl = (file) => `data:${MIME[file.split('.').pop()] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;

/** Bundled art themes: their three hero pieces as a v1 pack would list them (ThemeWidgetArt.tsx). */
function bundledThemes() {
  return ART_PACK_THEMES.filter((t) => wanted(t.id)).map((t) => {
    const dir = join(ROOT, 'themes', t.id);
    const files = new Map();
    const assets = t.artPack.heroes.flatMap((s) => {
      const file = join(dir, HERO_FILES[s]);
      if (!existsSync(file)) return [];
      const path = `bundled-${s}`;
      files.set(path, file);
      // The app declares the reference size (HERO_REFERENCE_SIZES), not the file's.
      return [{ path, role: `widget-${s}`, width: HERO_REFERENCE_SIZES[s].width, height: HERO_REFERENCE_SIZES[s].height }];
    });
    const wall = join(dir, WALLPAPER_FILE);
    const header = existsSync(wall) ? readPngHeader(new Uint8Array(readFileSync(wall))) : null;
    return {
      id: t.id,
      name: t.name,
      source: 'bundled',
      packVersion: 1,
      colour: t.palette.bg,
      wallpaper: existsSync(wall) ? { file: wall, px: header?.ok ? { w: header.header.width, h: header.header.height } : { w: ART_WALLPAPER_SIZE.width, h: ART_WALLPAPER_SIZE.height } } : null,
      options: widgetOptionsFromV1(assets).map((option) => ({ option, file: files.get(option.image) })),
      errors: [],
    };
  });
}

/** Remote themes from the release catalogue (pack v2 options, or derived from v1). */
async function remoteThemes() {
  const base = PACK_BASE_URLS[ENV];
  if (!base) return { themes: [], errors: ['packs disabled (empty base URL)'] };
  const errors = [];
  let raw;
  try {
    raw = await cachedJson(CATALOG_FILE, packObjectUrl(base, CATALOG_FILE), true);
  } catch (e) {
    return { themes: [], errors: [`catalog: ${e.message}`] };
  }
  if (!raw) return { themes: [], errors: ['catalog: offline and not cached'] };
  const cat = parseCatalog(raw);
  if (!cat.ok) return { themes: [], errors: [`catalog: ${cat.error}`] };
  const themes = [];
  for (const p of cat.value.packs) {
    if (!wanted(p.id)) continue;
    try {
      const mraw = await cachedJson(p.manifest, packObjectUrl(base, p.manifest), false);
      if (!mraw) throw new Error('manifest offline and not cached');
      const m = parseRemoteArtManifest(mraw, p.id);
      if (!m.ok) throw new Error(m.error);
      const folder = packFolder(p.id, p.packVersion);
      const byPath = new Map(m.value.assets.map((a) => [a.path, a]));
      const fetchAsset = async (a) => cachedAsset(`${folder}/${a.path}`, packObjectUrl(base, `${folder}/${a.path}`), a.sha256);
      const wallAsset = pickWallpaper(m.value, device.px.h);
      const wallFile = wallAsset ? await fetchAsset(wallAsset) : null;
      const options = [];
      for (const option of m.value.widgets) {
        const file = await fetchAsset(byPath.get(option.image));
        if (file) options.push({ option, file });
        else errors.push(`${p.id}/${option.id}: image not cached (offline)`);
      }
      const manifestErrors = m.value.version >= 2 ? (await import('../src/core/widgetOptions.ts')).parseWidgetOptions(mraw.widgets, m.value.assets).errors : [];
      themes.push({
        id: p.id,
        name: p.name,
        source: 'remote',
        packVersion: p.packVersion,
        manifestVersion: m.value.version,
        colour: m.value.palette.bg,
        wallpaper: wallFile ? { file: wallFile, px: { w: wallAsset.width, h: wallAsset.height } } : null,
        options,
        errors: manifestErrors,
      });
    } catch (e) {
      errors.push(`${p.id}: ${e.message}`);
    }
  }
  return { themes, errors };
}

// ------------------------------------------------------------------ browser side

/** Runs in the page: decode every image, report its size and its border alpha. */
async function probeImages(urls) {
  const out = {};
  for (const [key, url] of Object.entries(urls)) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(2, Math.round(img.naturalWidth * k));
    const h = Math.max(2, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const a = (x, y) => d[(y * w + x) * 4 + 3];
    let clear = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) clear++;
    const side = (pts) => pts.filter(([x, y]) => a(x, y) > 32).length / pts.length;
    const row = (y) => Array.from({ length: w }, (_, x) => [x, y]);
    const col = (x) => Array.from({ length: h }, (_, y) => [x, y]);
    const sides = { top: side(row(0)), bottom: side(row(h - 1)), left: side(col(0)), right: side(col(w - 1)) };
    const worst = Object.entries(sides).sort((p, q) => q[1] - p[1])[0];
    out[key] = { w: img.naturalWidth, h: img.naturalHeight, transparent: clear / (w * h) > 0.01, edgeOpaque: worst[1], worstSide: worst[0] };
  }
  return out;
}

/** English text of an optionName (src/core/widgetOptions.ts), as WidgetArtMenu shows it. */
function menuText(nm) {
  if ('text' in nm) return nm.text;
  const v = nm.key.replace(/^tabs\./, '').split('.').reduce((o, k) => (o == null ? o : o[k]), tabsEn);
  return String(v ?? nm.key).replace(/\{(\w+)\}/g, (_, k) => String(nm.params?.[k] ?? ''));
}

/** Runs in the page: draw the sheet (see buildPage) and return per-cell pixel stats + label widths. */
async function drawSheet(spec) {
  const load = async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  };
  const images = {};
  for (const [k, url] of Object.entries(spec.images)) images[k] = await load(url);
  const S = spec.scale;
  const rr = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const stats = {};
  for (const cell of spec.cells) {
    const art = images[cell.art];
    const T = cell.plan.targetPx;
    // 1. The file the native bridge composes (GlazeWidgetBridgeModule setSeamless / setWidgetArt).
    const comp = document.createElement('canvas');
    comp.width = T.w;
    comp.height = T.h;
    const c = comp.getContext('2d');
    if (cell.plan.path === 'seamless' && cell.plan.crop && images.wallpaper) {
      const k = cell.plan.crop;
      c.drawImage(images.wallpaper, k.x, k.y, k.w, k.h, 0, 0, T.w, T.h);
    } else {
      c.fillStyle = spec.colour;
      c.fillRect(0, 0, T.w, T.h);
      if (cell.background === 'blur') {
        const radius = Math.max(12, Math.min(art.naturalWidth, art.naturalHeight) * 0.06);
        // CIGaussianBlur on clampedToExtent() has no dark rim; a canvas blur fades at the edges, so
        // the blurred copy is drawn a little larger to push that fade outside the widget.
        const s0 = Math.max(T.w / art.naturalWidth, T.h / art.naturalHeight);
        const s = s0 * (1 + (4 * radius * s0) / Math.min(T.w, T.h));
        c.save();
        c.filter = `blur(${radius * s0}px)`;
        c.drawImage(art, (T.w - art.naturalWidth * s) / 2, (T.h - art.naturalHeight * s) / 2, art.naturalWidth * s, art.naturalHeight * s);
        c.restore();
        c.globalAlpha = 0.25;
        c.fillRect(0, 0, T.w, T.h);
        c.globalAlpha = 1;
      }
    }
    const r = cell.plan.artRect;
    c.drawImage(art, r.x, r.y, r.w, r.h);
    // Pixel stats of the composed file (64 x 64 sample).
    const sm = document.createElement('canvas');
    sm.width = 64;
    sm.height = 64;
    const sc = sm.getContext('2d');
    sc.drawImage(comp, 0, 0, 64, 64);
    const d = sc.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      sum += l;
      sq += l * l;
    }
    const n = d.length / 4;
    const mean = sum / n;
    stats[cell.key] = { mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)) };

    // 2. What SeamlessWidget.swift shows: theme background, blurred fill copy, the file scaledToFit,
    //    inside the rounded widget mask.
    const view = document.getElementById(cell.key);
    const W = cell.plan.widgetPt.w * S;
    const H = cell.plan.widgetPt.h * S;
    view.width = Math.round(W);
    view.height = Math.round(H);
    const v = view.getContext('2d');
    v.save();
    rr(v, 0, 0, W, H, spec.corner * S);
    v.clip();
    v.fillStyle = spec.colour;
    v.fillRect(0, 0, W, H);
    // SwiftUI .blur on a clipped view also fades at the edges, so this one is drawn as is.
    const fs = Math.max(W / T.w, H / T.h);
    v.save();
    v.filter = `blur(${16 * S}px)`;
    v.globalAlpha = 0.85;
    v.drawImage(comp, (W - T.w * fs) / 2, (H - T.h * fs) / 2, T.w * fs, T.h * fs);
    v.restore();
    const ir = cell.plan.imageRectPt;
    v.drawImage(comp, ir.x * S, ir.y * S, ir.w * S, ir.h * S);
    v.restore();
    if (cell.mark) {
      v.strokeStyle = cell.mark;
      v.lineWidth = Math.max(2, 3 * S);
      rr(v, 1, 1, W - 2, H - 2, spec.corner * S);
      v.stroke();
      if (cell.showArtBox) {
        const a = cell.plan.artRectPt;
        v.setLineDash([4, 3]);
        v.lineWidth = 1.5;
        v.strokeRect(a.x * S, a.y * S, a.w * S, a.h * S);
      }
    }
  }
  // Menu labels (WidgetArtMenu caption: subhead 600, one line).
  const m = document.createElement('canvas').getContext('2d');
  const widths = {};
  for (const l of spec.labels) {
    m.font = `600 ${l.fontSize}px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
    widths[l.key] = m.measureText(l.text).width + l.letterSpacing * l.text.length;
    if (l.badge) {
      m.font = `500 ${l.badgeFontSize}px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
      widths[`${l.key}:badge`] = m.measureText(l.badge).width;
    }
  }
  return { stats, widths };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function buildPage(theme, rows, scale) {
  const S = scale;
  const labelW = Math.round(150 * Math.max(0.8, S));
  const fs = Math.max(9, Math.round(11 * Math.max(0.8, S)));
  const head = `<div class="head"><b>${esc(theme.name)}</b> · ${esc(theme.id)} · ${theme.source === 'remote' ? `remote pack v${theme.packVersion} (manifest v${theme.manifestVersion})` : 'bundled art pack'} · ${rows.length} option${rows.length === 1 ? '' : 's'} · device ${esc(device.label)} · widget pt ${SIZES.map((s) => `${OPTION_SIZE_POINTS[s].w}×${OPTION_SIZE_POINTS[s].h}`).join(' / ')}${theme.errors.length ? `<div class="err">${theme.errors.map(esc).join('<br>')}</div>` : ''}</div>`;
  const colHead = `<div class="row hdr"><div class="lab" style="width:${labelW}px"></div>${SIZES.map((s) => `<div class="cell" style="width:${OPTION_SIZE_POINTS[s].w * S}px">${s}</div>`).join('')}</div>`;
  const body = rows
    .map((r) => {
      const o = r.option;
      const meta = [`<b>${esc(o.label ?? r.menuName)}</b>`, esc(o.id), `${o.kind}${fixedValues(o) ? ' → art (fixed numbers)' : ''} · fit ${o.fit} · bg ${o.background}`, `sizes ${o.sizes.join(',')}`, `${r.probe.w}×${r.probe.h}${r.probe.transparent ? ' alpha' : ''}`];
      const themeFlags = r.flags.map((f) => `<span class="${f.severity}">${esc(f.code)}</span>`).join(' ');
      const cells = SIZES.map((s) => {
        const c = r.cells[s];
        const tags = c.flags.filter((f) => f.code !== 'notOffered').map((f) => `<span class="${f.severity}">${esc(f.code)}</span>`).join(' ');
        return `<div class="cell" style="width:${OPTION_SIZE_POINTS[s].w * S}px"><canvas id="${c.key}" class="${c.offered ? '' : 'off'}"></canvas><div class="tag">${c.offered ? '' : '<span class="info">not offered</span> '}${tags || (c.offered ? '<span class="ok">ok</span>' : '')}</div></div>`;
      }).join('');
      return `<div class="row"><div class="lab" style="width:${labelW}px">${meta.join('<br>')}${themeFlags ? `<br>${themeFlags}` : ''}</div>${cells}</div>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#2b2b30;color:#eee;font:${fs}px/1.3 Arial,Helvetica,sans-serif}
    .sheet{display:inline-block;padding:${Math.round(10 * S)}px}
    .head{margin-bottom:6px;font-size:${fs + 1}px}
    .row{display:flex;gap:${Math.round(12 * S)}px;align-items:flex-start;margin-bottom:${Math.round(10 * S)}px}
    .hdr{margin-bottom:2px;color:#aaa}
    .lab{flex:none;word-break:break-all}
    .cell{flex:none}
    canvas{display:block;background:#555;border-radius:${Math.round(WIDGET_CORNER_PT * S)}px}
    canvas.off{opacity:.55}
    .tag{min-height:${fs + 2}px;margin-top:2px}
    .error{color:#ff6b6b;font-weight:bold}.warn{color:#ffb347}.info{color:#9ab}.ok{color:#7c7}.err{color:#ff6b6b}
  </style></head><body><div class="sheet" id="sheet">${head}${colHead}${body}</div></body></html>`;
}

// ------------------------------------------------------------------ main

async function main() {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright');
  mkdirSync(OUT, { recursive: true });
  mkdirSync(CACHE, { recursive: true });

  const bundled = bundledThemes();
  const remote = await remoteThemes();
  const themes = [...bundled, ...remote.themes];
  console.log(`themes: ${bundled.length} bundled, ${remote.themes.length} remote${remote.errors.length ? ` (${remote.errors.length} errors)` : ''}`);
  for (const e of remote.errors) console.log(`  ! ${e}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1200, height: 800 } });
  await page.setContent('<!doctype html><html><body></body></html>');
  const index = {
    task: 'T203',
    generated: new Date().toISOString().slice(0, 10),
    env: ENV,
    device: { id: device.id, label: device.label, scale: device.scale },
    sizesPt: Object.fromEntries(SIZES.map((s) => [s, OPTION_SIZE_POINTS[s]])),
    checks: ['crop', 'fill', 'stretch', 'metaAspect', 'cornerClip', 'letterbox', 'noWallpaper', 'empty', 'white', 'edgeCut', 'textOverflow', 'notOffered'],
    downloadErrors: remote.errors,
    themes: [],
    // Bundled themes with no widget art: the Widgets tab shows only the catalogue widgets for them.
    noArtThemes: THEMES.filter((t) => !ART_PACK_THEMES.some((a) => a.id === t.id)).map((t) => t.id),
    noArtPackThemes: readdirSync(join(ROOT, 'packs')).flatMap((d) => {
      const f = join(ROOT, 'packs', d, 'manifest.json');
      if (!existsSync(f)) return [];
      const m = JSON.parse(readFileSync(f, 'utf8'));
      return (m.themes ?? []).map((t) => `${d}/${t.id}`);
    }),
  };
  const written = new Set();
  let total = 0;

  for (const theme of themes) {
    const imageFiles = Object.fromEntries(theme.options.map((o) => [o.option.id, o.file]));
    const urls = Object.fromEntries(Object.entries(imageFiles).map(([k, f]) => [k, dataUrl(f)]));
    const probe = await page.evaluate(probeImages, urls);
    const cardWidthFor = (size) => {
      // WidgetArtMenu: grid width = screen width - 2 x gutter (spaceV2.lg); 2 columns for small.
      const width = device.pt.w - spaceV2.lg * 2;
      const columns = size === 'small' ? 2 : 1;
      return Math.max(120, Math.floor((width - spaceV2.md * (columns - 1)) / columns));
    };
    const rows = theme.options.map(({ option }) => {
      const p = probe[option.id];
      const optFlags = edgeFlags(p);
      const cells = {};
      for (const size of SIZES) {
        const plan = snapshotPlan({ option, size, device, artPx: { w: p.w, h: p.h }, wallpaperPx: theme.wallpaper?.px ?? null });
        cells[size] = { key: `c-${option.id}-${size}`, size, offered: plan.offered, plan, flags: [...plan.flags] };
      }
      return { option, probe: p, flags: optFlags, cells, menuName: option.label ?? null };
    });
    // Menu names as the app shows them (optionName: the same in every size), in shelf order.
    const labels = [];
    const all = theme.options.map((o) => o.option);
    for (const size of SIZES) {
      const list = shelfOptions(all, size);
      list.forEach((o) => {
        const row = rows.find((r) => r.option.id === o.id);
        const text = menuText(optionName(o, all));
        row.menuName = row.menuName ?? text;
        labels.push({
          key: `${o.id}:${size}`,
          text,
          fontSize: typeV2.subhead.fontSize,
          letterSpacing: typeV2.subhead.letterSpacing,
          badge: showsLiveBadge(o) ? tabsEn.widgetsTab.art.live : null,
          badgeFontSize: typeV2.caption2.fontSize,
          available: cardWidthFor(size) - spaceV2.xs * 2,
          caption: menuCaptionLayout(size),
        });
      });
    }

    const specFor = (scale) => ({
      scale,
      colour: theme.colour,
      corner: WIDGET_CORNER_PT,
      images: { ...urls, ...(theme.wallpaper ? { wallpaper: dataUrl(theme.wallpaper.file) } : {}) },
      cells: rows.flatMap((r) =>
        SIZES.map((s) => {
          const c = r.cells[s];
          const sev = worstSeverity(c.flags.filter((f) => f.code !== 'notOffered' && f.code !== 'letterbox'));
          return {
            key: c.key,
            art: r.option.id,
            background: r.option.background,
            plan: c.plan,
            mark: sev === 'error' ? '#ff3b30' : sev === 'warn' ? '#ff9f0a' : null,
            showArtBox: c.flags.some((f) => f.code === 'crop' || f.code === 'cornerClip'),
          };
        }),
      ),
      labels,
    });

    // Measuring pass: pixel stats of every composed widget and the menu label widths.
    await page.setContent(buildPage(theme, rows, 1));
    const { stats, widths } = await page.evaluate(drawSheet, specFor(1));
    for (const r of rows) {
      for (const s of SIZES) r.cells[s].flags.push(...pixelFlags(stats[r.cells[s].key]));
      r.menu = {};
      for (const s of SIZES) {
        const l = labels.find((x) => x.key === `${r.option.id}:${s}`);
        if (!l) continue;
        // T207: a stacked caption (small cards) puts the badge on its own line and lets the name wrap.
        const badgeW = l.badge ? widths[`${l.key}:badge`] + spaceV2.sm * 2 : 0;
        const need = l.caption.stacked
          ? Math.max(widths[l.key] / l.caption.nameLines, badgeW)
          : widths[l.key] + (l.badge ? badgeW + spaceV2.sm : 0);
        r.menu[s] = { text: l.text, widthPt: Math.round(need), availablePt: l.available, truncated: need > l.available };
        if (need > l.available) r.cells[s].flags.push({ code: 'textOverflow', severity: 'warn', detail: `menu label "${l.text}" needs ${Math.round(need)} pt of ${l.available}` });
      }
    }

    // Drawing pass: the largest scale / best quality that fits the sheet budget.
    let best = null;
    for (const scale of SCALES) {
      await page.setContent(buildPage(theme, rows, scale));
      await page.evaluate(drawSheet, specFor(scale));
      const el = await page.$('#sheet');
      const last = scale === SCALES[SCALES.length - 1];
      for (const quality of QUALITIES.filter((q) => last || q >= MIN_QUALITY_BEFORE_SCALING)) {
        const buf = await el.screenshot({ type: 'jpeg', quality });
        best = { buf, scale, quality };
        if (buf.length <= SHEET_MAX_BYTES) break;
      }
      if (best.buf.length <= SHEET_MAX_BYTES) break;
    }
    const file = `${theme.id}.jpg`;
    writeFileSync(join(OUT, file), best.buf);
    written.add(file);
    total += best.buf.length;
    const flagCount = rows.reduce((n, r) => n + r.flags.length + SIZES.reduce((m, s) => m + r.cells[s].flags.filter((f) => f.code !== 'notOffered').length, 0), 0);
    console.log(`${theme.id}: ${rows.length} options → ${file} ${Math.round(best.buf.length / 1024)} KB (scale ${best.scale}, q${best.quality}), ${flagCount} flags`);
    index.themes.push({
      id: theme.id,
      name: theme.name,
      source: theme.source,
      packVersion: theme.packVersion,
      manifestVersion: theme.manifestVersion ?? null,
      sheet: file,
      sheetScale: best.scale,
      wallpaper: theme.wallpaper ? theme.wallpaper.px : null,
      manifestErrors: theme.errors,
      options: rows.map((r) => ({
        id: r.option.id,
        kind: r.option.kind,
        shelfKind: shelfKind(r.option),
        fixedValues: fixedValues(r.option),
        label: r.option.label,
        fit: r.option.fit,
        background: r.option.background,
        sizes: r.option.sizes,
        derived: r.option.derived,
        declaredPx: { w: r.option.width, h: r.option.height },
        imagePx: { w: r.probe.w, h: r.probe.h },
        transparent: r.probe.transparent,
        flags: r.flags,
        menu: r.menu,
        cells: Object.fromEntries(
          SIZES.map((s) => {
            const c = r.cells[s];
            const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 10) / 10]));
            return [
              s,
              {
                offered: c.offered,
                path: c.plan.path,
                mode: c.plan.mode,
                targetPx: c.plan.targetPx,
                crop: c.plan.crop,
                artRectPt: round(c.plan.artRectPt),
                coverage: Math.round(c.plan.coverage * 100) / 100,
                flags: c.flags.filter((f) => f.code !== 'notOffered'),
              },
            ];
          }),
        ),
      })),
    });
  }
  await browser.close();

  // Sheets of themes no longer present are removed (only on a full run).
  if (ONLY.length === 0) {
    for (const f of readdirSync(OUT)) if (f.endsWith('.jpg') && !written.has(f)) rmSync(join(OUT, f));
  }
  const counts = {};
  for (const t of index.themes) {
    for (const o of t.options) {
      for (const f of o.flags) counts[f.code] = (counts[f.code] ?? 0) + 1;
      for (const s of SIZES) for (const f of o.cells[s].flags) counts[f.code] = (counts[f.code] ?? 0) + 1;
    }
  }
  index.summary = { themes: index.themes.length, options: index.themes.reduce((n, t) => n + t.options.length, 0), flags: counts };
  const indexFile = join(OUT, 'index.json');
  if (ONLY.length === 0 || !existsSync(indexFile)) writeFileSync(indexFile, JSON.stringify(index, null, 1) + '\n');
  else console.log('(--only: index.json not rewritten)');
  const all = readdirSync(OUT).filter((f) => f.endsWith('.jpg')).reduce((n, f) => n + statSync(join(OUT, f)).size, 0);
  console.log(`total sheets ${Math.round(all / 1024)} KB${all > TOTAL_MAX_BYTES ? ' — OVER the 1.5 MB budget' : ''}`);
  console.log('flags:', JSON.stringify(counts));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
