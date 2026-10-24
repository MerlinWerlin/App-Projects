#!/usr/bin/env node
/**
 * Couch store screenshot kit (owner-1017 T4, backlog T59).
 *
 *   node store/render.mjs [--locale <code>] [--size 1320x2868] [--out <dir>]
 *
 * 1. Renders prototype/index.html (?shot=1&theme=<id>&view=<state>) at a phone viewport (430x932 @3x)
 *    in headless Chromium (preinstalled; never run a browser download here).
 * 2. Composes each marketing image as an HTML page: theme-coloured stage + glow, a benefit headline
 *    from the i18n catalogue, and a generic phone frame (CSS, no maker marks) holding the screen.
 * 3. Writes store/screenshots/<WxH>/NN-name.png, JPEG previews (sharp) and a contact sheet index.html.
 * 4. Writes store/screenshots/publish/: every 1320x2868 shot as JPEG (quality 85) plus a small contact sheet
 *    (index.html) that shows them by relative path. That folder holds only publishable files.
 *
 * --ios renders the App Store set into store/jpg/ios/ (committed; store/listing.json points at it): only the free
 * remote themes (Couch Plus has no store product yet), an iPhone-style frame with a Dynamic Island, no theme-fan
 * shot, and no infrared rows (iPhones have no IR blaster). 1320x2868 JPEG q85, no alpha.
 *
 * Screens use generic demo TVs only; every screen's visible text is checked against store/brand-guard.mjs.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNoBrands } from './brand-guard.mjs';

// Node prints a notice for every .ts module it type-strips; keep the output readable
process.removeAllListeners('warning');

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);

function loadGlobal(name) {
  const candidates = [name, join(process.env.HOME || '/home/claude', '.npm-global/lib/node_modules', name)];
  for (const c of candidates) {
    try { return require(c); } catch { /* try the next one */ }
  }
  throw new Error(`cannot load ${name}; it must already be installed (this script never installs anything)`);
}
const { chromium } = loadGlobal('playwright');
const sharp = loadGlobal('sharp');

// ---- args -----------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const locale = arg('locale', 'en');
const IOS = argv.includes('--ios');
const onlySize = IOS ? '1320x2868' : arg('size', null);

// ---- data -----------------------------------------------------------------------------------------
const { REMOTE_THEMES } = await import(pathToFileURL(join(root, 'src/theme/remoteThemes.ts')).href);
const { isRtl } = await import(pathToFileURL(join(root, 'src/i18n/locales.ts')).href);
const { uiEn } = await import(pathToFileURL(join(root, 'src/i18n/catalog/en/ui.ts')).href);

