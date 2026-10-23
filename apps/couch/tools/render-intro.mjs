#!/usr/bin/env node
/**
 * Opening animation renders (night-intro). Uses the same shape and track data as src/ui/IntroRemote.tsx
 * (src/core/introRemote.ts), drawn as SVG + CSS in the preinstalled headless Chromium (never a browser download).
 *
 *   node tools/render-intro.mjs --splash                      writes assets/brand/splash-icon.png (the first frame)
 *   node tools/render-intro.mjs --frames <out.png> [--ref <icon.png>] [--t 0,1100,1300,1900]
 *                                                             writes a labelled strip of frames (optionally after the icon)
 *   node tools/render-intro.mjs --adaptive                    writes assets/brand/adaptive-icon.png (Android foreground)
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.removeAllListeners('warning');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);

const M = await import(pathToFileURL(join(root, 'src/core/introRemote.ts')).href);

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/home/claude/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs',
    '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs',
  ];
  for (const c of candidates) {
    try {
      return c.startsWith('/') ? (existsSync(c) ? c : null) : require.resolve(c);
    } catch {
      // next
    }
  }
  return null;
}

const attr = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${v}"`)
    .join(' ');

function gradients(list) {
  return list
    .map((g) => {
      const stops = g.stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a ?? 1}"/>`).join('');
      const tag = g.type === 'linear' ? 'linearGradient' : 'radialGradient';
      return `<${tag} id="${g.id}" gradientUnits="userSpaceOnUse" ${attr(g.attrs)}>${stops}</${tag}>`;
    })
    .join('');
}

const shapes = (list) => list.map((s) => `<${s.kind} ${attr(s.attrs)}/>`).join('');

function svg(layer, extra = []) {
  const [x, y, w, h] = layer.box;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${x} ${y} ${w} ${h}"><defs>${gradients(layer.gradients)}</defs>${shapes([...layer.shapes, ...extra])}</svg>`;
}

/** One frame of the overlay at `size` px, as HTML (mirrors IntroRemote.tsx). `face` drops the panel (adaptive icon). */
function frameHtml(t, size, { bg = M.INTRO_BG, layersOnly = null, noPanel = false } = {}) {
  const k = size / M.VIEW;
  const f = M.frameAt(t);
  const v = (id, prop) => f[`${id}.${prop}`] ?? M.restValue(prop);
  const parts = [];
  for (let layer of M.remoteLayers()) {
    if (layersOnly && !layersOnly(layer)) continue;
    if (noPanel && layer.id === 'base') layer = { ...layer, shapes: layer.shapes.filter((sh) => sh.role !== 'panel') };
    const [x, y, w, h] = layer.box;
    const box = `position:absolute;left:${x * k}px;top:${y * k}px;width:${w * k}px;height:${h * k}px;`;
    if (layer.id === 'sheen') {
      const { cx, cy, r } = M.RING;
      const shift = v('sheen', 'shift') * M.sheenTravel() * k;
      const inner = `position:absolute;left:${(x - (cx - r)) * k}px;top:${(y - (cy - r)) * k}px;width:${w * k}px;height:${h * k}px;transform:translateX(${shift}px) rotate(${M.SHEEN.angle}deg)`;
      parts.push(
        `<div style="position:absolute;left:${(cx - r) * k}px;top:${(cy - r) * k}px;width:${2 * r * k}px;height:${2 * r * k}px;border-radius:50%;overflow:hidden;opacity:${v('sheen', 'opacity')}"><div style="${inner}">${svg(layer)}</div></div>`,
      );
      continue;
    }
    const opacity = layer.id === 'base' || layer.shade ? 1 : v(layer.id, 'opacity');
    const shade = layer.shade
      ? `<div style="position:absolute;inset:0;opacity:${v(layer.id, 'shade')}">${svg({ ...layer, gradients: [], shapes: layer.shade })}</div>`
      : '';
    parts.push(`<div style="${box}opacity:${opacity};transform:scale(${v(layer.id, 'scale')})">${svg(layer)}${shade}</div>`);
  }
  return `<div style="position:relative;width:${size}px;height:${size}px;background:${bg}">${parts.join('')}</div>`;
}

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const pw = loadPlaywright();
if (!pw) {
  console.error('playwright not found');
  process.exit(1);
}
const pwMod = await import(pw.startsWith('/') ? pathToFileURL(pw).href : pw);
const chromium = pwMod.chromium ?? pwMod.default?.chromium;
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function shoot(html, w, h, out, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:${transparent ? 'transparent' : '#0E0E0F'}">${html}</body></html>`);
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  console.log('wrote', out);
}

if (args.includes('--splash')) {
  // First frame: every layer at rest (glints, ripple and sheen are invisible), transparent around the panel.
  await shoot(frameHtml(0, 1024, { bg: 'transparent' }), 1024, 1024, join(root, 'assets/brand/splash-icon.png'), true);
}

if (args.includes('--adaptive')) {
  // Android adaptive foreground: the remote face without the panel, inside the 66/108 safe circle, on transparent.
  // The launcher draws assets' backgroundColor (the panel charcoal) behind it.
  const size = 1024;
  const inner = Math.round(size * M.ADAPTIVE_SCALE);
  const off = (size - inner) / 2;
  const dy = (M.VIEW / 2 - M.FACE_CENTRE_Y) * (inner / M.VIEW);
  const html = `<div style="position:relative;width:${size}px;height:${size}px"><div style="position:absolute;left:${off}px;top:${off + dy}px">${frameHtml(0, inner, { bg: 'transparent', noPanel: true })}</div></div>`;
  await shoot(html, size, size, join(root, 'assets/brand/adaptive-icon.png'), true);
}

const framesOut = arg('--frames');
if (framesOut) {
  const ts = (arg('--t') ?? '0,560,1010,1150,1300,1600,1900').split(',').map(Number);
  const ref = arg('--ref');
  const S = Number(arg("--size") ?? 360);
  const cells = [];
  if (ref) {
    const b64 = readFileSync(resolve(ref)).toString('base64');
    cells.push(`<figure><img src="data:image/png;base64,${b64}" width="${S}" height="${S}" style="display:block;border-radius:${S * 0.2237}px"/><figcaption>icon (reference)</figcaption></figure>`);
  }
  for (const t of ts) cells.push(`<figure>${frameHtml(t, S)}<figcaption>${t} ms</figcaption></figure>`);
  const html = `<style>body{font:14px system-ui;color:#bbb}figure{margin:0;display:inline-block;vertical-align:top;margin-right:12px}figcaption{text-align:center;padding:6px 0}</style><div style="padding:12px;white-space:nowrap">${cells.join('')}</div>`;
  const w = 24 + cells.length * (S + 12);
  await shoot(html, w, S + 60, resolve(framesOut));
}

await browser.close();
