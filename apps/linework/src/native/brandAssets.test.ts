// T56 guards for the app icon, adaptive icon, splash and favicon. Reads files only (no React Native at test time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));

type Png = { width: number; height: number; colorType: number; hasTrns: boolean };

// Reads width/height/colour type from the IHDR chunk and checks for a tRNS chunk.
function readPng(rel: string): Png {
  const buf = readFileSync(join(root, rel));
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  sig.forEach((b, i) => assert.equal(buf[i], b, `${rel}: PNG signature`));
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR', `${rel}: IHDR first`);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  let hasTrns = false;
  for (let off = 8; off + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'tRNS') hasTrns = true;
    if (type === 'IEND') break;
    off += 12 + len;
  }
  return { width, height, colorType, hasTrns };
}

const hasAlpha = (p: Png) => p.colorType === 4 || p.colorType === 6 || p.hasTrns;
const asset = (p: string) => p.replace(/^\.\//, '');
const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')?.[1];

test('T56: app.json points at the brand assets', () => {
  assert.equal(app.icon, './assets/icon.png');
  assert.deepEqual(app.android.adaptiveIcon, { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#F7F3EE' });
  assert.equal(app.web.favicon, './assets/favicon.png');
  assert.ok(splash, 'expo-splash-screen plugin has a config object');
  assert.equal(splash.image, './assets/splash-icon.png');
  assert.equal(splash.backgroundColor, '#F7F3EE', 'light paper');
  assert.equal(splash.dark.image, './assets/splash-icon-dark.png');
  assert.equal(splash.dark.backgroundColor, '#121110', 'dark paper');
  assert.ok(splash.imageWidth > 0 && splash.imageWidth <= 288);
});

test('T56: every referenced image exists with SVG sources in assets/brand', () => {
  for (const p of [app.icon, app.android.adaptiveIcon.foregroundImage, app.web.favicon, splash.image, splash.dark.image]) {
    assert.ok(existsSync(join(root, asset(p))), `${p} exists`);
  }
  for (const s of ['icon.svg', 'adaptive-foreground.svg', 'splash-icon.svg', 'splash-icon-dark.svg']) {
    const svg = readFileSync(join(root, 'assets', 'brand', s), 'utf8');
    assert.match(svg, /<svg[^>]*viewBox="0 0 1024 1024"/, `${s} is a 1024 SVG`);
  }
});

test('T56: icon is 1024 square, opaque (iOS masks corners itself)', () => {
  const p = readPng(asset(app.icon));
  assert.deepEqual([p.width, p.height], [1024, 1024]);
  assert.equal(hasAlpha(p), false, 'no alpha channel or tRNS');
});

test('T56: adaptive foreground and splash images are 1024 square with transparency', () => {
  for (const rel of [app.android.adaptiveIcon.foregroundImage, splash.image, splash.dark.image]) {
    const p = readPng(asset(rel));
    assert.deepEqual([p.width, p.height], [1024, 1024], rel);
    assert.ok(hasAlpha(p), `${rel} has transparency`);
  }
});

test('T56: favicon is 48x48', () => {
  const p = readPng(asset(app.web.favicon));
  assert.deepEqual([p.width, p.height], [48, 48]);
});

test('T56: brand binaries stay small (< 400 KB total)', () => {
  const files = [app.icon, app.android.adaptiveIcon.foregroundImage, app.web.favicon, splash.image, splash.dark.image];
  const total = files.reduce((n: number, p: string) => n + statSync(join(root, asset(p))).size, 0);
  assert.ok(total < 400 * 1024, `total ${total} bytes`);
});

test('T56: eas.json still has the T38 build profiles', () => {
  for (const k of ['development', 'preview', 'production']) assert.ok(eas.build[k], `${k} profile`);
});