async function catalogue(code) {
  if (code === 'en') return uiEn;
  const file = join(root, `src/i18n/catalog/${code}.ts`);
  if (!existsSync(file)) {
    console.warn(`no catalogue for "${code}", using English`);
    return uiEn;
  }
  const mod = await import(pathToFileURL(file).href);
  const cat = Object.values(mod).find((v) => v && typeof v === 'object');
  return { ...uiEn, ...cat };
}
const cat = await catalogue(locale);
const rtl = locale !== 'en' && isRtl(locale);
function t(key, vars = {}) {
  const s = cat[key] ?? uiEn[key];
  if (!s) throw new Error(`missing catalogue key ${key}`);
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export const SIZES = [
  { dir: '1320x2868', w: 1320, h: 2868, label: 'App Store · iPhone 6.9"' },
  { dir: '1242x2688', w: 1242, h: 2688, label: 'App Store · iPhone 6.5"' },
  { dir: '1080x1920', w: 1080, h: 1920, label: 'Play Store · phone' },
];

/**
 * Shot order follows the docs/MARKET.md "Store screenshot playbook" (T69, market-1018 M5): 01 sells the outcome,
 * 02 is the price promise on a remote with a "Free" seal, then one feature per shot. `accent` names the one theme
 * colour token that tints that shot (background glow, frame glow, seal); every other colour is the theme's neutrals.
 */
export const SHOTS = [
  { n: '01', name: 'every-tv', key: 'ui.store.headline.everyTv', theme: 'charcoal', accent: 'accent' },
  { n: '02', name: 'free', key: 'ui.store.headline.priceFree', theme: 'daylight', accent: 'accent', seal: 'ui.store.headline.sealFree' },
  { n: '03', name: 'find-tv', key: 'ui.store.headline.findTv', theme: 'retro', accent: 'glow', view: 'add' },
  { n: '04', name: 'search', key: 'ui.store.headline.search', theme: 'aurora', accent: 'accent', view: 'keyboard' },
  { n: '05', name: 'apps', key: 'ui.store.headline.apps', theme: 'cinema', accent: 'accent', view: 'apps' },
  { n: '06', name: 'themes', key: 'ui.store.headline.themes', vars: { count: Object.keys(REMOTE_THEMES).length }, theme: 'neon', accent: 'accent', fan: ['aluminium', 'cinema', 'neon', 'candy', 'aurora'] },
  { n: '07', name: 'multi-tv', key: 'ui.store.headline.multiTv', theme: 'forest', accent: 'accent', view: 'switch' },
];

/**
 * App Store (iOS) set: free themes only, one feature per shot, nothing an iPhone can't do (no infrared).
 * Same headlines and order as SHOTS minus the themes fan (8 of the 12 themes are Couch Plus, which is not on sale yet).
 */
export const SHOTS_IOS = [
  { n: '01', name: 'every-tv', key: 'ui.store.headline.everyTv', theme: 'charcoal', accent: 'accent' },
  { n: '02', name: 'free', key: 'ui.store.headline.priceFree', theme: 'daylight', accent: 'accent', seal: 'ui.store.headline.sealFree' },
  { n: '03', name: 'find-tv', key: 'ui.store.headline.findTv', theme: 'midnight', accent: 'accent', view: 'add' },
  { n: '04', name: 'search', key: 'ui.store.headline.search', theme: 'oled', accent: 'accent', view: 'keyboard' },
  { n: '05', name: 'apps', key: 'ui.store.headline.apps', theme: 'charcoal', accent: 'accent', view: 'apps' },
  { n: '06', name: 'multi-tv', key: 'ui.store.headline.multiTv', theme: 'midnight', accent: 'accent', view: 'switch' },
];

/** Playbook rule 5: the rendered headline box is at least this fraction of the shot height, in at most 2 lines. */
export const HEADLINE_MIN_FRACTION = 0.07;
export const HEADLINE_MAX_LINES = 2;
const HEADLINE_LINE_HEIGHT = 1.1;

const PHONE = { w: 430, h: 932, scale: 3 };
const outRoot = IOS ? join(here, 'screenshots', 'ios') : arg('out', locale === 'en' ? join(here, 'screenshots') : join(here, 'screenshots', locale));

// ---- step 1: prototype screens --------------------------------------------------------------------
// one raster tile per shot: with the default 256 px tiles, soft gradients show faint seams at tile edges
const browser = await chromium.launch({ args: ['--default-tile-width=4096', '--default-tile-height=4096', '--disable-gpu-rasterization'] });
const ctx = await browser.newContext({
  viewport: { width: PHONE.w, height: PHONE.h },
  deviceScaleFactor: PHONE.scale,
  reducedMotion: 'reduce',
});
// web fonts are not reachable offline; fail fast and use the local font stack
await ctx.route(/^https?:\/\//, (r) => r.abort());

const screens = new Map();
async function screen(theme, view) {
  const id = `${theme}:${view || 'remote'}`;
  if (screens.has(id)) return screens.get(id);
  const page = await ctx.newPage();
  const url = `${pathToFileURL(join(root, 'prototype/index.html')).href}?shot=1&theme=${theme}${view ? `&view=${view}` : ''}`;
  await page.goto(url, { waitUntil: 'load', timeout: 10000 });
  await page.waitForTimeout(250);
  if (IOS) {
    // iPhones have no infrared blaster: drop the IR entry in Add a TV and any infrared TV in the switcher
    await page.evaluate(() => {
      document.querySelectorAll('.tv').forEach((el) => { if (/infrared/i.test(el.textContent || '')) el.remove(); });
    });
  }
  assertNoBrands(await page.evaluate(() => document.body.innerText), `prototype screen ${id}`);
  const png = await page.screenshot({ type: 'png' });
  await page.close();
  const data = `data:image/png;base64,${png.toString('base64')}`;
  screens.set(id, data);
  return data;
}

// ---- step 2: composed marketing page --------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

function phone(src, cls = '', style = '') {
  return `<div class="phone ${cls}" style="${style}"><span class="btn b1"></span><span class="btn b2"></span><span class="btn b3"></span>` +
    `<div class="screen"><img src="${src}" alt=""><span class="${IOS ? 'island' : 'cam'}"></span></div></div>`;
}

/**
 * Headline markup: when the text has a sentence or clause boundary, break the two lines there (the most even
 * split), so "Every button free. / No ads. No subscription." never reads "...free. No / ads...". fitHeadline()
 * drops the break when it cannot meet the size and line rules. The words themselves are the catalogue's.
 */
function headlineHtml(text) {
  const cuts = [...text.matchAll(/[.!?:,。！？：，、।]\s*/g)].map((m) => m.index + m[0].length).filter((i) => i > 0 && i < text.length);
  if (!cuts.length) return esc(text);
  const best = cuts.reduce((a, b) => (Math.abs(text.length - 2 * b) < Math.abs(text.length - 2 * a) ? b : a));
  return `${esc(text.slice(0, best).trimEnd())}<br>${esc(text.slice(best).trimStart())}`;
}

/** Scalloped rosette for the shot 02 seal: an original shape drawn here, in a 100 x 100 box. */
function sealPath(points = 18, outer = 50, inner = 45.5) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const r = i % 2 ? inner : outer;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function composeHtml(size, shot, imgs) {
  const th = REMOTE_THEMES[shot.theme];
  // one accent colour per shot, taken from that shot's theme
  const accent = th[shot.accent] || th.accent;
  const light = th.scheme === 'light';
  // headline ink must read on the stage (Retro Wood has dark ink on cream keys but a dark stage)
  const headInk = lum(th.stage) < 0.2 ? [th.ink, th.key, '#FFFFFF'].find((c) => lum(c) > 0.5) : th.ink;
  const W = size.w / 3;
  const H = size.h / 3;
  const tall = H / W > 2;
  // same headline position and device frame on every shot: fixed headline top, fixed frame top
  const headTop = 0.065 * H;
  const fs = W * (tall ? 0.1 : 0.088);
  const frameTop = (tall ? 0.215 : 0.225) * H;
  const avail = H - frameTop - 0.035 * H;
  const phoneW = Math.min(W * (shot.fan ? 0.6 : 0.82), avail / (PHONE.h / PHONE.w));
  const sealD = phoneW * 0.42;
  const sealInk = lum(accent) > 0.35 ? '#14161A' : '#FFFFFF';
  const seal = shot.seal
    ? `<div class="seal" role="img" aria-label="${esc(t(shot.seal))}"><svg viewBox="0 0 100 100" aria-hidden="true">` +
      `<polygon points="${sealPath()}" fill="${accent}"/>` +
      `<circle cx="50" cy="50" r="38" fill="none" stroke="${sealInk}" stroke-opacity=".55" stroke-width="1.4"/>` +
      `<circle cx="50" cy="50" r="34.5" fill="none" stroke="${sealInk}" stroke-opacity=".3" stroke-width=".8"/></svg>` +
      `<span${rtl ? ' dir="rtl"' : ''}>${esc(t(shot.seal))}</span></div>`
    : '';
  const body = shot.fan
    ? `<div class="fan">${shot.fan.map((id, i) => {
      const off = i - (shot.fan.length - 1) / 2;
      const s = 1 - Math.abs(off) * 0.1;
      const z = 10 - Math.abs(off);
      return phone(imgs[i], '', `--s:${s};--x:${off * 0.44};--r:${off * 7}deg;z-index:${z}`);
    }).join('')}</div>`
    : `<div class="hold">${phone(imgs[0])}${seal}</div>`;
  return `<!doctype html><html lang="${esc(locale)}"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;font-family:"Inter Display","Inter","Noto Sans","Noto Sans CJK JP","IPAPGothic","DejaVu Sans",sans-serif;
  color:${headInk};background:
  radial-gradient(90% 48% at 50% 62%, color-mix(in srgb, ${accent} ${light ? 26 : 40}%, transparent), transparent 72%),
  radial-gradient(70% 26% at 50% 0%, color-mix(in srgb, ${accent} ${light ? 14 : 20}%, transparent), transparent 70%),
  linear-gradient(180deg, ${th.bg}, ${th.stage})}
body::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:${light ? 0.12 : 0.08};
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E")}
.head{position:absolute;left:${W * 0.06}px;right:${W * 0.06}px;top:${headTop}px;text-align:center}
h1{font-size:${fs}px;line-height:${HEADLINE_LINE_HEIGHT};font-weight:800;letter-spacing:-.02em;text-wrap:balance}
.stage{position:absolute;left:0;right:0;top:${frameTop}px;bottom:0;display:flex;justify-content:center}
.hold{position:relative;flex:none;height:max-content}
.seal{position:absolute;width:${sealD}px;height:${sealD}px;right:-${sealD * 0.3}px;top:${phoneW * 0.62}px;transform:rotate(-12deg);
  filter:drop-shadow(0 ${sealD * 0.05}px ${sealD * 0.09}px rgba(0,0,0,${light ? 0.22 : 0.5}));display:grid;place-items:center}
.seal svg{position:absolute;inset:0;width:100%;height:100%}
.seal span{position:relative;max-width:${sealD * 0.66}px;font-size:${sealD * 0.24}px;font-weight:800;letter-spacing:-.01em;line-height:1;color:${sealInk};white-space:nowrap}
.phone{position:relative;width:${phoneW}px;aspect-ratio:${PHONE.w}/${PHONE.h};border-radius:${phoneW * 0.15}px;padding:${phoneW * 0.032}px;
  background:linear-gradient(145deg,#3a3d44,#141518 40%,#25272c);flex:none;
  box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 ${phoneW * 0.08}px ${phoneW * 0.25}px -${phoneW * 0.05}px rgba(0,0,0,${light ? 0.35 : 0.6})}
.screen{position:relative;width:100%;height:100%;border-radius:${phoneW * 0.12}px;overflow:hidden;background:${th.stage}}
.screen img{position:absolute;left:0;top:${phoneW * 0.085}px;display:block;width:100%;height:auto}
.cam{position:absolute;top:${phoneW * 0.025}px;left:50%;width:${phoneW * 0.035}px;height:${phoneW * 0.035}px;transform:translateX(-50%);border-radius:50%;background:#050506;box-shadow:0 0 0 1px rgba(255,255,255,.06)}
.island{position:absolute;top:${phoneW * 0.017}px;left:50%;width:${phoneW * 0.27}px;height:${phoneW * 0.058}px;transform:translateX(-50%);border-radius:999px;background:#050506}
.btn{position:absolute;width:${phoneW * 0.012}px;background:#2a2c31;border-radius:2px}
.b1{left:-${phoneW * 0.008}px;top:18%;height:6%}.b2{left:-${phoneW * 0.008}px;top:27%;height:9%}.b3{right:-${phoneW * 0.008}px;top:24%;height:12%}
.fan{position:relative;width:${phoneW}px;height:100%}
.fan .phone{position:absolute;left:0;top:0;transform-origin:50% 100%;transform:translateX(calc(var(--x) * ${phoneW}px)) rotate(var(--r)) scale(var(--s))}
</style></head><body>
<div class="head"><h1${rtl ? ' dir="rtl"' : ''}>${headlineHtml(t(shot.key, shot.vars))}</h1></div>
<div class="stage">${body}</div>
</body></html>`;
}

/**
 * Fits the headline in the composed page: shrink from the set size until it is at most HEADLINE_MAX_LINES lines
 * with no word overflowing; a one-line headline grows until its line box reaches HEADLINE_MIN_FRACTION of the
 * height or wraps to a balanced second line. Also shrinks the seal word to fit inside the seal. Returns the measured headline box.
 */
async function fitHeadline(page) {
  return page.evaluate(({ maxLines, minFrac, lh }) => {
    const h1 = document.querySelector('h1');
    const H = window.innerHeight;
    const measure = () => {
      const fs = parseFloat(h1.style.fontSize || getComputedStyle(h1).fontSize);
      const box = h1.getBoundingClientRect().height;
      // count rendered line boxes: distinct tops of the text's client rects
      const range = document.createRange();
      range.selectNodeContents(h1);
      const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
      return { fs, box, lines: tops.size, overflow: h1.scrollWidth > h1.clientWidth + 1 };
    };
    const fs0 = parseFloat(getComputedStyle(h1).fontSize);
    let fs = fs0;
    const set = (v) => { fs = v; h1.style.fontSize = `${v}px`; return measure(); };
    const fit = () => {
      let m = set(fs0);
      while ((m.lines > maxLines || m.overflow) && fs > 8) m = set(fs - 0.5);
      while (m.lines === 1 && m.box < minFrac * H) {
        const next = set(fs + 0.5);
        // growing until it wraps onto a second line is fine: two lines meet the size rule at a smaller font
        if (next.lines > 1 || next.overflow) { m = next.lines <= maxLines && !next.overflow ? next : set(fs - 0.5); break; }
        m = next;
      }
      return m;
    };
    // first try the break at a sentence boundary (headlineHtml); if that cannot meet the rules, plain balanced wrap
    let m = fit();
    if (h1.querySelector('br') && (m.lines > maxLines || m.overflow || m.box < minFrac * H)) {
      h1.textContent = h1.textContent;
      m = fit();
    }
    const seal = document.querySelector('.seal span');
    if (seal) {
      let s = parseFloat(getComputedStyle(seal).fontSize);
      while (seal.scrollWidth > parseFloat(getComputedStyle(seal).maxWidth) && s > 6) seal.style.fontSize = `${(s -= 0.5)}px`;
    }
    return { ...m, lineHeight: lh, H };
  }, { maxLines: HEADLINE_MAX_LINES, minFrac: HEADLINE_MIN_FRACTION, lh: HEADLINE_LINE_HEIGHT });
}

/** Playbook rule 5, enforced: headline line box(es) >= 7% of the shot height, at most 2 lines, nothing overflowing. */
function assertHeadline(m, size, shot) {
  const where = `${shot.n}-${shot.name} at ${size.dir}`;
  if (m.lines < 1 || m.lines > HEADLINE_MAX_LINES) throw new Error(`headline of ${where} renders in ${m.lines} lines, max ${HEADLINE_MAX_LINES}`);
  if (m.overflow) throw new Error(`headline of ${where} overflows its box`);
  if (m.box < HEADLINE_MIN_FRACTION * m.H) {
    throw new Error(`headline of ${where} is ${((m.box / m.H) * 100).toFixed(1)}% of the shot height, min ${(HEADLINE_MIN_FRACTION * 100).toFixed(0)}%`);
  }
}

// ---- run ------------------------------------------------------------------------------------------
const sizes = SIZES.filter((s) => !onlySize || s.dir === onlySize);
rmSync(join(outRoot, 'previews'), { recursive: true, force: true });
const PUBLISH = { dir: '1320x2868', quality: 85, maxBytes: 2 * 1048576 };
const publishDir = join(outRoot, 'publish');
rmSync(publishDir, { recursive: true, force: true });
mkdirSync(join(outRoot, 'previews'), { recursive: true });
const made = [];
const composer = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 400, height: 800 } });

