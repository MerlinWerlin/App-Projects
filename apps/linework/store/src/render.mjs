#!/usr/bin/env node
// Renders store/svg/a/*.svg to store/jpg/a (1320x2868) and store/jpg/a-6.5 (1284x2778), plus store/contact-sheet.png.
// JPEG (quality 85) keeps all 16 shots at about 3.5 MB; full-colour PNGs were ~10 MB, too heavy for the repo.
// Needs a local Chromium and playwright-core (no npm install): set PLAYWRIGHT_CORE to its folder if not found.
// The contact sheet is palette-reduced with ImageMagick `convert` when it is on PATH.
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const candidates = [process.env.PLAYWRIGHT_CORE, '/opt/npm-tools/node_modules/playwright-core', '/opt/node-tools/node_modules/playwright-core', 'playwright-core'].filter(Boolean);
let pw;
for (const c of candidates) {
  try { pw = require(c); break; } catch { /* try next */ }
}
if (!pw) { console.error('playwright-core not found; SVGs are the source of truth, PNG render skipped.'); process.exit(0); }

const hasConvert = (() => { try { execFileSync('convert', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
const shots = JSON.parse(readFileSync(join(STORE, 'svg', 'shots.json'), 'utf8'));
// v2 (owner 24 Oct 2026): one pastel style (a). Rendered for the 6.9" (1320x2868) and 6.5" (1284x2778) slots;
// the 6.5" set scales the same SVG to cover the slightly different aspect (a few px trimmed top and bottom).
const SIZES = [['a', 1320, 2868], ['a-6.5', 1284, 2778]];
for (const [dir, w, h] of SIZES) {
  mkdirSync(join(STORE, 'jpg', dir), { recursive: true });
  await page.setViewportSize({ width: w, height: h });
  for (const s of shots) {
    const svg = readFileSync(join(STORE, 'svg', 'a', `${s}.svg`), 'utf8')
      .replace(/<svg([^>]*?) width="1320" height="2868"/, `<svg$1 width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"`);
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const out = join(STORE, 'jpg', dir, `${s}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: w, height: h } });
    console.log(out, Math.round(statSync(out).size / 1024) + ' KB');
  }
}
// Contact sheet: one row of small thumbnails.
const thumbs = (style) => shots.map((s) => `<img src="data:image/jpeg;base64,${readFileSync(join(STORE, 'jpg', style, `${s}.jpg`)).toString('base64')}" style="width:150px;height:326px;border-radius:12px;margin:6px">`).join('');
const html = `<!doctype html><html><body style="margin:0;background:#F5F1EA;font:600 18px Inter,sans-serif;color:#22201C;padding:14px">
<div style="margin:4px 6px">Linework store screenshots v2 (pastel, 1320x2868)</div><div style="display:flex">${thumbs('a')}</div></body></html>`;
const sheetPage = await browser.newPage({ viewport: { width: 1320, height: 800 }, deviceScaleFactor: 1 });
await sheetPage.setContent(html);
const sheet = join(STORE, 'contact-sheet.png');
await sheetPage.screenshot({ path: sheet, fullPage: true });
if (hasConvert) execFileSync('convert', [sheet, '-colors', '128', '-strip', `PNG8:${sheet}`]);
console.log(sheet, Math.round(statSync(sheet).size / 1024) + ' KB');
await browser.close();
if (!existsSync(sheet)) process.exit(1);
