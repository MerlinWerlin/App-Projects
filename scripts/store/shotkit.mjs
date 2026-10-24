/**
 * Shared store-screenshot kit for App Factory apps without their own renderer (Cue, Backspin).
 *
 * Each app's store/src/render.mjs describes its shots as HTML (a headline plus a faithful mock of a real app screen,
 * written in iPhone points from the app's own theme tokens and strings) and calls renderShots(). Every shot is a
 * 440 x 956 CSS-px page rendered at deviceScaleFactor 3 = 1320 x 2868 (App Store APP_IPHONE_67, 6.9"), then
 * flattened to an RGB JPEG (no alpha) with sharp.
 *
 * Uses the preinstalled Chromium and globally installed Playwright and sharp. Never installs or downloads anything.
 * Original art only: the phone is a generic iPhone-style frame with no maker marks; no logos, no real people.
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const G = join(process.env.HOME || '/home/claude', '.npm-global/lib/node_modules');
function load(...names) {
  for (const n of names) {
    for (const c of [n, join(G, n)]) {
      try { return require(c); } catch { /* next */ }
    }
  }
  throw new Error(`cannot load ${names[0]}; it must already be installed (this kit never installs anything)`);
}
const { chromium } = load('playwright', '@playwright/mcp/node_modules/playwright');
const sharp = load('sharp');

/** Shot page in CSS px; x3 = 1320 x 2868. */
export const SHOT = { w: 440, h: 956, scale: 3 };
/** iPhone 6.9" logical size in points; app mocks are laid out at this size and scaled into the frame. */
export const PT = { w: 440, h: 956 };

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** iOS-style status bar (time, signal, Wi-Fi, battery), drawn here. */
export function statusBar(ink = '#fff') {
  return `<div class="sb" style="color:${ink}"><span class="sbt">9:41</span><span class="sbr">
<svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="${ink}"/><rect x="5" y="5.5" width="3.2" height="6.5" rx="1" fill="${ink}"/><rect x="10" y="3" width="3.2" height="9" rx="1" fill="${ink}"/><rect x="15" y="0" width="3.2" height="12" rx="1" fill="${ink}"/></svg>
<svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.2c2.5 0 4.8 1 6.5 2.6l1.2-1.3C14.2 1.6 11.5.4 8.5.4S2.8 1.6.8 3.5L2 4.8c1.7-1.6 4-2.6 6.5-2.6zm0 3.6c1.5 0 2.9.6 4 1.6l1.2-1.3c-1.4-1.3-3.2-2.1-5.2-2.1s-3.8.8-5.2 2.1l1.2 1.3c1.1-1 2.5-1.6 4-1.6zm0 3.6c.6 0 1.1.2 1.5.6L8.5 11.6 7 10c.4-.4.9-.6 1.5-.6z" fill="${ink}"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="${ink}" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="${ink}"/><rect x="24.5" y="4.5" width="1.6" height="4" rx=".8" fill="${ink}" fill-opacity=".45"/></svg>
</span></div>`;
}

/**
 * Generic iPhone-style frame (Dynamic Island, no maker marks). `screen` is HTML laid out at PT size.
 * `width` is the outer frame width in shot px.
 */
export function phone(screen, { width = 368, bg = '#000', tilt = 0, style = '', cls = '' } = {}) {
  const bezel = width * 0.034;
  const inner = width - 2 * bezel;
  const k = inner / PT.w;
  const innerH = PT.h * k;
  return `<div class="phone ${cls}" style="width:${width}px;height:${innerH + 2 * bezel}px;padding:${bezel}px;border-radius:${width * 0.165}px;transform:rotate(${tilt}deg);${style}">
<span class="pb pb1"></span><span class="pb pb2"></span><span class="pb pb3"></span><span class="pb pb4"></span>
<div class="pscreen" style="border-radius:${width * 0.135}px;background:${bg}">
<div class="pt" style="width:${PT.w}px;height:${PT.h}px;transform:scale(${k})">${screen}</div>
<span class="island" style="top:${inner * 0.026}px;width:${inner * 0.285}px;height:${inner * 0.082}px"></span>
<span class="home"></span>
</div></div>`;
}

export const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${SHOT.w}px;height:${SHOT.h}px;overflow:hidden}
body{position:relative;font-family:"Inter","Noto Sans","DejaVu Sans",sans-serif,"Noto Color Emoji";-webkit-font-smoothing:antialiased}
.phone{position:relative;flex:none;background:linear-gradient(150deg,#4a4c52,#1a1b1e 30%,#0d0d0f 60%,#33353a);
  box-shadow:0 0 0 1.5px rgba(255,255,255,.10) inset,0 30px 70px -20px rgba(0,0,0,.55),0 10px 24px -8px rgba(0,0,0,.35)}
.pscreen{position:relative;width:100%;height:100%;overflow:hidden}
.pt{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden}
.island{position:absolute;left:50%;transform:translateX(-50%);border-radius:999px;background:#000;z-index:60}
.home{position:absolute;left:50%;bottom:6px;width:34%;height:4px;border-radius:3px;transform:translateX(-50%);background:rgba(128,128,128,.55);z-index:60}
.pb{position:absolute;width:3px;background:#2b2c30;border-radius:2px}
.pb1{left:-2px;top:17%;height:5%}.pb2{left:-2px;top:25%;height:8.5%}.pb3{left:-2px;top:35%;height:8.5%}.pb4{right:-2px;top:27%;height:13%}
.sb{position:absolute;left:0;right:0;top:0;height:54px;display:flex;align-items:center;justify-content:space-between;padding:8px 36px 0 50px;z-index:50;font:600 17px/1 "Inter",sans-serif}
.sbr{display:flex;gap:6px;align-items:center}
`;

/**
 * Renders shots to outDir as NN-name.jpg (1320x2868 RGB JPEG). shots: [{ n, name, html, css }].
 * Elements marked data-fit must not overflow (checked). Returns the written file paths.
 */
export async function renderShots({ shots, outDir, css = '', quality = 88 }) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const opts = { args: ['--default-tile-width=4096', '--default-tile-height=4096', '--disable-gpu-rasterization', '--font-render-hinting=none'] };
  let browser;
  try {
    browser = await chromium.launch({ ...opts, executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  } catch {
    browser = await chromium.launch(opts);
  }
  const ctx = await browser.newContext({ viewport: { width: SHOT.w, height: SHOT.h }, deviceScaleFactor: SHOT.scale });
  await ctx.route(/^https?:\/\//, (r) => r.abort());
  const out = [];
  for (const s of shots) {
    const page = await ctx.newPage();
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${BASE_CSS}${css}${s.css || ''}</style></head><body>${s.html}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => [...document.querySelectorAll('[data-fit]')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 40)));
    if (overflow.length) throw new Error(`shot ${s.n}-${s.name}: text overflows: ${overflow.join(' | ')}`);
    const png = await page.screenshot({ type: 'png' });
    await page.close();
    const file = join(outDir, `${s.n}-${s.name}.jpg`);
    await sharp(png).flatten({ background: '#000000' }).removeAlpha().jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(file);
    const m = await sharp(file).metadata();
    if (m.width !== SHOT.w * SHOT.scale || m.height !== SHOT.h * SHOT.scale || m.hasAlpha) throw new Error(`${file}: ${m.width}x${m.height} alpha=${m.hasAlpha}`);
    out.push(file);
    console.log(`${file}  ${m.width}x${m.height}`);
  }
  await browser.close();
  return out;
}