for (const shot of IOS ? SHOTS_IOS : SHOTS) {
  const imgs = shot.fan ? await Promise.all(shot.fan.map((id) => screen(id))) : [await screen(shot.theme, shot.view)];
  for (const size of sizes) {
    const page = await composer.newPage();
    await page.setViewportSize({ width: size.w / 3, height: size.h / 3 });
    const html = composeHtml(size, shot, imgs);
    assertNoBrands(html.replace(/data:image\/[^"]+/g, ''), `composed page ${shot.name}`);
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
    const head = await fitHeadline(page);
    assertHeadline(head, size, shot);
    const dir = join(outRoot, size.dir);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${shot.n}-${shot.name}.png`);
    await page.screenshot({ path: file, type: 'png' });
    await page.close();
    const meta = await sharp(file).metadata();
    if (meta.width !== size.w || meta.height !== size.h) throw new Error(`${file} is ${meta.width}x${meta.height}, want ${size.w}x${size.h}`);
    const preview = join(outRoot, 'previews', `${size.dir}-${shot.n}-${shot.name}.jpg`);
    await sharp(file).resize({ width: 400 }).jpeg({ quality: 80, mozjpeg: true }).toFile(preview);
    let publish = null;
    if (size.dir === PUBLISH.dir) {
      mkdirSync(publishDir, { recursive: true });
      publish = join(publishDir, `${shot.n}-${shot.name}.jpg`);
      await sharp(file).flatten({ background: '#000000' }).jpeg({ quality: PUBLISH.quality, mozjpeg: true }).toFile(publish);
    }
    made.push({ size, shot, file, preview, publish });
    console.log(`${relative(root, file)}  ${(statSync(file).size / 1024).toFixed(0)} KB  headline ${head.lines} line(s), ${((head.box / head.H) * 100).toFixed(1)}% of height`);
  }
}
await browser.close();

// ---- step 3: contact sheet ------------------------------------------------------------------------
function contactSheet() {
  const sections = sizes.map((size) => {
    const items = made.filter((m) => m.size === size).map((m) => {
      const png = `${size.dir}/${m.shot.n}-${m.shot.name}.png`;
      const jpg = `previews/${size.dir}-${m.shot.n}-${m.shot.name}.jpg`;
      return `<figure><a href="${png}"><img src="${jpg}" alt="${esc(t(m.shot.key, m.shot.vars))}" loading="lazy"></a>` +
        `<figcaption><b>${m.shot.n}</b> ${esc(t(m.shot.key, m.shot.vars))}<br><small>${esc(t(`ui.themes.name.${m.shot.fan ? 'neon' : m.shot.theme}`))}${m.shot.fan ? ' + 4' : ''} · <a href="${png}">PNG ${(statSync(m.file).size / 1048576).toFixed(1)} MB</a></small></figcaption></figure>`;
    }).join('\n');
    return `<section><h2>${esc(size.label)} <small>${size.w} × ${size.h}</small></h2><div class="grid">${items}</div></section>`;
  }).join('\n');
  return `<!doctype html><html lang="${esc(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Couch store screenshots</title><style>
:root{--bg:#F4F5F7;--card:#fff;--ink:#1C232B;--muted:#5D6873;--accent:#2F5BD3}
@media (prefers-color-scheme:dark){:root{--bg:#0E1115;--card:#171B21;--ink:#E6EAEF;--muted:#98A3AF;--accent:#86A6FF}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 "Inter",system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 12px}h2 small{color:var(--muted);font-weight:500}
p{color:var(--muted);margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px}
figure{margin:0;background:var(--card);border-radius:14px;padding:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
figure img{display:block;width:100%;height:auto;border-radius:8px}
figcaption{font-size:13px;padding:8px 4px 2px}figcaption small{color:var(--muted)}
a{color:var(--accent)}
</style></head><body><main>
<h1>Couch store screenshots</h1>
<p>Locale ${esc(locale)} · ${made.length} images · generated by store/render.mjs from prototype/index.html. Previews are JPEG; tap one for the full PNG.</p>
${sections}
</main></body></html>`;
}
writeFileSync(join(outRoot, 'index.html'), contactSheet());

// ---- step 4: publishable set (JPEG q85 of the 6.9" shots + contact sheet, relative paths only) ----------
function publishSheet(items) {
  const figs = items.map((m) => {
    const jpg = `${m.shot.n}-${m.shot.name}.jpg`;
    const head = esc(t(m.shot.key, m.shot.vars));
    return `<figure><a href="${jpg}"><img src="${jpg}" alt="${head}" width="${m.size.w}" height="${m.size.h}"></a>` +
      `<figcaption><b>${m.shot.n}</b> ${head}<br><small>${m.size.w} × ${m.size.h} JPEG · ${(statSync(m.publish).size / 1024).toFixed(0)} KB</small></figcaption></figure>`;
  }).join('\n');
  return `<!doctype html><html lang="${esc(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Couch store screenshots</title><style>
:root{--bg:#F4F5F7;--card:#fff;--ink:#1C232B;--muted:#5D6873;--accent:#2F5BD3}
@media (prefers-color-scheme:dark){:root{--bg:#0E1115;--card:#171B21;--ink:#E6EAEF;--muted:#98A3AF;--accent:#86A6FF}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 "Inter",system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:24px;margin:0 0 4px}p{color:var(--muted);margin:0 0 20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}
figure{margin:0;background:var(--card);border-radius:14px;padding:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
figure img{display:block;width:100%;height:auto;border-radius:8px}
figcaption{font-size:13px;padding:8px 4px 2px}figcaption small{color:var(--muted)}
a{color:var(--accent)}
</style></head><body><main>
<h1>Couch store screenshots</h1>
<p>App Store, iPhone 6.9" (${PUBLISH.dir}) · ${items.length} JPEG images, quality ${PUBLISH.quality}. Tap one for full size.</p>
<div class="grid">${figs}</div>
</main></body></html>`;
}
const pub = made.filter((m) => m.publish);
if (pub.length) {
  const sheet = publishSheet(pub);
  assertNoBrands(sheet, 'publish contact sheet');
  writeFileSync(join(publishDir, 'index.html'), sheet);
  const total = pub.reduce((n, m) => n + statSync(m.publish).size, statSync(join(publishDir, 'index.html')).size);
  console.log(`${relative(root, publishDir)}/  ${pub.length} JPEG + index.html, ${(total / 1048576).toFixed(2)} MB`);
  if (total > PUBLISH.maxBytes) throw new Error(`publish folder is ${(total / 1048576).toFixed(2)} MB, keep it under ${PUBLISH.maxBytes / 1048576} MB`);
}
if (IOS) {
  const { copyFileSync } = await import('node:fs');
  const jpgDir = join(here, 'jpg', 'ios');
  rmSync(jpgDir, { recursive: true, force: true });
  mkdirSync(jpgDir, { recursive: true });
  for (const m of pub) copyFileSync(m.publish, join(jpgDir, `${m.shot.n}-${m.shot.name}.jpg`));
  console.log(`${relative(root, jpgDir)}/  ${pub.length} JPEG for App Store Connect (APP_IPHONE_67)`);
}
console.log(`${made.length} screenshots + ${relative(root, join(outRoot, 'index.html'))}`);
