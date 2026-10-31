// Writes the Glaze brand assets from src/core/introGlaze.ts (the one source of Prism's geometry) and renders the
// PNGs with headless Chromium. Run from the repo root:
//   node scripts/brand/build-brand.mjs            (SVG + PNG; needs Playwright + Chromium)
//   python3 scripts/brand/flatten.py              (strips alpha from icon.png: App Store rule; shrinks every PNG)
// Env: PLAYWRIGHT (path to playwright's index.mjs or a package name), CHROMIUM (executable path, optional).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { adaptiveForegroundSvg, iconSvg, mascotSvg, monochromeSvg, splashSvg } from '../../src/core/introGlaze.ts';

const out = join(process.cwd(), 'assets', 'brand');
const docs = join(process.cwd(), 'docs', 'mascot');
mkdirSync(out, { recursive: true });
const files = {
  'icon.svg': iconSvg('light'),
  'icon-dark.svg': iconSvg('dark'),
  'splash-icon.svg': splashSvg('light'),
  'splash-icon-dark.svg': splashSvg('dark'),
  'adaptive-foreground.svg': adaptiveForegroundSvg(),
  'adaptive-monochrome.svg': monochromeSvg(),
  'mascot.svg': mascotSvg(),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), svg);
// Docs previews (MASCOT.md, the build page).
writeFileSync(join(docs, 'prism-icon.svg'), iconSvg('light'));
writeFileSync(join(docs, 'prism-mascot.svg'), mascotSvg());
console.log('wrote', Object.keys(files).join(', '), '+ docs/mascot/prism-icon.svg, prism-mascot.svg');

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
  ['icon.svg', 'icon.png', false],
  ['icon-dark.svg', 'icon-dark.png', false],
  ['splash-icon.svg', 'splash-icon.png', true],
  ['splash-icon-dark.svg', 'splash-icon-dark.png', true],
  ['adaptive-foreground.svg', 'adaptive-foreground.png', true],
  ['adaptive-monochrome.svg', 'adaptive-monochrome.png', true],
];
for (const [src, dst, transparent] of pngs) await shot(readFileSync(join(out, src), 'utf8'), join(out, dst), 1024, transparent);
await shot(iconSvg('light'), join(docs, 'prism-icon.png'), 256, false);
await shot(mascotSvg(), join(docs, 'prism-mascot.png'), 256, true);
await browser.close();
console.log('rendered', pngs.map((p) => p[1]).join(', '), '+ docs/mascot/prism-icon.png, prism-mascot.png');
