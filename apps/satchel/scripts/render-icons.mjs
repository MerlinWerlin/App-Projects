// Rasterise assets/brand/icon.svg into the app icon, Android adaptive foreground and splash glyphs (T18).
// Runs offline with headless Chromium via Playwright (no network, no new dependency in package.json):
//   node scripts/render-icons.mjs
// Outputs (all 1024 x 1024):
//   assets/icon.png              full-bleed paper background, opaque (alpha channel stripped with python3 + PIL)
//   assets/adaptive-icon.png     transparent, glyph scaled into the 66% adaptive-icon safe zone
//   assets/splash-icon.png       transparent, glyph only, light palette (shown on paper #F4F1EA)
//   assets/splash-icon-dark.png  transparent, glyph only, dark palette (shown on #0E1320)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const svg = readFileSync(join(root, 'assets/brand/icon.svg'), 'utf8').replace(/^<\?xml[^>]*>\s*/, '');

let playwright;
for (const base of [root, execFileSync('npm', ['root', '-g']).toString().trim()]) {
  try {
    playwright = createRequire(join(base, 'noop.js'))('playwright');
    break;
  } catch {}
}
if (!playwright) {
  console.error('playwright not found (local or global)');
  process.exit(2);
}

// Palettes mirror src/theme/tokens.ts `brand`.
const LIGHT = { bg: '#F4F1EA', body: '#14213D', flap: '#E07A2F', detail: '#F4F1EA' };
const DARK = { bg: '#0E1320', body: '#F4F1EA', flap: '#F29A5C', detail: '#0E1320' };
// The icon viewBox is re-centred on the glyph (the bg rect overhangs the canvas so it stays full-bleed).
// Glyph bounds in the 1024 grid are x 212..812, y 214..842 (centre 512,528).
const GLYPH_CY = 528;
const box = (side) => `${512 - side / 2} ${GLYPH_CY - side / 2} ${side} ${side}`;

const variants = [
  { out: 'assets/icon.png', colors: LIGHT, viewBox: box(1024), transparent: false },
  // Adaptive icons are masked to a circle/squircle of ~66% of the canvas: glyph (628 tall) at 0.6 scale = ~377 px.
  { out: 'assets/adaptive-icon.png', colors: { ...LIGHT, bg: 'transparent' }, viewBox: box(1024 / 0.6), transparent: true },
  // Splash glyphs: tight square with a little padding; expo-splash-screen draws it 180 pt wide.
  { out: 'assets/splash-icon.png', colors: { ...LIGHT, bg: 'transparent' }, viewBox: box(760), transparent: true },
  { out: 'assets/splash-icon-dark.png', colors: { ...DARK, bg: 'transparent' }, viewBox: box(760), transparent: true },
];

const browser = await playwright.chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  for (const v of variants) {
    const vars = Object.entries(v.colors).map(([k, c]) => `--${k}:${c}`).join(';');
    const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}svg{display:block;${vars}}</style></head><body>${svg}</body></html>`;
    await page.setContent(html);
    await page.evaluate((vb) => document.querySelector('svg').setAttribute('viewBox', vb), v.viewBox);
    const file = join(root, v.out);
    await page.locator('svg').screenshot({ path: file, omitBackground: v.transparent });
    if (!v.transparent) {
      // App Store icons must not carry an alpha channel at all.
      execFileSync('python3', ['-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[1])', file]);
    }
    console.log('wrote', v.out);
  }
} finally {
  await browser.close();
}
