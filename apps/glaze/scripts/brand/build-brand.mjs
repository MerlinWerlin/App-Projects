// Writes the Glaze brand assets from src/core/introGlaze.ts (the one source of the mark's geometry) and renders the
// PNGs with headless Chromium. Run from the repo root:
//   node scripts/brand/build-brand.mjs            (SVG + PNG; needs Playwright + Chromium)
//   python3 scripts/brand/flatten.py              (strips alpha from icon.png: App Store rule)
// Env: PLAYWRIGHT (path to playwright's index.mjs), CHROMIUM (executable path).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adaptiveForegroundSvg, iconSvg, monochromeSvg, splashSvg } from '../../src/core/introGlaze.ts';

const out = join(process.cwd(), 'assets', 'brand');
mkdirSync(out, { recursive: true });
const files = {
  'icon.svg': iconSvg('light'),
  'icon-dark.svg': iconSvg('dark'),
  'splash-icon.svg': splashSvg('light'),
  'splash-icon-dark.svg': splashSvg('dark'),
  'adaptive-foreground.svg': adaptiveForegroundSvg(),
  'adaptive-monochrome.svg': monochromeSvg(),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), svg);
console.log('wrote', Object.keys(files).join(', '));

const pwPath = process.env.PLAYWRIGHT ?? '/home/claude/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(pwPath));
} catch {
  console.log('Playwright not found: SVGs written, PNGs not rendered.');
  process.exit(0);
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
const pngs = [
  ['icon.svg', 'icon.png', false],
  ['icon-dark.svg', 'icon-dark.png', false],
  ['splash-icon.svg', 'splash-icon.png', true],
  ['splash-icon-dark.svg', 'splash-icon-dark.png', true],
  ['adaptive-foreground.svg', 'adaptive-foreground.png', true],
  ['adaptive-monochrome.svg', 'adaptive-monochrome.png', true],
];
for (const [src, dst, transparent] of pngs) {
  const svg = readFileSync(join(out, src), 'utf8');
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: join(out, dst), omitBackground: transparent, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
}
await browser.close();
console.log('rendered', pngs.map((p) => p[1]).join(', '));
