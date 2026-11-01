// Writes the Glaze brand assets and renders the PNGs with headless Chromium. Run from the repo root:
//   node scripts/brand/build-brand.mjs            (SVG + PNG; needs Playwright + Chromium)
//   python3 scripts/brand/flatten.py              (strips alpha from icon.png: App Store rule; shrinks every PNG)
// T199 (owner-1101d #2): the app icon is the 25 Oct Prism diamond again. Its SVGs are copied verbatim from
// docs/mascot/previous-prism-diamond/; the splash image (the unlit diamond, no tile) is generated from
// src/core/introGlaze.ts, the same geometry the in-app intro draws.
// T216 (1 Nov): icon.png, icon-dark.png and adaptive-foreground.png are no longer rendered from the diamond SVGs: they
// come from the picture Jared picked on 25 Oct (python3 scripts/brand/picked-icon.py). The diamond SVGs stay as the
// source of the splash, the intro gem and the Android monochrome icon.
// T220 (owner-1101e 11:39): the splash, intro figure and Android monochrome PNGs now come from the picked picture too,
// so this script only writes the diamond SVGs (kept as reference) and renders nothing.
// Env: PLAYWRIGHT (path to playwright's index.mjs or a package name), CHROMIUM (executable path, optional).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { splashSvg } from '../../src/core/introGlaze.ts';

const out = join(process.cwd(), 'assets', 'brand');
const diamond = join(process.cwd(), 'docs', 'mascot', 'previous-prism-diamond');
mkdirSync(out, { recursive: true });
const copied = ['icon.svg', 'icon-dark.svg', 'adaptive-foreground.svg', 'adaptive-monochrome.svg'];
for (const f of copied) copyFileSync(join(diamond, f), join(out, f));
const files = { 'splash-icon.svg': splashSvg(), 'splash-icon-dark.svg': splashSvg() };
for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), svg);
console.log('copied', copied.join(', '), '+ wrote', Object.keys(files).join(', '));

// The first Playwright that loads and launches wins (a CommonJS require also sees NODE_PATH / global installs).
const req = createRequire(import.meta.url);
const loaders = [
  () => (process.env.PLAYWRIGHT ? import(process.env.PLAYWRIGHT) : null),
  () => req('playwright'),
  () => import('/home/claude/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs'),
];
let browser;
for (const load of loaders) {
  try {
    const mod = await load();
    if (!mod) continue;
    browser = await mod.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
    break;
  } catch {
    // try the next one
  }
}
if (!browser) {
  console.log('Playwright not found: SVGs written, PNGs not rendered.');
  process.exit(0);
}
const shot = async (svg, path, size, transparent) => {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const sized = svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
  await page.screenshot({ path, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
};
const pngs = [
];
for (const [src, dst, transparent] of pngs) await shot(readFileSync(join(out, src), 'utf8'), join(out, dst), 1024, transparent);
await browser.close();
console.log('rendered', pngs.map((p) => p[1]).join(', '));
